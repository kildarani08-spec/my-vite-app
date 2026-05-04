<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$user = auth_user(false);
$userId = (int)$user['id'];

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail('Method not allowed', 405);
}

$orderId = (int)($_GET['id'] ?? 0);

try {
    $paymentStatusSelect = db_column_exists('orders', 'payment_status') ? 'payment_status' : "'Pending' AS payment_status";
    $grandTotalSelect = db_column_exists('orders', 'grand_total')
        ? 'grand_total'
        : (db_column_exists('orders', 'total_amount') ? 'total_amount AS grand_total' : '0 AS grand_total');

    if ($orderId > 0) {
        $orderStmt = db()->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1');
        $orderStmt->execute([$orderId, $userId]);
        $order = $orderStmt->fetch();

        if (!$order) {
            fail('Order not found', 404);
        }

        $itemIdColumn = db_column_exists('order_items', 'order_item_id') ? 'order_item_id' : 'id';
        $hasDirectName = db_column_exists('order_items', 'name');
        $hasDirectSku = db_column_exists('order_items', 'sku');
        $hasDiscountPrice = db_column_exists('order_items', 'discount_price');
        $hasVariantTable = db_table_exists('product_variants');

        if ($hasDirectName) {
            $priceSelect = $hasDiscountPrice ? 'COALESCE(discount_price, price)' : 'price';
            $skuSelect = $hasDirectSku ? 'sku' : "'' AS sku";
            $itemsStmt = db()->prepare(
                'SELECT ' . $itemIdColumn . ' AS order_item_id, product_id, variant_id, quantity, ' . $priceSelect . ' AS price, total, name, ' . $skuSelect . '
                 FROM order_items
                 WHERE order_id = ?
                 ORDER BY ' . $itemIdColumn . ' ASC'
            );
        } else {
            $variantJoin = $hasVariantTable ? ' LEFT JOIN product_variants v ON v.id = oi.variant_id ' : ' ';
            $skuSelect = $hasVariantTable ? 'v.sku' : "'' AS sku";
            $itemsStmt = db()->prepare(
                'SELECT oi.id AS order_item_id, oi.product_id, oi.variant_id, oi.quantity, oi.price, oi.total, p.name, ' . $skuSelect . '
                 FROM order_items oi
                 JOIN products p ON p.id = oi.product_id' . $variantJoin . '
                 WHERE oi.order_id = ?
                 ORDER BY oi.id ASC'
            );
        }

        $itemsStmt->execute([$orderId]);

        ok(['order' => $order, 'items' => $itemsStmt->fetchAll(), 'events' => order_events($orderId)]);
    }

    $listStmt = db()->prepare('SELECT id, order_number, status, ' . $paymentStatusSelect . ', ' . $grandTotalSelect . ', created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC');
    $listStmt->execute([$userId]);
    ok(['orders' => $listStmt->fetchAll()]);
} catch (Throwable) {
    fail('Unable to load orders right now. Please try again shortly.', 500);
}
