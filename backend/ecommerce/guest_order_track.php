<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail('Method not allowed', 405);
}

$orderNumber = trim((string)($_GET['order_number'] ?? ''));
$email = trim((string)($_GET['email'] ?? ''));

if ($orderNumber === '' || $email === '') {
    fail('Order number and email are required', 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('Invalid email', 422);
}

try {
    $supportsAddressLookup = db_table_exists('addresses') && db_column_exists('orders', 'shipping_address_id');
    $paymentStatusExpr = db_column_exists('orders', 'payment_status') ? 'o.payment_status' : "'Pending'";
    $paymentMethodExpr = db_column_exists('orders', 'payment_method') ? 'o.payment_method' : "'cod'";
    $grandTotalExpr = db_column_exists('orders', 'grand_total')
        ? 'o.grand_total'
        : (db_column_exists('orders', 'total_amount') ? 'o.total_amount' : '0');
    $subtotalExpr = db_column_exists('orders', 'subtotal') ? 'o.subtotal' : $grandTotalExpr;
    $shippingCostExpr = db_column_exists('orders', 'shipping_cost') ? 'o.shipping_cost' : '0';
    $discountExpr = db_column_exists('orders', 'discount_amount') ? 'o.discount_amount' : '0';
    $taxExpr = db_column_exists('orders', 'tax_amount') ? 'o.tax_amount' : '0';
    $trackingExpr = db_column_exists('orders', 'tracking_number') ? 'o.tracking_number' : "''";

    if ($supportsAddressLookup) {
        $phoneExpr = db_column_exists('addresses', 'phone_number') ? 'COALESCE(a.phone_number, "")' : '""';
        $shippingAddressExpr = 'TRIM(CONCAT_WS(", ", NULLIF(a.full_name, ""), NULLIF(a.street_address, ""), NULLIF(a.city, ""), NULLIF(a.state, ""), NULLIF(a.zip, ""), NULLIF(a.country, "")))';
        $orderStmt = db()->prepare(
            'SELECT o.id, o.order_number, o.status,
                    ' . $paymentStatusExpr . ' AS payment_status,
                    ' . $paymentMethodExpr . ' AS payment_method,
                    ' . $grandTotalExpr . ' AS grand_total,
                    ' . $subtotalExpr . ' AS subtotal,
                    ' . $shippingCostExpr . ' AS shipping_cost,
                    ' . $discountExpr . ' AS discount_amount,
                    ' . $taxExpr . ' AS tax_amount,
                    ' . $trackingExpr . ' AS tracking_number,
                    ' . $shippingAddressExpr . ' AS shipping_address_text,
                    ' . $phoneExpr . ' AS customer_phone,
                    COALESCE(a.email, u.email, "") AS customer_email,
                    o.created_at
             FROM orders o
             LEFT JOIN addresses a ON a.id = o.shipping_address_id
             LEFT JOIN users u ON u.id = o.user_id
             WHERE o.order_number = ?
               AND LOWER(COALESCE(a.email, u.email, "")) = LOWER(?)
             LIMIT 1'
        );
    } else {
        $shippingAddressExpr = db_column_exists('orders', 'shipping_address') ? 'COALESCE(o.shipping_address, "")' : '""';
        $phoneExpr = db_column_exists('users', 'phone_number') ? 'COALESCE(u.phone_number, "")' : '""';
        $orderStmt = db()->prepare(
            'SELECT o.id, o.order_number, o.status,
                    ' . $paymentStatusExpr . ' AS payment_status,
                    ' . $paymentMethodExpr . ' AS payment_method,
                    ' . $grandTotalExpr . ' AS grand_total,
                    ' . $subtotalExpr . ' AS subtotal,
                    ' . $shippingCostExpr . ' AS shipping_cost,
                    ' . $discountExpr . ' AS discount_amount,
                    ' . $taxExpr . ' AS tax_amount,
                    ' . $trackingExpr . ' AS tracking_number,
                    ' . $shippingAddressExpr . ' AS shipping_address_text,
                    ' . $phoneExpr . ' AS customer_phone,
                    COALESCE(u.email, "") AS customer_email,
                    o.created_at
             FROM orders o
             JOIN users u ON u.id = o.user_id
             WHERE o.order_number = ?
               AND LOWER(u.email) = LOWER(?)
             LIMIT 1'
        );
    }

    $orderStmt->execute([$orderNumber, $email]);
    $order = $orderStmt->fetch();

    if (!$order) {
        fail('Order not found', 404);
    }

    $itemIdColumn = db_column_exists('order_items', 'order_item_id') ? 'order_item_id' : 'id';
    $hasDirectName = db_column_exists('order_items', 'name');
    $hasDiscountPrice = db_column_exists('order_items', 'discount_price');
    $hasDirectSku = db_column_exists('order_items', 'sku');

    if ($hasDirectName) {
        $priceExpr = $hasDiscountPrice ? 'COALESCE(oi.discount_price, oi.price, 0)' : 'COALESCE(oi.price, 0)';
        $skuExpr = $hasDirectSku ? 'COALESCE(oi.sku, "")' : '""';
        $itemStmt = db()->prepare(
            'SELECT oi.' . $itemIdColumn . ' AS id,
                    COALESCE(oi.name, p.name, CONCAT("Item #", oi.product_id)) AS name,
                    oi.quantity AS qty,
                    ' . $priceExpr . ' AS price,
                    COALESCE(oi.total, (' . $priceExpr . ' * oi.quantity), 0) AS total,
                    ' . $skuExpr . ' AS sku,
                    COALESCE(p.image, "") AS image
             FROM order_items oi
             LEFT JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ?
             ORDER BY oi.' . $itemIdColumn . ' ASC'
        );
    } else {
        $itemStmt = db()->prepare(
            'SELECT oi.id,
                    COALESCE(p.name, CONCAT("Item #", oi.product_id)) AS name,
                    oi.quantity AS qty,
                    oi.price,
                    COALESCE(oi.total, oi.price * oi.quantity, 0) AS total,
                    "" AS sku,
                    COALESCE(p.image, "") AS image
             FROM order_items oi
             LEFT JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ?
             ORDER BY oi.id ASC'
        );
    }

    $itemStmt->execute([(int)$order['id']]);

    ok([
        'order' => $order,
        'items' => $itemStmt->fetchAll(),
        'events' => order_events((int)$order['id']),
    ]);
} catch (Throwable) {
    fail('Unable to load order status right now. Please try again shortly.', 500);
}
