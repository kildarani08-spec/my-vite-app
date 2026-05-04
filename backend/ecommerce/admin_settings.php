<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$admin = auth_user(true);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $settings = operational_settings();

    $masked = $settings;
    if (($masked['paymentGateway']['webhookSecret'] ?? '') !== '') {
        $masked['paymentGateway']['webhookSecret'] = '********';
    }
    if (($masked['notifications']['smtpPass'] ?? '') !== '') {
        $masked['notifications']['smtpPass'] = '********';
    }
    if (($masked['notifications']['sendgridApiKey'] ?? '') !== '') {
        $masked['notifications']['sendgridApiKey'] = '********';
    }
    if (($masked['notifications']['mailgunApiKey'] ?? '') !== '') {
        $masked['notifications']['mailgunApiKey'] = '********';
    }
    if (($masked['jobs']['workerToken'] ?? '') !== '') {
        $masked['jobs']['workerToken'] = '********';
    }

    ok(['settings' => $masked]);
}

if ($method !== 'POST') {
    fail('Method not allowed', 405);
}

$body = json_input();
if (($body['action'] ?? '') !== 'upsert') {
    fail('Invalid action');
}

$settings = $body['settings'] ?? null;
if (!is_array($settings)) {
    fail('Invalid settings payload');
}

$current = operational_settings();

$incomingWebhookSecret = trim((string)($settings['paymentGateway']['webhookSecret'] ?? ''));
if ($incomingWebhookSecret === '********') {
    $settings['paymentGateway']['webhookSecret'] = (string)($current['paymentGateway']['webhookSecret'] ?? '');
}

$incomingSmtpPass = trim((string)($settings['notifications']['smtpPass'] ?? ''));
if ($incomingSmtpPass === '********') {
    $settings['notifications']['smtpPass'] = (string)($current['notifications']['smtpPass'] ?? '');
}

$incomingSendgridApiKey = trim((string)($settings['notifications']['sendgridApiKey'] ?? ''));
if ($incomingSendgridApiKey === '********') {
    $settings['notifications']['sendgridApiKey'] = (string)($current['notifications']['sendgridApiKey'] ?? '');
}

$incomingMailgunApiKey = trim((string)($settings['notifications']['mailgunApiKey'] ?? ''));
if ($incomingMailgunApiKey === '********') {
    $settings['notifications']['mailgunApiKey'] = (string)($current['notifications']['mailgunApiKey'] ?? '');
}

$incomingWorkerToken = trim((string)($settings['jobs']['workerToken'] ?? ''));
if ($incomingWorkerToken === '********') {
    $settings['jobs']['workerToken'] = (string)($current['jobs']['workerToken'] ?? '');
}

save_operational_settings($settings, (int)$admin['id']);

log_admin_action(
    (int)$admin['id'],
    'operational_settings_update',
    'settings',
    'operational_settings',
    [
        'paymentProvider' => trim((string)($settings['paymentGateway']['provider'] ?? 'demo-gateway')),
        'sandboxMode' => !empty($settings['paymentGateway']['sandboxMode']),
        'webhookEnabled' => !empty($settings['paymentGateway']['webhookEnabled']),
        'notificationProvider' => trim((string)($settings['notifications']['provider'] ?? 'mail')),
        'smtpEnabled' => !empty($settings['notifications']['enabled']),
        'maintenanceMode' => !empty($settings['features']['maintenanceMode']),
        'workerEnabled' => !empty($settings['jobs']['workerEnabled']),
    ]
);

ok(['message' => 'Operational settings saved']);
