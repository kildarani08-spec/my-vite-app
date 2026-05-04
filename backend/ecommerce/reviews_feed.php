<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail('Method not allowed', 405);
}

$limit = (int)($_GET['limit'] ?? 8);
$limit = max(1, min(12, $limit));

$sql = sprintf(
    'SELECT r.id, r.product_id, p.name AS product_name, r.user_id, u.name AS user_name, r.rating, r.review_text, r.created_at
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     JOIN products p ON p.id = r.product_id
     ORDER BY r.created_at DESC
     LIMIT %d',
    $limit
);

$stmt = db()->prepare($sql);
$stmt->execute();
$rows = $stmt->fetchAll() ?: [];

$reviews = array_map(static function (array $row): array {
    return [
        'id' => (int)$row['id'],
        'product_id' => (int)$row['product_id'],
        'product_name' => (string)$row['product_name'],
        'user_id' => (int)$row['user_id'],
        'user_name' => (string)$row['user_name'],
        'rating' => (int)$row['rating'],
        'review_text' => (string)$row['review_text'],
        'created_at' => (string)$row['created_at'],
    ];
}, $rows);

ok(['reviews' => $reviews]);
