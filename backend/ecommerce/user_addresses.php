<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function ua_table_exists(string $table): bool
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

$user = auth_user(false);
$userId = (int)$user['id'];
$method = $_SERVER['REQUEST_METHOD'];
$addressTable = ua_table_exists('addresses') ? 'addresses' : 'user_addresses';

if ($method === 'GET') {
    $stmt = db()->prepare("SELECT * FROM {$addressTable} WHERE user_id = ? ORDER BY is_default DESC, id DESC");
    $stmt->execute([$userId]);
    ok(['addresses' => $stmt->fetchAll()]);
}

if ($method !== 'POST') {
    fail('Method not allowed', 405);
}

$body = json_input();
$required = ['label', 'full_name', 'email', 'phone_number', 'street_address', 'city', 'state', 'zip'];
foreach ($required as $field) {
    if (trim((string)($body[$field] ?? '')) === '') {
        fail('Missing required address fields');
    }
}

if (!empty($body['is_default'])) {
    $clearDefault = db()->prepare("UPDATE {$addressTable} SET is_default = 0 WHERE user_id = ?");
    $clearDefault->execute([$userId]);
}

if (!empty($body['use_for_billing'])) {
    $clearBilling = db()->prepare("UPDATE {$addressTable} SET use_for_billing = 0 WHERE user_id = ?");
    $clearBilling->execute([$userId]);
}

if ($addressTable === 'addresses') {
    $stmt = db()->prepare(
        'INSERT INTO addresses (user_id, label, full_name, email, phone_number, street_address, city, state, zip, country, landmark, instructions, is_default, use_for_billing)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $userId,
        trim((string)$body['label']),
        trim((string)$body['full_name']),
        trim((string)$body['email']),
        trim((string)$body['phone_number']),
        trim((string)$body['street_address']),
        trim((string)$body['city']),
        trim((string)$body['state']),
        trim((string)$body['zip']),
        trim((string)($body['country'] ?? 'India')),
        trim((string)($body['landmark'] ?? '')) ?: null,
        trim((string)($body['instructions'] ?? '')) ?: null,
        !empty($body['is_default']) ? 1 : 0,
        !empty($body['use_for_billing']) ? 1 : 0,
    ]);
} else {
    $stmt = db()->prepare(
        'INSERT INTO user_addresses (user_id, label, full_name, email, phone_number, street_address, city, state, zip, is_default, use_for_billing)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $userId,
        trim((string)$body['label']),
        trim((string)$body['full_name']),
        trim((string)$body['email']),
        trim((string)$body['phone_number']),
        trim((string)$body['street_address']),
        trim((string)$body['city']),
        trim((string)$body['state']),
        trim((string)$body['zip']),
        !empty($body['is_default']) ? 1 : 0,
        !empty($body['use_for_billing']) ? 1 : 0,
    ]);
}

$id = (int)db()->lastInsertId();
$get = db()->prepare("SELECT * FROM {$addressTable} WHERE id = ? LIMIT 1");
$get->execute([$id]);
ok(['address' => $get->fetch()]);
