<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';

function settings_table_available(): bool
{
    static $available = null;
    if ($available !== null) {
        return $available;
    }

    try {
        $stmt = db()->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1');
        $stmt->execute(['settings']);
        $available = (bool)$stmt->fetchColumn();
    } catch (Throwable) {
        $available = false;
    }

    return $available;
}

function settings_fallback_path(): string
{
    return dirname(__DIR__) . '/data/settings_fallback.json';
}

function read_fallback_settings_store(): array
{
    $path = settings_fallback_path();
    if (!is_file($path)) {
        return [];
    }

    $raw = file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function read_fallback_setting(string $key): array
{
    $store = read_fallback_settings_store();
    $value = $store[$key] ?? [];
    return is_array($value) ? $value : [];
}

function write_fallback_setting(string $key, array $value): void
{
    $path = settings_fallback_path();
    $dir = dirname($path);
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('Unable to create settings fallback directory');
        }
    }

    $store = read_fallback_settings_store();
    $store[$key] = $value;
    $json = json_encode($store, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if (!is_string($json)) {
        throw new RuntimeException('Unable to encode fallback settings payload');
    }

    $bytes = file_put_contents($path, $json, LOCK_EX);
    if ($bytes === false) {
        throw new RuntimeException('Unable to write fallback settings file');
    }
}

function setting_json(string $key): array
{
    static $cache = [];

    if (isset($cache[$key]) && is_array($cache[$key])) {
        return $cache[$key];
    }

    if (!settings_table_available()) {
        $cache[$key] = read_fallback_setting($key);
        return $cache[$key];
    }

    try {
        $stmt = db()->prepare('SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1');
        $stmt->execute([$key]);
        $row = $stmt->fetch();
    } catch (Throwable) {
        $cache[$key] = read_fallback_setting($key);
        return $cache[$key];
    }

    if (!$row) {
        $cache[$key] = [];
        return $cache[$key];
    }

    $decoded = json_decode((string)$row['setting_value'], true);
    $cache[$key] = is_array($decoded) ? $decoded : [];
    return $cache[$key];
}

function site_settings(): array
{
    return setting_json('site_content');
}

function enabled_payment_methods(): array
{
    $settings = site_settings();
    $methods = $settings['checkout']['paymentMethods'] ?? [];

    if (!is_array($methods) || !$methods) {
        return ['card', 'upi', 'cod'];
    }

    $enabled = [];
    foreach ($methods as $method) {
        if (!is_array($method)) {
            continue;
        }

        $id = strtolower(trim((string)($method['id'] ?? '')));
        $isEnabled = ($method['enabled'] ?? true) !== false;
        if ($isEnabled && in_array($id, ['card', 'upi', 'cod'], true)) {
            $enabled[] = $id;
        }
    }

    return $enabled ?: ['cod'];
}

function default_operational_settings(): array
{
    return [
        'paymentGateway' => [
            'provider' => 'razorpay',
            'sandboxMode' => true,
            'webhookEnabled' => false,
            'webhookSecret' => '',
        ],
        'notifications' => [
            'provider' => 'mail',
            'smtpHost' => '',
            'smtpPort' => 587,
            'smtpUser' => '',
            'smtpPass' => '',
            'sendgridApiKey' => '',
            'mailgunDomain' => '',
            'mailgunApiKey' => '',
            'fromEmail' => 'support@myshop.com',
            'enabled' => false,
        ],
        'features' => [
            'allowGuestCheckout' => true,
            'maintenanceMode' => false,
        ],
        'jobs' => [
            'workerEnabled' => false,
            'workerToken' => '',
            'outboxBatchSize' => 25,
            'maxEmailAttempts' => 3,
            'retryBackoffSeconds' => 90,
        ],
    ];
}

function operational_settings(): array
{
    $saved = setting_json('operational_settings');
    $defaults = default_operational_settings();

    return [
        'paymentGateway' => array_merge($defaults['paymentGateway'], is_array($saved['paymentGateway'] ?? null) ? $saved['paymentGateway'] : []),
        'notifications' => array_merge($defaults['notifications'], is_array($saved['notifications'] ?? null) ? $saved['notifications'] : []),
        'features' => array_merge($defaults['features'], is_array($saved['features'] ?? null) ? $saved['features'] : []),
        'jobs' => array_merge($defaults['jobs'], is_array($saved['jobs'] ?? null) ? $saved['jobs'] : []),
    ];
}

function save_operational_settings(array $settings, int $adminId): void
{
    $normalized = [
        'paymentGateway' => [
            'provider' => trim((string)($settings['paymentGateway']['provider'] ?? 'razorpay')) ?: 'razorpay',
            'sandboxMode' => !empty($settings['paymentGateway']['sandboxMode']),
            'webhookEnabled' => !empty($settings['paymentGateway']['webhookEnabled']),
            'webhookSecret' => trim((string)($settings['paymentGateway']['webhookSecret'] ?? '')),
        ],
        'notifications' => [
            'provider' => in_array(strtolower((string)($settings['notifications']['provider'] ?? 'mail')), ['mail', 'sendgrid', 'mailgun'], true)
                ? strtolower((string)$settings['notifications']['provider'])
                : 'mail',
            'smtpHost' => trim((string)($settings['notifications']['smtpHost'] ?? '')),
            'smtpPort' => max(1, (int)($settings['notifications']['smtpPort'] ?? 587)),
            'smtpUser' => trim((string)($settings['notifications']['smtpUser'] ?? '')),
            'smtpPass' => trim((string)($settings['notifications']['smtpPass'] ?? '')),
            'sendgridApiKey' => trim((string)($settings['notifications']['sendgridApiKey'] ?? '')),
            'mailgunDomain' => trim((string)($settings['notifications']['mailgunDomain'] ?? '')),
            'mailgunApiKey' => trim((string)($settings['notifications']['mailgunApiKey'] ?? '')),
            'fromEmail' => trim((string)($settings['notifications']['fromEmail'] ?? 'support@myshop.com')),
            'enabled' => !empty($settings['notifications']['enabled']),
        ],
        'features' => [
            'allowGuestCheckout' => !empty($settings['features']['allowGuestCheckout']),
            'maintenanceMode' => !empty($settings['features']['maintenanceMode']),
        ],
        'jobs' => [
            'workerEnabled' => !empty($settings['jobs']['workerEnabled']),
            'workerToken' => trim((string)($settings['jobs']['workerToken'] ?? '')),
            'outboxBatchSize' => max(1, min((int)($settings['jobs']['outboxBatchSize'] ?? 25), 100)),
            'maxEmailAttempts' => max(1, min((int)($settings['jobs']['maxEmailAttempts'] ?? 3), 10)),
            'retryBackoffSeconds' => max(10, min((int)($settings['jobs']['retryBackoffSeconds'] ?? 90), 3600)),
        ],
    ];

    if (!settings_table_available()) {
        write_fallback_setting('operational_settings', $normalized);
        return;
    }

    $json = json_encode($normalized, JSON_UNESCAPED_UNICODE);
    $stmt = db()->prepare(
        'INSERT INTO settings (setting_key, setting_value, updated_by)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute(['operational_settings', $json, $adminId, $json, $adminId]);
}
