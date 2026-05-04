<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function ad_table_exists(string $table): bool
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

auth_user(true);

$metrics = [
    'products' => (int)db()->query('SELECT COUNT(*) FROM products')->fetchColumn(),
    'orders' => (int)db()->query('SELECT COUNT(*) FROM orders')->fetchColumn(),
    'users' => (int)db()->query('SELECT COUNT(*) FROM users')->fetchColumn(),
    'reviews' => (int)db()->query('SELECT COUNT(*) FROM reviews')->fetchColumn(),
    'revenue' => (float)db()->query("SELECT COALESCE(SUM(grand_total),0) FROM orders WHERE payment_status IN ('paid','pending')")->fetchColumn(),
];

$recentOrdersStmt = db()->query('SELECT id, order_number, status, payment_status, grand_total FROM orders ORDER BY created_at DESC LIMIT 8');
$variantTable = ad_table_exists('product_variants') ? 'product_variants' : 'products_detail';
$variantStatusCond = $variantTable === 'product_variants' ? "v.status = 'active'" : "v.availability != 'out_of_stock'";
$lowStockStmt = db()->query("SELECT v.id AS variant_id, p.name, v.sku, v.stock_quantity FROM {$variantTable} v JOIN products p ON p.id = v.product_id WHERE {$variantStatusCond} AND v.stock_quantity <= 5 ORDER BY v.stock_quantity ASC LIMIT 12");

ok([
    'metrics' => $metrics,
    'recentOrders' => $recentOrdersStmt->fetchAll(),
    'lowStock' => $lowStockStmt->fetchAll(),
]);
