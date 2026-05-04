<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

auth_user(true);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail('Method not allowed', 405);
}

$q = strtolower(trim((string)($_GET['q'] ?? '')));
$action = trim((string)($_GET['action'] ?? ''));
$page = max(1, (int)($_GET['page'] ?? 1));
$limit = (int)($_GET['limit'] ?? 20);
$limit = max(5, min($limit, 100));
$offset = ($page - 1) * $limit;

$where = ['1=1'];
$bind = [];

if ($q !== '') {
    $where[] = '(LOWER(a.action_type) LIKE ? OR LOWER(a.target_type) LIKE ? OR LOWER(COALESCE(a.target_id, "")) LIKE ? OR LOWER(COALESCE(u.name, "")) LIKE ? OR LOWER(COALESCE(u.email, "")) LIKE ?)';
    $like = '%' . $q . '%';
    $bind[] = $like;
    $bind[] = $like;
    $bind[] = $like;
    $bind[] = $like;
    $bind[] = $like;
}

if ($action !== '') {
    $where[] = 'a.action_type = ?';
    $bind[] = $action;
}

$whereSql = implode(' AND ', $where);

$countSql = 'SELECT COUNT(*) AS total
             FROM admin_audit_logs a
             LEFT JOIN users u ON u.id = a.admin_user_id
             WHERE ' . $whereSql;
$countStmt = db()->prepare($countSql);
$countStmt->execute($bind);
$total = (int)(($countStmt->fetch()['total'] ?? 0));

$listSql = 'SELECT a.id, a.admin_user_id, a.action_type, a.target_type, a.target_id, a.metadata, a.ip_address, a.created_at,
                   u.name AS admin_name, u.email AS admin_email
            FROM admin_audit_logs a
            LEFT JOIN users u ON u.id = a.admin_user_id
            WHERE ' . $whereSql . '
            ORDER BY a.id DESC
            LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset;
$listStmt = db()->prepare($listSql);
$listStmt->execute($bind);
$rows = $listStmt->fetchAll();

$actionsStmt = db()->prepare('SELECT action_type, COUNT(*) AS total FROM admin_audit_logs GROUP BY action_type ORDER BY action_type ASC');
$actionsStmt->execute();
$actionBuckets = $actionsStmt->fetchAll();

ok([
    'logs' => $rows,
    'meta' => [
        'page' => $page,
        'limit' => $limit,
        'total' => $total,
        'totalPages' => (int)max(1, (int)ceil($total / max(1, $limit))),
    ],
    'actions' => $actionBuckets,
]);
