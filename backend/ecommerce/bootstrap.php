<?php

declare(strict_types=1);

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/security.php';
require_once __DIR__ . '/lib/settings.php';
require_once __DIR__ . '/lib/audit.php';
require_once __DIR__ . '/lib/orders.php';
require_once __DIR__ . '/lib/promotions.php';
require_once __DIR__ . '/lib/notifications.php';
require_once __DIR__ . '/lib/payment_gateway.php';

boot_http();

$script = basename((string)($_SERVER['SCRIPT_NAME'] ?? ''));
$maintenanceAllowed = [
	'index.php',
	'login.php',
	'register.php',
	'forgot_password.php',
	'reset_password.php',
	'site_content.php',
	'payment_webhook.php',
	'worker_outbox.php',
	'admin_settings.php',
	'logout.php',
];

$isAdminEndpoint = str_starts_with($script, 'admin_');
$flags = operational_settings()['features'] ?? [];
$maintenanceMode = !empty($flags['maintenanceMode']);

if ($maintenanceMode && !$isAdminEndpoint && !in_array($script, $maintenanceAllowed, true)) {
	fail('Store is under maintenance. Please try again later.', 503);
}
