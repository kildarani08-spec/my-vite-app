<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $settings = site_settings();
} catch (Throwable) {
    $settings = [];
}

try {
    $gateway = operational_settings()['paymentGateway'] ?? [];
} catch (Throwable) {
    $gateway = [];
}

$provider = strtolower(trim((string)($gateway['provider'] ?? 'razorpay')));
if (!in_array($provider, ['razorpay', 'mock'], true)) {
    $provider = 'razorpay';
}

if (!isset($settings['checkout']) || !is_array($settings['checkout'])) {
    $settings['checkout'] = [];
}

if (!isset($settings['offers']) || !is_array($settings['offers'])) {
    $settings['offers'] = [];
}

unset($settings['offers']['activePromoStrip'], $settings['offers']['activePromoCampaigns']);

$activePromo = active_storefront_promotion();
$activePromoCampaigns = active_storefront_promotions(false);
if ($activePromo) {
    $settings['offers']['activePromoStrip'] = promotion_banner_payload($activePromo);
}
if ($activePromoCampaigns) {
    $settings['offers']['activePromoCampaigns'] = array_map(static function (array $promotion): array {
        $payload = promotion_banner_payload($promotion);
        return [
            'id' => (int)($promotion['id'] ?? 0),
            'name' => (string)($promotion['name'] ?? ''),
            'text' => (string)($payload['text'] ?? $promotion['banner_text'] ?? ''),
            'to' => (string)($payload['to'] ?? '/products'),
            'priority' => (int)($promotion['priority'] ?? 100),
            'status' => (string)($promotion['runtime_status'] ?? 'active'),
            'displayMode' => (string)($promotion['display_mode'] ?? 'both'),
            'isPrimary' => !empty($promotion['is_primary']),
        ];
    }, $activePromoCampaigns);
}

$settings['checkout']['paymentProvider'] = $provider;
$settings['checkout']['sandboxMode'] = !empty($gateway['sandboxMode']);

if (!$settings) {
    ok(['settings' => new stdClass()]);
}

ok(['settings' => $settings]);
