<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

function ensure_password_resets_table(): void
{
    static $ensured = false;

    if ($ensured) {
        return;
    }

    db()->exec("CREATE TABLE IF NOT EXISTS password_resets (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )");

    $ensured = true;
}

$body = json_input();
$token = trim((string)($body['token'] ?? ''));
$newPassword = (string)($body['password'] ?? '');

if ($token === '' || $newPassword === '') {
    fail('Token and password are required');
}

if (strlen($newPassword) < 8 ||
    !preg_match('/[A-Z]/', $newPassword) ||
    !preg_match('/[a-z]/', $newPassword) ||
    !preg_match('/\d/', $newPassword)
) {
    fail('Password must be at least 8 chars and include upper, lower and number', 422);
}

$tokenHash = hash('sha256', $token);

ensure_password_resets_table();
$stmt = db()->prepare('SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1');
$stmt->execute([$tokenHash]);
$resetRow = $stmt->fetch();

if (!$resetRow) {
    fail('Invalid or expired reset token', 422);
}

$pdo = db();
$pdo->beginTransaction();

try {
    $resetId = (int)$resetRow['id'];
    $userId = (int)$resetRow['user_id'];

    $userStmt = $pdo->prepare('SELECT email FROM users WHERE id = ? LIMIT 1');
    $userStmt->execute([$userId]);
    $userRow = $userStmt->fetch();

    $hash = password_hash($newPassword, PASSWORD_DEFAULT);
    $updateUser = $pdo->prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $updateUser->execute([$hash, $userId]);

    $markUsed = $pdo->prepare('UPDATE password_resets SET used_at = NOW() WHERE id = ?');
    $markUsed->execute([$resetId]);

    revoke_user_tokens($userId);

    $cleanup = $pdo->prepare('DELETE FROM password_resets WHERE user_id = ? AND id <> ?');
    $cleanup->execute([$userId, $resetId]);

    $pdo->commit();

    if ($userRow && !empty($userRow['email'])) {
        $subject = 'Your password was changed';
        $text = 'Your account password has been updated successfully. If this was not you, contact support immediately.';
        $html = '<p>Your account password has been updated successfully.</p><p>If this was not you, contact support immediately.</p>';
        queue_email((string)$userRow['email'], $subject, $text, $html, ['type' => 'password_changed', 'user_id' => $userId]);
        if (notifications_enabled()) {
            process_email_outbox(10);
        }
    }
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fail('Could not reset password');
}

ok(['message' => 'Password reset successful. Please log in with your new password.']);
