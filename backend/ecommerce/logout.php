<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

$user = auth_user();
$token = bearer_token();

revoke_token($token);

ok([
    'message' => 'Logged out successfully',
    'user_id' => (int)$user['id'],
]);
