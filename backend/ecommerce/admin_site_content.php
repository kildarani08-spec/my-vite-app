<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$admin = auth_user(true);
$method = $_SERVER['REQUEST_METHOD'];

function load_site_content_settings(): array
{
    if (!function_exists('settings_table_available') || !settings_table_available()) {
        return function_exists('read_fallback_setting') ? read_fallback_setting('site_content') : [];
    }

    try {
        $stmt = db()->prepare('SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1');
        $stmt->execute(['site_content']);
        $row = $stmt->fetch();
        if (!$row) {
            return [];
        }

        $settings = json_decode((string)$row['setting_value'], true);
        return is_array($settings) ? $settings : [];
    } catch (Throwable) {
        return function_exists('read_fallback_setting') ? read_fallback_setting('site_content') : [];
    }
}

function save_site_content_settings(array $settings, int $adminId): void
{
    $jsonSettings = json_encode($settings, JSON_UNESCAPED_UNICODE);

    if (!function_exists('settings_table_available') || !settings_table_available()) {
        if (function_exists('write_fallback_setting')) {
            write_fallback_setting('site_content', $settings);
        }
        return;
    }

    try {
        $stmt = db()->prepare(
            'INSERT INTO settings (setting_key, setting_value, updated_by)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE setting_value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute(['site_content', $jsonSettings, $adminId, $jsonSettings, $adminId]);
        return;
    } catch (Throwable) {
        // Backward-compatible fallback for older settings table schemas.
    }

    try {
        $stmt = db()->prepare(
            'INSERT INTO settings (setting_key, setting_value)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
        );
        $stmt->execute(['site_content', $jsonSettings]);
    } catch (Throwable) {
        if (function_exists('write_fallback_setting')) {
            write_fallback_setting('site_content', $settings);
        }
    }
}

function promo_target_params(string $targetUrl): array
{
    $query = parse_url($targetUrl, PHP_URL_QUERY);
    if (!is_string($query) || $query === '') {
        return [];
    }

    parse_str($query, $params);
    return is_array($params) ? $params : [];
}

function promo_actions_for_offer_type(string $offerType): array
{
    $offer = strtolower(trim($offerType));
    $template = function_exists('promotion_template_by_offer') ? promotion_template_by_offer($offer) : [];
    $templateActions = is_array($template['actions'] ?? null) ? $template['actions'] : [];

    if ($templateActions) {
        $actions = [
            'discountType' => (string)($templateActions['discountType'] ?? 'none'),
            'discountValue' => (float)($templateActions['discountValue'] ?? 0),
            'freeShipping' => !empty($templateActions['freeShipping']),
            'stackable' => !empty($templateActions['stackable']),
            'buyQuantity' => max(1, (int)($templateActions['buyQuantity'] ?? 2)),
            'freeQuantity' => max(1, (int)($templateActions['freeQuantity'] ?? 1)),
        ];

        $triggerType = str_replace('-', '_', strtolower(trim((string)($templateActions['triggerType'] ?? ''))));
        if (in_array($triggerType, ['flash_sale', 'happy_hour', 'cart_threshold'], true)) {
            $actions['triggerType'] = $triggerType;
        }

        return $actions;
    }

    $map = [
        'sale' => ['discountType' => 'percent', 'discountValue' => 10, 'freeShipping' => false],
        'clearance-sale' => ['discountType' => 'percent', 'discountValue' => 10, 'freeShipping' => false],
        'summer-sale' => ['discountType' => 'percent', 'discountValue' => 6, 'freeShipping' => false],
        'category-sale' => ['discountType' => 'percent', 'discountValue' => 4, 'freeShipping' => false],
        'promo-group' => ['discountType' => 'percent', 'discountValue' => 7, 'freeShipping' => false],
        'flash-sale' => ['discountType' => 'percent', 'discountValue' => 15, 'freeShipping' => false, 'triggerType' => 'flash_sale'],
        'happy-hour' => ['discountType' => 'percent', 'discountValue' => 10, 'freeShipping' => false, 'triggerType' => 'happy_hour'],
        'threshold-offer' => ['discountType' => 'fixed', 'discountValue' => 200, 'freeShipping' => false, 'triggerType' => 'cart_threshold'],
        'free-shipping' => ['discountType' => 'none', 'discountValue' => 0, 'freeShipping' => true],
    ];

    $selected = $map[$offer] ?? ['discountType' => 'none', 'discountValue' => 0, 'freeShipping' => false];
    $actions = [
        'discountType' => $selected['discountType'],
        'discountValue' => (float)$selected['discountValue'],
        'freeShipping' => (bool)$selected['freeShipping'],
        'stackable' => false,
    ];

    $triggerType = str_replace('-', '_', strtolower(trim((string)($selected['triggerType'] ?? ''))));
    if (in_array($triggerType, ['flash_sale', 'happy_hour', 'cart_threshold'], true)) {
        $actions['triggerType'] = $triggerType;
    }

    return $actions;
}

function promo_normalize_status(mixed $value, bool $enabled = true): string
{
    if (!$enabled) {
        return 'inactive';
    }

    $status = strtolower(trim((string)$value));
    return in_array($status, ['draft', 'active', 'inactive', 'archived'], true) ? $status : 'active';
}

function sync_site_promos_to_database(array $settings, int $adminId): array
{
    if (!function_exists('promotions_table_ready') || !promotions_table_ready()) {
        return [];
    }

    $offers = isset($settings['offers']) && is_array($settings['offers']) ? $settings['offers'] : [];
    $legacyCampaigns = isset($offers['promoCampaigns']) && is_array($offers['promoCampaigns']) ? $offers['promoCampaigns'] : [];
    $promoStrip = isset($offers['promoStrip']) && is_array($offers['promoStrip']) ? $offers['promoStrip'] : [];

    $campaignsToSync = [];
    $hasPrimaryCampaign = false;

    foreach ($legacyCampaigns as $index => $campaign) {
        if (!is_array($campaign)) {
            continue;
        }

        $enabled = ($campaign['enabled'] ?? true) !== false;
        $isPrimary = !empty($campaign['isPrimary']);
        $hasPrimaryCampaign = $hasPrimaryCampaign || $isPrimary;
        $name = trim((string)($campaign['name'] ?? $campaign['text'] ?? 'Promo offer')) ?: 'Promo offer';
        $text = trim((string)($campaign['text'] ?? $campaign['name'] ?? $name)) ?: $name;
        $targetUrl = trim((string)($campaign['to'] ?? '/products')) ?: '/products';
        $sourceId = trim((string)($campaign['id'] ?? 'campaign-' . ($index + 1)));

        $campaignsToSync[] = [
            'code' => 'SITE_CAMPAIGN_' . strtoupper(str_replace('-', '_', promotion_slugify($sourceId))),
            'name' => $name,
            'text' => $text,
            'description' => 'Synced from admin site content',
            'target_url' => $targetUrl,
            'status' => promo_normalize_status($campaign['status'] ?? 'active', $enabled),
            'enabled' => $enabled,
            'is_primary' => $isPrimary,
            'priority' => max(1, (int)($campaign['priority'] ?? ($index + 1))),
            'start_date' => promotion_datetime_string($campaign['startAt'] ?? ''),
            'end_date' => promotion_datetime_string($campaign['endAt'] ?? ''),
        ];
    }

    $promoStripText = trim((string)($promoStrip['text'] ?? ''));
    $promoStripTarget = trim((string)($promoStrip['to'] ?? '/products')) ?: '/products';
    if ($promoStripText !== '' || $promoStripTarget !== '/products') {
        $promoStripEnabled = ($promoStrip['enabled'] ?? true) !== false;
        $campaignsToSync[] = [
            'code' => 'SITE_PROMO_STRIP',
            'name' => $promoStripText !== '' ? $promoStripText : 'Manual promo strip',
            'text' => $promoStripText !== '' ? $promoStripText : 'Manual promo strip',
            'description' => 'Manual promo strip synced into the promotions table for the live storefront banner',
            'target_url' => $promoStripTarget,
            'status' => promo_normalize_status('active', $promoStripEnabled),
            'enabled' => $promoStripEnabled,
            'is_primary' => true,
            'priority' => 1,
            'start_date' => '',
            'end_date' => '',
        ];
    }

    $syncedCodes = [];

    foreach ($campaignsToSync as $campaign) {
        $targetUrl = trim((string)($campaign['target_url'] ?? '/products')) ?: '/products';
        $params = promo_target_params($targetUrl);
        $offerType = strtolower(trim((string)($params['offer'] ?? 'promo-group')));
        $rawDisplayMode = strtolower(trim((string)($campaign['display_mode'] ?? $campaign['displayMode'] ?? '')));
        $displayMode = in_array($rawDisplayMode, ['banner', 'silent', 'both'], true)
            ? $rawDisplayMode
            : ($offerType === 'free-shipping' ? 'both' : 'banner');
        $conditions = [
            'offerType' => $offerType,
            'categoryNames' => promotion_parse_string_list($params['category'] ?? []),
            'productIds' => promotion_parse_id_list($params['ids'] ?? $params['productId'] ?? $params['promoProduct'] ?? []),
            'variantIds' => promotion_parse_id_list($params['variantIds'] ?? $params['variantId'] ?? []),
            'minCartSubtotal' => max(0, (float)($params['cartMin'] ?? $params['minPrice'] ?? 0)),
            'requiresSaleItem' => !empty($params['saleOnly']),
            'segments' => ['allowGuests' => true],
        ];
        $conditionsJson = json_encode($conditions, JSON_UNESCAPED_UNICODE);
        $actionsJson = json_encode(promo_actions_for_offer_type($offerType), JSON_UNESCAPED_UNICODE);

        try {
            $stmt = db()->prepare(
                'INSERT INTO promotions (code, name, banner_text, description, target_url, status, enabled, is_primary, priority, display_mode, conditions_json, actions_json, created_by, updated_by, start_date, end_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    name = ?, banner_text = ?, description = ?, target_url = ?, status = ?, enabled = ?, is_primary = ?, priority = ?, display_mode = ?, conditions_json = ?, actions_json = ?, updated_by = ?, start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP'
            );
            $stmt->execute([
                $campaign['code'],
                $campaign['name'],
                $campaign['text'],
                $campaign['description'],
                $targetUrl,
                $campaign['status'],
                $campaign['enabled'] ? 1 : 0,
                $campaign['is_primary'] ? 1 : 0,
                $campaign['priority'],
                $displayMode,
                $conditionsJson === false ? '{}' : $conditionsJson,
                $actionsJson === false ? '{}' : $actionsJson,
                $adminId > 0 ? $adminId : null,
                $adminId > 0 ? $adminId : null,
                $campaign['start_date'] !== '' ? $campaign['start_date'] : null,
                $campaign['end_date'] !== '' ? $campaign['end_date'] : null,
                $campaign['name'],
                $campaign['text'],
                $campaign['description'],
                $targetUrl,
                $campaign['status'],
                $campaign['enabled'] ? 1 : 0,
                $campaign['is_primary'] ? 1 : 0,
                $campaign['priority'],
                $displayMode,
                $conditionsJson === false ? '{}' : $conditionsJson,
                $actionsJson === false ? '{}' : $actionsJson,
                $adminId > 0 ? $adminId : null,
                $campaign['start_date'] !== '' ? $campaign['start_date'] : null,
                $campaign['end_date'] !== '' ? $campaign['end_date'] : null,
            ]);
            $syncedCodes[] = (string)$campaign['code'];
        } catch (Throwable) {
            // Keep site content save working even if promo DB sync fails.
        }
    }

    return $syncedCodes;
}

function strip_derived_offer_state(array $settings): array
{
    if (!isset($settings['offers']) || !is_array($settings['offers'])) {
        return $settings;
    }

    unset($settings['offers']['activePromoStrip'], $settings['offers']['activePromoCampaigns']);
    return $settings;
}

function promo_audit_snapshot(array $settings): array
{
    $settings = strip_derived_offer_state($settings);
    $offers = isset($settings['offers']) && is_array($settings['offers']) ? $settings['offers'] : [];
    $promoStrip = isset($offers['promoStrip']) && is_array($offers['promoStrip']) ? $offers['promoStrip'] : [];
    $promoCampaigns = isset($offers['promoCampaigns']) && is_array($offers['promoCampaigns']) ? $offers['promoCampaigns'] : [];

    $normalizedCampaigns = array_values(array_map(static function ($campaign): array {
        if (!is_array($campaign)) {
            return [];
        }

        return [
            'id' => (string)($campaign['id'] ?? ''),
            'name' => (string)($campaign['name'] ?? ''),
            'text' => (string)($campaign['text'] ?? ''),
            'to' => (string)($campaign['to'] ?? ''),
            'enabled' => ($campaign['enabled'] ?? true) !== false,
            'isPrimary' => !empty($campaign['isPrimary']),
            'startAt' => (string)($campaign['startAt'] ?? ''),
            'endAt' => (string)($campaign['endAt'] ?? ''),
        ];
    }, array_filter($promoCampaigns, 'is_array')));

    usort($normalizedCampaigns, static fn (array $a, array $b): int => strcmp($a['id'] ?? '', $b['id'] ?? ''));

    return [
        'promoStrip' => [
            'enabled' => ($promoStrip['enabled'] ?? true) !== false,
            'text' => (string)($promoStrip['text'] ?? ''),
            'to' => (string)($promoStrip['to'] ?? ''),
        ],
        'promoCampaigns' => $normalizedCampaigns,
    ];
}

if ($method === 'GET') {
    $settings = strip_derived_offer_state(load_site_content_settings());
    $syncedPromotionCodes = sync_site_promos_to_database($settings, (int)($admin['id'] ?? 0));
    ok([
        'settings' => $settings ?: new stdClass(),
        'syncedPromotionCodes' => $syncedPromotionCodes,
        'promotions' => promotions_list_all(),
        'templates' => function_exists('promotion_templates_list_all') ? promotion_templates_list_all() : [],
    ]);
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

$settings = strip_derived_offer_state($settings);
$existingSettings = strip_derived_offer_state(load_site_content_settings());
$previousPromoSnapshot = promo_audit_snapshot($existingSettings);
$nextPromoSnapshot = promo_audit_snapshot($settings);

save_site_content_settings($settings, (int)$admin['id']);
$syncedPromotionCodes = sync_site_promos_to_database($settings, (int)$admin['id']);

try {
    if (json_encode($previousPromoSnapshot, JSON_UNESCAPED_UNICODE) !== json_encode($nextPromoSnapshot, JSON_UNESCAPED_UNICODE)) {
        $promoCampaigns = $nextPromoSnapshot['promoCampaigns'] ?? [];
        log_admin_action(
            (int)$admin['id'],
            'promo_campaigns_update',
            'settings',
            'site_promos',
            [
                'previous_campaign_count' => count($previousPromoSnapshot['promoCampaigns'] ?? []),
                'campaign_count' => count($promoCampaigns),
                'primary_campaign_ids' => array_values(array_map(
                    static fn (array $campaign): string => (string)($campaign['id'] ?? ''),
                    array_values(array_filter($promoCampaigns, static fn (array $campaign): bool => !empty($campaign['isPrimary'])))
                )),
                'promo_strip_target' => (string)($nextPromoSnapshot['promoStrip']['to'] ?? ''),
            ]
        );
    }

    log_admin_action(
        (int)$admin['id'],
        'site_content_update',
        'settings',
        'site_content',
        [
            'updated_sections' => array_keys($settings),
        ]
    );
} catch (Throwable) {
    // Keep API successful even when audit log storage is unavailable.
}

ok([
    'message' => 'Site content saved',
    'syncedPromotionCodes' => $syncedPromotionCodes,
    'promotions' => promotions_list_all(),
    'templates' => function_exists('promotion_templates_list_all') ? promotion_templates_list_all() : [],
]);
