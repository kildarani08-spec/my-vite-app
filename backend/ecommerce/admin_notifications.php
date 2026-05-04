<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$admin = auth_user(true);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $status = trim((string)($_GET['status'] ?? ''));
    $q = strtolower(trim((string)($_GET['q'] ?? '')));
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = max(10, min((int)($_GET['limit'] ?? 20), 100));
    $offset = ($page - 1) * $limit;

    $where = ['1=1'];
    $bind = [];

    if ($status !== '' && in_array($status, ['queued', 'sent', 'failed'], true)) {
        $where[] = 'status = ?';
        $bind[] = $status;
    }

    if ($q !== '') {
        $where[] = '(LOWER(recipient) LIKE ? OR LOWER(subject) LIKE ?)';
        $like = '%' . $q . '%';
        $bind[] = $like;
        $bind[] = $like;
    }

    $whereSql = implode(' AND ', $where);

    $countStmt = db()->prepare('SELECT COUNT(*) AS total FROM notification_outbox WHERE ' . $whereSql);
    $countStmt->execute($bind);
    $total = (int)($countStmt->fetch()['total'] ?? 0);

    $listStmt = db()->prepare('SELECT id, channel, recipient, subject, status, attempts, last_error, next_attempt_at, created_at, sent_at FROM notification_outbox WHERE ' . $whereSql . ' ORDER BY id DESC LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset);
    $listStmt->execute($bind);

    $metricsStmt = db()->query('SELECT status, COUNT(*) AS total FROM notification_outbox GROUP BY status');
    $metricsRows = $metricsStmt->fetchAll();
    $metrics = ['queued' => 0, 'sent' => 0, 'failed' => 0];
    foreach ($metricsRows as $row) {
        $key = (string)($row['status'] ?? '');
        if (isset($metrics[$key])) {
            $metrics[$key] = (int)$row['total'];
        }
    }

    ok([
        'notifications' => $listStmt->fetchAll(),
        'meta' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'totalPages' => (int)max(1, ceil($total / max(1, $limit))),
        ],
        'metrics' => $metrics,
    ]);
}

if ($method !== 'POST') {
    fail('Method not allowed', 405);
}

$body = json_input();
if (($body['action'] ?? '') !== 'process') {
    fail('Invalid action');
}

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
