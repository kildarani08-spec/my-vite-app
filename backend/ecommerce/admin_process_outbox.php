<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$admin = auth_user(true);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

$body = json_input();
$limit = (int)($body['limit'] ?? 25);

$result = process_email_outbox($limit);

log_admin_action(
    (int)$admin['id'],
    'notification_outbox_process',
    'notification_outbox',
    null,
    [
        'limit' => $limit,
        'processed' => $result['processed'],
        'sent' => $result['sent'],
        'failed' => $result['failed'],
    ]
);

ok([
    'message' => 'Outbox processing completed',
    'result' => $result,
]);
