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
$email = strtolower(trim((string)($body['email'] ?? '')));
if ($email === '') {
    fail('Email is required');
}

ensure_password_resets_table();
rate_limit_or_fail('forgot_password', client_ip() . '|' . $email, 6, 1800);

$stmt = db()->prepare('SELECT id, status FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$user = $stmt->fetch();

if ($user && ($user['status'] ?? 'active') === 'active') {
    $userId = (int)$user['id'];

    $cleanup = db()->prepare('DELETE FROM password_resets WHERE user_id = ? OR expires_at <= NOW() OR used_at IS NOT NULL');
    $cleanup->execute([$userId]);

    $resetToken = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $resetToken);
    $expiresAt = (new DateTimeImmutable('+30 minutes'))->format('Y-m-d H:i:s');

    $insert = db()->prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)');
    $insert->execute([$userId, $tokenHash, $expiresAt]);

    $resetPath = '/reset-password?token=' . urlencode($resetToken);
    $subject = 'Reset your password';
    $text = "We received a request to reset your password. Use this link within 30 minutes: {$resetPath}";
    $html = '<p>We received a request to reset your password.</p><p>Use this link within 30 minutes: <a href="'
        . htmlspecialchars($resetPath, ENT_QUOTES, 'UTF-8')
        . '">' . htmlspecialchars($resetPath, ENT_QUOTES, 'UTF-8') . '</a></p>';
    queue_email($email, $subject, $text, $html, ['type' => 'password_reset_requested', 'user_id' => $userId]);
    if (notifications_enabled()) {
        process_email_outbox(10);
    }

    ok(['message' => 'If this email address is registered, a password reset link will be sent.']);
}

ok(['message' => 'If this email address is registered, a password reset link will be sent.']);
