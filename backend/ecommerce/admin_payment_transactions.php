<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$admin = auth_user(true);
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    fail('Payment transactions are read-only', 405);
}

$q = trim((string)($_GET['q'] ?? ''));
$status = trim((string)($_GET['status'] ?? ''));
$provider = trim((string)($_GET['provider'] ?? ''));
$page = max(1, (int)($_GET['page'] ?? 1));
$limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));
$offset = ($page - 1) * $limit;

$where = ['1=1'];
$bind = [];

if ($q !== '') {
    $where[] = '(session_token LIKE ? OR idem_key LIKE ? OR provider_order_id LIKE ? OR provider_payment_id LIKE ?)';
    $like = '%' . $q . '%';
    $bind[] = $like;
    $bind[] = $like;
    $bind[] = $like;
    $bind[] = $like;
}

if ($status !== '') {
    $where[] = 'status = ?';
    $bind[] = $status;
}

if ($provider !== '') {
    $where[] = 'provider = ?';
    $bind[] = $provider;
}

$whereSql = implode(' AND ', $where);

$countStmt = db()->prepare('SELECT COUNT(*) FROM payment_transactions WHERE ' . $whereSql);
$countStmt->execute($bind);
$total = (int)$countStmt->fetchColumn();

$listStmt = db()->prepare(
    'SELECT id, session_token, idem_key, user_id, guest_token, payment_method, provider, amount, currency,
            subtotal, shipping_cost, discount_amount, status, provider_order_id, provider_payment_id,
            error_message, order_id, created_at, updated_at
     FROM payment_transactions
     WHERE ' . $whereSql . '
     ORDER BY id DESC
     LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset
);
$listStmt->execute($bind);

log_admin_action(
    (int)$admin['id'],
    'payment_transactions_read',
    'payment_transaction',
    null,
    [
        'q' => $q,
        'status' => $status,
        'provider' => $provider,
        'page' => $page,
        'limit' => $limit,
    ]
);

ok([
    'transactions' => $listStmt->fetchAll(),
    'meta' => [
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'pages' => $limit > 0 ? (int)ceil($total / $limit) : 1,
    ],
]);
