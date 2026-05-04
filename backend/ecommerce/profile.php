<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function profile_column_exists(string $table, string $column): bool
{
    static $cache = [];
    $key = $table . '.' . $column;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = db()->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1');
    $stmt->execute([$table, $column]);
    $cache[$key] = (bool)$stmt->fetchColumn();

    return $cache[$key];
}

function profile_phone_column(): string
{
    return profile_column_exists('users', 'phone_number') ? 'phone_number' : 'phone';
}

$user = auth_user(false);
$userId = (int)$user['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $phoneCol = profile_phone_column();
    $stmt = db()->prepare("SELECT id, name, email, {$phoneCol} AS phone_number, created_at FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();

    if (!$row) {
        fail('Profile not found', 404);
    }

    $parts = explode(' ', (string)$row['name'], 2);
    ok(['profile' => [
        'id' => (int)$row['id'],
        'first_name' => $parts[0] ?? '',
        'last_name' => $parts[1] ?? '',
        'email' => $row['email'],
        'phone_number' => $row['phone_number'],
        'date_of_birth' => null,
        'created_at' => $row['created_at'],
    ]]);
}

if ($method !== 'POST') {
    fail('Method not allowed', 405);
}

$body = json_input();
$firstName = trim((string)($body['first_name'] ?? ''));
$lastName = trim((string)($body['last_name'] ?? ''));
$phone = trim((string)($body['phone_number'] ?? ''));

if ($firstName === '') {
    fail('First name is required');
}

$name = trim($firstName . ' ' . $lastName);
$phoneCol = profile_phone_column();
$hasUpdatedAt = profile_column_exists('users', 'updated_at');
$updateSql = $hasUpdatedAt
    ? "UPDATE users SET name = ?, {$phoneCol} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    : "UPDATE users SET name = ?, {$phoneCol} = ? WHERE id = ?";
$stmt = db()->prepare($updateSql);
$stmt->execute([$name, $phone ?: null, $userId]);

ok(['message' => 'Profile updated']);
