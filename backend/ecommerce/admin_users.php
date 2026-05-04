<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function admin_users_phone_column(): ?string
{
    static $column = false;

    if ($column !== false) {
        return $column;
    }

    foreach (['phone_number', 'phone'] as $candidate) {
        $stmt = db()->prepare(
            'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1'
        );
        $stmt->execute(['users', $candidate]);
        if ((bool)$stmt->fetchColumn()) {
            $column = $candidate;
            return $column;
        }
    }

    $column = null;
    return $column;
}

function admin_users_has_column(string $table, string $column): bool
{
    $stmt = db()->prepare(
        'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1'
    );
    $stmt->execute([$table, $column]);
    return (bool)$stmt->fetchColumn();
}

$admin = auth_user(true);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $q = strtolower(trim((string)($_GET['q'] ?? '')));

    $sql = 'SELECT id, name, email, role, status FROM users WHERE 1=1';
    $bind = [];

    if ($q !== '') {
        $phoneColumn = admin_users_phone_column();
        $searchParts = ['LOWER(name) LIKE ?', 'LOWER(email) LIKE ?'];
        $like = '%' . $q . '%';
        $bind[] = $like;
        $bind[] = $like;

        if ($phoneColumn !== null) {
            $searchParts[] = 'LOWER(COALESCE(' . $phoneColumn . ', "")) LIKE ?';
            $bind[] = $like;
        }

        $sql .= ' AND (' . implode(' OR ', $searchParts) . ')';
    }

    $sql .= ' ORDER BY created_at DESC';
    $stmt = db()->prepare($sql);
    $stmt->execute($bind);
    ok(['users' => $stmt->fetchAll()]);
}

if ($method !== 'POST') {
    fail('Method not allowed', 405);
}

$body = json_input();

$action = trim((string)($body['action'] ?? ''));

if ($action === 'create') {
    $name = trim((string)($body['name'] ?? ''));
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $role = trim((string)($body['role'] ?? 'customer'));
    $status = trim((string)($body['status'] ?? 'active'));
    $phone = trim((string)($body['phone_number'] ?? $body['phone'] ?? ''));
    $password = trim((string)($body['password'] ?? ''));

    if ($name === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail('Valid name and email are required', 422);
    }

    $allowedRoles = ['customer', 'super_admin'];
    if (!in_array($role, $allowedRoles, true)) {
        fail('Invalid role', 422);
    }

    $allowedStatuses = ['active', 'inactive', 'blocked', 'banned'];
    if ($status === 'blocked') {
        $status = 'banned';
    }
    if (!in_array($status, $allowedStatuses, true)) {
        fail('Invalid status', 422);
    }

    $existsStmt = db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $existsStmt->execute([$email]);
    if ($existsStmt->fetch()) {
        fail('Email already exists', 409);
    }

    if ($password === '') {
        $password = bin2hex(random_bytes(16));
    }

    $phoneColumn = admin_users_phone_column();
    if ($phoneColumn !== null) {
        $insertStmt = db()->prepare('INSERT INTO users (name, email, password_hash, role, status, ' . $phoneColumn . ') VALUES (?, ?, ?, ?, ?, ?)');
        $insertStmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), $role, $status, $phone !== '' ? $phone : null]);
    } else {
        $insertStmt = db()->prepare('INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)');
        $insertStmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), $role, $status]);
    }

    $newUserId = (int)db()->lastInsertId();

    log_admin_action(
        (int)$admin['id'],
        'user_create',
        'user',
        (string)$newUserId,
        [
            'role' => $role,
            'status' => $status,
            'email' => $email,
        ]
    );

    ok(['message' => 'User created', 'user_id' => $newUserId]);
}

if ($action === 'deactivate') {
    $userId = (int)($body['user_id'] ?? 0);
    if ($userId <= 0) {
        fail('Invalid user id');
    }
    if ($userId === (int)$admin['id']) {
        fail('You cannot deactivate your own account', 400);
    }

    if (admin_users_has_column('users', 'updated_at')) {
        $stmt = db()->prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        $stmt->execute(['inactive', $userId]);
    } else {
        $stmt = db()->prepare('UPDATE users SET status = ? WHERE id = ?');
        $stmt->execute(['inactive', $userId]);
    }

    log_admin_action(
        (int)$admin['id'],
        'user_deactivate',
        'user',
        (string)$userId,
        ['status' => 'inactive']
    );

    ok(['message' => 'User deactivated']);
}

if ($action === 'delete') {
    fail('Hard delete is disabled. Use deactivate.', 405);
}

if ($action !== 'update') {
    fail('Invalid action');
}

$userId = (int)($body['user_id'] ?? 0);
$role = trim((string)($body['role'] ?? 'customer'));
$status = trim((string)($body['status'] ?? 'active'));
if ($userId <= 0) {
    fail('Invalid user id');
}

$allowedRoles = ['customer', 'super_admin'];
$allowedStatuses = ['active', 'inactive', 'blocked', 'banned'];

if ($status === 'blocked') {
    // Legacy schemas use "banned" instead of "blocked".
    $status = 'banned';
}
if (!in_array($role, $allowedRoles, true)) {
    fail('Invalid role', 422);
}
if (!in_array($status, $allowedStatuses, true)) {
    fail('Invalid status', 422);
}

$stmt = db()->prepare('UPDATE users SET role = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
$stmt->execute([$role, $status, $userId]);

log_admin_action(
    (int)$admin['id'],
    'user_update',
    'user',
    (string)$userId,
    [
        'role' => $role,
        'status' => $status,
    ]
);

ok(['message' => 'User updated']);
