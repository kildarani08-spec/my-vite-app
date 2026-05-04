<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$admin = auth_user(true);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $q = strtolower(trim((string)($_GET['q'] ?? '')));

    $sql = 'SELECT r.id, r.product_id, r.user_id, r.rating, r.review_text,
                   p.name AS product_name, u.name AS user_name
            FROM reviews r
            JOIN products p ON p.id = r.product_id
            JOIN users u ON u.id = r.user_id
            WHERE 1=1';
    $bind = [];

    if ($q !== '') {
        $sql .= ' AND (LOWER(p.name) LIKE ? OR LOWER(u.name) LIKE ? OR LOWER(r.review_text) LIKE ?)';
        $like = '%' . $q . '%';
        $bind[] = $like;
        $bind[] = $like;
        $bind[] = $like;
    }

    $sql .= ' ORDER BY r.created_at DESC';
    $stmt = db()->prepare($sql);
    $stmt->execute($bind);

    ok(['reviews' => $stmt->fetchAll()]);
}

if ($method !== 'POST') {
    fail('Method not allowed', 405);
}

$body = json_input();
if (($body['action'] ?? '') !== 'delete') {
    fail('Invalid action');
}

$reviewId = (int)($body['review_id'] ?? 0);
if ($reviewId <= 0) {
    fail('Invalid review id');
}

$stmt = db()->prepare('DELETE FROM reviews WHERE id = ?');
$stmt->execute([$reviewId]);

log_admin_action(
    (int)$admin['id'],
    'review_delete',
    'review',
    (string)$reviewId,
    []
);

ok(['message' => 'Review deleted']);
