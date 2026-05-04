<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/http.php';

function admin_audit_table_exists(): bool
{
    static $exists = null;
    if ($exists !== null) {
        return $exists;
    }

    try {
        $stmt = db()->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1');
        $stmt->execute(['admin_audit_logs']);
        $exists = (bool)$stmt->fetchColumn();
    } catch (Throwable) {
        $exists = false;
    }

    return $exists;
}

function log_admin_action(int $adminUserId, string $actionType, string $targetType, ?string $targetId = null, array $metadata = []): void
{
    if (!admin_audit_table_exists()) {
        return;
    }

    $stmt = db()->prepare(
        'INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, metadata, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)'
    );

    $json = json_encode($metadata, JSON_UNESCAPED_UNICODE);
    try {
        $stmt->execute([
            $adminUserId,
            $actionType,
            $targetType,
            $targetId,
            $json === false ? '{}' : $json,
            client_ip(),
        ]);
    } catch (Throwable) {
        // Audit logging must never block checkout or admin operations in legacy schemas.
    }
}
