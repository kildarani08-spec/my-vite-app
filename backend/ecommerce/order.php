<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$user = auth_user(false);
$userId = (int)$user['id'];

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail('Method not allowed', 405);
}

$orderId = (int)($_GET['id'] ?? 0);
if ($orderId <= 0) {
    fail('Invalid order id');
}

$orderStmt = db()->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1');
$orderStmt->execute([$orderId, $userId]);
$order = $orderStmt->fetch();
if (!$order) {
    fail('Order not found', 404);
}

$itemStmt = db()->prepare('SELECT oi.id, p.name, oi.quantity AS qty, oi.price FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?');
$itemStmt->execute([$orderId]);

ok(['order' => $order, 'items' => $itemStmt->fetchAll(), 'events' => order_events($orderId)]);
