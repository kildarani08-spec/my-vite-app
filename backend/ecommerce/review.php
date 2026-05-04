<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$user = auth_user(false);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $productId = (int)($_GET['product_id'] ?? 0);
    if ($productId <= 0) {
        fail('Invalid product id');
    }

    $sql = 'SELECT COUNT(*) AS total
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            WHERE o.user_id = ? AND oi.product_id = ? AND o.status IN ("delivered", "shipped")';
    $stmt = db()->prepare($sql);
    $stmt->execute([(int)$user['id'], $productId]);
    $row = $stmt->fetch() ?: ['total' => 0];

    ok(['can_review' => ((int)$row['total'] > 0)]);
}

if ($method !== 'POST') {
    fail('Method not allowed', 405);
}

$body = json_input();
$productId = (int)($body['product_id'] ?? 0);
$rating = (int)($body['rating'] ?? 0);
$reviewText = trim((string)($body['review_text'] ?? ''));

if ($productId <= 0 || $rating < 1 || $rating > 5 || $reviewText === '') {
    fail('Invalid review payload');
}

$checkStmt = db()->prepare('SELECT COUNT(*) AS total FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.user_id = ? AND oi.product_id = ? AND o.status IN ("delivered", "shipped")');
$checkStmt->execute([(int)$user['id'], $productId]);
$eligible = $checkStmt->fetch();
if ((int)($eligible['total'] ?? 0) <= 0) {
    fail('Purchase required before review', 403);
}

$stmt = db()->prepare('INSERT INTO reviews (user_id, product_id, rating, review_text) VALUES (?, ?, ?, ?)');
$stmt->execute([(int)$user['id'], $productId, $rating, $reviewText]);

ok(['message' => 'Review submitted']);
