<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function login_table_exists(string $table): bool
{
    static $cache = [];
    if (array_key_exists($table, $cache)) {
        return $cache[$table];
    }

    $stmt = db()->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1');
    $stmt->execute([$table]);
    $cache[$table] = (bool)$stmt->fetchColumn();

    return $cache[$table];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

$body = json_input();
$email = strtolower(trim((string)($body['email'] ?? '')));
$password = (string)($body['password'] ?? '');
$guestToken = trim((string)($body['guest_token'] ?? ''));

rate_limit_or_fail('login', client_ip() . '|' . $email, 8, 600);

if ($email === '' || $password === '') {
    fail('Email and password are required');
}

$stmt = db()->prepare('SELECT id, name, email, password_hash, role, status FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, (string)$user['password_hash'])) {
    fail('Invalid credentials', 401);
}

if (($user['status'] ?? 'active') !== 'active') {
    fail('Account is not active', 403);
}

$token = create_token((int)$user['id']);

$cartTable = login_table_exists('carts') ? 'carts' : 'cart';

if ($guestToken !== '') {
    $mergeSql = $cartTable === 'carts'
        ? 'UPDATE carts SET user_id = ?, guest_token = NULL WHERE guest_token = ?'
        : "UPDATE cart SET user_id = ?, guest_token = NULL WHERE guest_token = ? AND status = 'active'";
    $merge = db()->prepare($mergeSql);
    $merge->execute([(int)$user['id'], $guestToken]);
}

$countSql = $cartTable === 'carts'
    ? 'SELECT COUNT(*) AS totalItems FROM carts WHERE user_id = ?'
    : "SELECT COUNT(*) AS totalItems FROM cart WHERE user_id = ? AND status = 'active'";
$cartStmt = db()->prepare($countSql);
$cartStmt->execute([(int)$user['id']]);
$cartMeta = $cartStmt->fetch() ?: ['totalItems' => 0];

ok([
    'token' => $token,
    'user' => [
        'id' => (int)$user['id'],
        'name' => (string)$user['name'],
        'email' => (string)$user['email'],
        'role' => (string)$user['role'],
        'status' => (string)$user['status'],
    ],
    'cart' => [
        'meta' => ['totalItems' => (int)$cartMeta['totalItems']]
    ]
]);
