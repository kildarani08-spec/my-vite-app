<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

$settings = operational_settings();
$jobs = $settings['jobs'] ?? [];
$workerEnabled = !empty($jobs['workerEnabled']);
$workerToken = trim((string)($jobs['workerToken'] ?? ''));

if (!$workerEnabled || $workerToken === '') {
    fail('Worker is disabled', 403);
}

$providedToken = header_value('X-Worker-Token');
if ($providedToken === '' || !hash_equals($workerToken, $providedToken)) {
    fail('Unauthorized worker token', 401);
}

$body = json_input();
$limit = (int)($body['limit'] ?? ($jobs['outboxBatchSize'] ?? 25));
$result = process_email_outbox($limit);

ok([
    'message' => 'Worker run completed',
    'result' => $result,
]);
