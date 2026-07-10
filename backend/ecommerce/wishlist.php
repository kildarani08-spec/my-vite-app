<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function wishlist_table_exists(string $table): bool
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
fail_if_admin_purchase($user, 'Admin accounts cannot use wishlist on the storefront. Please sign in with a customer account.');
$method = $_SERVER['REQUEST_METHOD'];
$userId = (int)$user['id'];
$wishlistTable = wishlist_table_exists('wishlist_items') ? 'wishlist_items' : 'wishlist';
$variantTable = wishlist_table_exists('product_variants') ? 'product_variants' : 'products_detail';
$variantPriceCol = $variantTable === 'product_variants' ? 'base_price' : 'price';
$variantStatusCond = $variantTable === 'product_variants' ? "v.status = 'active'" : "v.availability != 'out_of_stock'";

if ($method === 'GET') {
    $sql = 'SELECT w.id AS wishlist_id, p.id AS product_id, p.name, p.image,
                   v.id AS variant_id, v.sku AS variant_sku, v.' . $variantPriceCol . ' AS base_price,
                   CASE
                       WHEN v.discount_price IS NOT NULL
                            AND v.discount_price > 0
                            AND v.discount_price < v.' . $variantPriceCol . '
                           AND (v.discount_end IS NULL OR v.discount_end >= NOW())
                           THEN v.discount_price
                       ELSE NULL
                   END AS discount_price,
                   CASE WHEN v.stock_quantity > 0 THEN "in_stock" ELSE "out_of_stock" END AS availability
            FROM ' . $wishlistTable . ' w
            JOIN products p ON p.id = w.product_id
            LEFT JOIN ' . $variantTable . ' v ON v.product_id = p.id AND ' . $variantStatusCond . '
            WHERE w.user_id = ?
            GROUP BY w.id
            ORDER BY w.created_at DESC';
    $stmt = db()->prepare($sql);
    $stmt->execute([$userId]);
    ok(['wishlist' => $stmt->fetchAll()]);
}

$body = json_input();
$productId = (int)($body['product_id'] ?? 0);
if ($productId <= 0) {
    fail('Invalid product id');
}

if ($method === 'POST') {
    $stmt = db()->prepare('INSERT IGNORE INTO ' . $wishlistTable . ' (user_id, product_id) VALUES (?, ?)');
    $stmt->execute([$userId, $productId]);
    ok(['message' => 'Wishlist updated']);
}

if ($method === 'DELETE') {
    $stmt = db()->prepare('DELETE FROM ' . $wishlistTable . ' WHERE user_id = ? AND product_id = ?');
    $stmt->execute([$userId, $productId]);
    ok(['message' => 'Wishlist item removed']);
}

fail('Method not allowed', 405);
