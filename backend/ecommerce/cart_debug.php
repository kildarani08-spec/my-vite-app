<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if (APP_ENV !== 'development') {
    fail('Unavailable outside development', 403);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail('Method not allowed', 405);
}

function cart_debug_table_exists(string $table): bool
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

$guestToken = trim((string)($_GET['guest_token'] ?? ''));
$userId = (int)($_GET['user_id'] ?? 0);
$limit = max(1, min(200, (int)($_GET['limit'] ?? 50)));

$modern = cart_debug_table_exists('carts');
$table = $modern ? 'carts' : 'cart';
$idCol = $modern ? 'id' : 'cart_id';

$where = '1=1';
$params = [];

if ($guestToken !== '') {
    $where .= ' AND c.guest_token = ?';
    $params[] = $guestToken;
}

if ($userId > 0) {
    $where .= ' AND c.user_id = ?';
    $params[] = $userId;
}

$sql = "SELECT c.{$idCol} AS cart_id, c.user_id, c.guest_token, c.product_id, c.variant_id, c.quantity, c.updated_at,
               p.name AS product_name
        FROM {$table} c
        LEFT JOIN products p ON p.id = c.product_id
        WHERE {$where}
        ORDER BY c.updated_at DESC
        LIMIT {$limit}";

$stmt = db()->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

$countSql = "SELECT COUNT(*) FROM {$table} c WHERE {$where}";
$countStmt = db()->prepare($countSql);
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

ok([
    'schema' => $modern ? 'modern' : 'legacy',
    'table' => $table,
    'filters' => [
        'guest_token' => $guestToken,
        'user_id' => $userId > 0 ? $userId : null,
        'limit' => $limit,
    ],
    'total' => $total,
    'rows' => $rows,
]);
