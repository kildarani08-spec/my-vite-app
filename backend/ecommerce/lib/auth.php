<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/http.php';

function auth_tokens_table_exists(): bool
{
    static $exists = null;
    if ($exists !== null) {
        return $exists;
    }

    try {
        $stmt = db()->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1');
        $stmt->execute(['auth_tokens']);
        $exists = (bool)$stmt->fetchColumn();
    } catch (Throwable) {
        $exists = false;
    }

    return $exists;
}

function cleanup_expired_tokens(): void
{
    if (!auth_tokens_table_exists()) {
        return;
    }

    static $ran = false;
    if ($ran) {
        return;
    }
    $ran = true;

    $stmt = db()->prepare('DELETE FROM auth_tokens WHERE expires_at <= NOW()');
    $stmt->execute();
}

function create_token(int $userId): string
{
    if (!auth_tokens_table_exists()) {
        return '';
    }

    cleanup_expired_tokens();

    $token = bin2hex(random_bytes(32));
    $expiresAt = (new DateTimeImmutable('+' . TOKEN_TTL_HOURS . ' hours'))->format('Y-m-d H:i:s');

    $stmt = db()->prepare('INSERT INTO auth_tokens (user_id, token, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([$userId, $token, $expiresAt]);

    return $token;
}

function revoke_token(string $token): void
{
    if (!auth_tokens_table_exists()) {
        return;
    }

    if ($token === '') {
        return;
    }

    $stmt = db()->prepare('DELETE FROM auth_tokens WHERE token = ?');
    $stmt->execute([$token]);
}

function revoke_user_tokens(int $userId): void
{
    if (!auth_tokens_table_exists()) {
        return;
    }

    $stmt = db()->prepare('DELETE FROM auth_tokens WHERE user_id = ?');
    $stmt->execute([$userId]);
}

function is_admin_role(?string $role): bool
{
    $normalizedRole = strtolower(trim((string)$role));
    return in_array($normalizedRole, ['admin', 'super_admin'], true);
}

function fail_if_admin_purchase(?array $user, string $message = 'Admin accounts cannot purchase from the storefront. Please use a customer account.'): void
{
    if ($user !== null && is_admin_role($user['role'] ?? '')) {
        fail($message, 403);
    }
}

function auth_user(bool $adminOnly = false): array
{
    if (!auth_tokens_table_exists()) {
        if (APP_ENV === 'development' && $adminOnly) {
            return [
                'id' => 0,
                'name' => 'Development Super Admin',
                'email' => 'dev-super-admin@local',
                'role' => 'super_admin',
                'status' => 'active',
            ];
        }

        fail('Unauthorized', 401);
    }

    cleanup_expired_tokens();

    $token = bearer_token();
    if ($token === '') {
        fail('Unauthorized', 401);
    }

    $sql = 'SELECT u.id, u.name, u.email, u.role, u.status
            FROM auth_tokens t
            JOIN users u ON u.id = t.user_id
            WHERE t.token = ? AND t.expires_at > NOW() LIMIT 1';
    $stmt = db()->prepare($sql);
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        fail('Invalid or expired token', 401);
    }

    if (($user['status'] ?? 'active') !== 'active') {
        fail('Account is not active', 403);
    }

    if ($adminOnly && ($user['role'] ?? '') !== 'super_admin') {
        fail('Super Admin access required', 403);
    }

    return $user;
}
