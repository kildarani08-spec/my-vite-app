<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';

function ensure_order_events_table(): bool
{
    static $checked = false;
    static $available = false;

    if ($checked) {
        return $available;
    }

    $checked = true;

    if (db_table_exists('order_events')) {
        $available = true;
        return true;
    }

    try {
        db()->exec(
            'CREATE TABLE IF NOT EXISTS order_events (
                id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
                order_id BIGINT UNSIGNED NOT NULL,
                event_type VARCHAR(80) NOT NULL,
                title VARCHAR(160) NOT NULL,
                details TEXT DEFAULT NULL,
                actor_type ENUM("system", "customer", "admin", "webhook") NOT NULL DEFAULT "system",
                actor_id BIGINT UNSIGNED DEFAULT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_order_events_order (order_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        $available = true;
        return true;
    } catch (Throwable) {
        $available = false;
        return false;
    }
}

function record_order_event(
    int $orderId,
    string $eventType,
    string $title,
    string $details = '',
    string $actorType = 'system',
    ?int $actorId = null
): void {
    if (!ensure_order_events_table()) {
        return;
    }

    $allowedActorTypes = ['system', 'customer', 'admin', 'webhook'];
    if (!in_array($actorType, $allowedActorTypes, true)) {
        $actorType = 'system';
    }

    $stmt = db()->prepare('INSERT INTO order_events (order_id, event_type, title, details, actor_type, actor_id) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([$orderId, $eventType, $title, $details, $actorType, $actorId]);
}

function order_events(int $orderId): array
{
    if (!ensure_order_events_table()) {
        return [];
    }

    $stmt = db()->prepare('SELECT event_type, title, details, actor_type, actor_id, created_at FROM order_events WHERE order_id = ? ORDER BY id DESC');
    $stmt->execute([$orderId]);
    return $stmt->fetchAll();
}
