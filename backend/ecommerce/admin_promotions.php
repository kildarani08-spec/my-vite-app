<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$admin = auth_user(true);
$method = $_SERVER['REQUEST_METHOD'];

function promo_parse_target_params(string $targetUrl): array
{
    $query = parse_url($targetUrl, PHP_URL_QUERY);
    if (!is_string($query) || $query === '') {
        return [];
    }

    parse_str($query, $params);
    return is_array($params) ? $params : [];
}

function promo_default_actions(string $offerType, array $input = []): array
{
    $offer = strtolower(trim($offerType));
    $discountType = str_replace('-', '_', strtolower(trim((string)($input['discountType'] ?? ''))));
    $triggerType = str_replace('-', '_', strtolower(trim((string)($input['triggerType'] ?? ''))));

    if ($discountType === 'flash_sale') {
        $triggerType = $triggerType !== '' ? $triggerType : 'flash_sale';
        $discountType = 'percent';
    }
    if ($discountType === 'happy_hour') {
        $triggerType = $triggerType !== '' ? $triggerType : 'happy_hour';
        $discountType = 'percent';
    }
    if ($discountType === 'threshold_fixed') {
        $triggerType = $triggerType !== '' ? $triggerType : 'cart_threshold';
        $discountType = 'fixed';
    }
    if ($discountType === 'threshold_percent') {
        $triggerType = $triggerType !== '' ? $triggerType : 'cart_threshold';
        $discountType = 'percent';
    }

    $discountValue = (float)($input['discountValue'] ?? 0);
    $freeShipping = !empty($input['freeShipping']);
    $buyQuantity = max(1, (int)($input['buyQuantity'] ?? 2));
    $freeQuantity = max(1, (int)($input['freeQuantity'] ?? 1));
    $stackable = !empty($input['stackable']);

    if ($discountType === '') {
        $template = function_exists('promotion_template_by_offer') ? promotion_template_by_offer($offer) : [];
        $templateActions = is_array($template['actions'] ?? null) ? $template['actions'] : [];

        if ($templateActions) {
            $templateDiscountType = str_replace('-', '_', strtolower(trim((string)($templateActions['discountType'] ?? 'none'))));
            $templateTriggerType = str_replace('-', '_', strtolower(trim((string)($templateActions['triggerType'] ?? ''))));
            $discountType = $templateDiscountType;
            $triggerType = $triggerType !== '' ? $triggerType : $templateTriggerType;
            $discountValue = (float)($templateActions['discountValue'] ?? 0);
            $freeShipping = !empty($templateActions['freeShipping']);
            $stackable = !empty($input['stackable']) || !empty($templateActions['stackable']);
            $buyQuantity = max(1, (int)($templateActions['buyQuantity'] ?? $buyQuantity));
            $freeQuantity = max(1, (int)($templateActions['freeQuantity'] ?? $freeQuantity));
        } else {
            $map = [
                'sale' => ['discountType' => 'percent', 'discountValue' => 10, 'freeShipping' => false],
                'clearance-sale' => ['discountType' => 'percent', 'discountValue' => 10, 'freeShipping' => false],
                'summer-sale' => ['discountType' => 'percent', 'discountValue' => 6, 'freeShipping' => false],
                'category-sale' => ['discountType' => 'percent', 'discountValue' => 4, 'freeShipping' => false],
                'promo-group' => ['discountType' => 'percent', 'discountValue' => 7, 'freeShipping' => false],
                'buy-x-get-y' => ['discountType' => 'buy_x_get_y', 'discountValue' => 0, 'freeShipping' => false],
                'flash-sale' => ['discountType' => 'percent', 'discountValue' => 15, 'freeShipping' => false, 'triggerType' => 'flash_sale'],
                'happy-hour' => ['discountType' => 'percent', 'discountValue' => 10, 'freeShipping' => false, 'triggerType' => 'happy_hour'],
                'threshold-offer' => ['discountType' => 'fixed', 'discountValue' => 200, 'freeShipping' => false, 'triggerType' => 'cart_threshold'],
                'free-shipping' => ['discountType' => 'none', 'discountValue' => 0, 'freeShipping' => true],
            ];
            $selected = $map[$offer] ?? ['discountType' => 'none', 'discountValue' => 0, 'freeShipping' => false];
            $discountType = $selected['discountType'];
            $discountValue = (float)($selected['discountValue'] ?? 0);
            $freeShipping = !empty($selected['freeShipping']);
            $triggerType = $triggerType !== '' ? $triggerType : str_replace('-', '_', strtolower(trim((string)($selected['triggerType'] ?? ''))));
        }
    }

    $normalizedTriggerType = in_array($triggerType, ['flash_sale', 'happy_hour', 'cart_threshold'], true) ? $triggerType : '';
    $actions = [
        'discountType' => in_array($discountType, ['percent', 'fixed', 'none', 'buy_x_get_y', 'bundle_fixed_total'], true) ? $discountType : 'none',
        'discountValue' => max(0, $discountValue),
        'freeShipping' => $freeShipping,
        'stackable' => $stackable,
        'buyQuantity' => $buyQuantity,
        'freeQuantity' => $freeQuantity,
    ];

    if ($normalizedTriggerType !== '') {
        $actions['triggerType'] = $normalizedTriggerType;
    }

    return $actions;
}

function promo_payload_from_input(array $input): array
{
    $id = (int)($input['id'] ?? 0);
    $name = trim((string)($input['name'] ?? ''));
    if ($name === '') {
        fail('Promo name is required', 422);
    }

    $targetUrl = trim((string)($input['targetUrl'] ?? $input['target_url'] ?? $input['to'] ?? '/products'));
    if ($targetUrl === '') {
        $targetUrl = '/products';
    }

    $params = promo_parse_target_params($targetUrl);
    $offerType = strtolower(trim((string)($input['offerType'] ?? $params['offer'] ?? 'promo-group')));
    $status = strtolower(trim((string)($input['status'] ?? 'active')));
    if (!in_array($status, ['draft', 'active', 'inactive', 'archived'], true)) {
        $status = 'active';
    }

    $conditionsInput = isset($input['conditions']) && is_array($input['conditions']) ? $input['conditions'] : [];
    $actionsInput = isset($input['actions']) && is_array($input['actions']) ? $input['actions'] : [];

    $minCartSubtotal = (float)($conditionsInput['minCartSubtotal'] ?? $conditionsInput['minCartTotal'] ?? $params['cartMin'] ?? $params['minPrice'] ?? 0);
    $categoryNames = $conditionsInput['categoryNames'] ?? $conditionsInput['categories'] ?? ($params['category'] ?? '');
    $productIds = $conditionsInput['productIds'] ?? ($params['ids'] ?? $params['productId'] ?? $params['promoProduct'] ?? []);
    $variantIds = $conditionsInput['variantIds'] ?? ($params['variantIds'] ?? $params['variantId'] ?? []);
    $segments = isset($conditionsInput['segments']) && is_array($conditionsInput['segments'])
        ? $conditionsInput['segments']
        : [
            'roles' => $input['segmentRoles'] ?? [],
            'cities' => $input['segmentCities'] ?? [],
            'states' => $input['segmentStates'] ?? [],
            'emailDomains' => $input['segmentEmailDomains'] ?? [],
            'allowGuests' => ($input['allowGuests'] ?? true) !== false,
        ];

    $conditions = [
        'offerType' => $offerType,
        'categoryNames' => promotion_parse_string_list($categoryNames),
        'productIds' => promotion_parse_id_list($productIds),
        'variantIds' => promotion_parse_id_list($variantIds),
        'minCartSubtotal' => max(0, $minCartSubtotal),
        'requiresSaleItem' => !empty($conditionsInput['requiresSaleItem']),
        'segments' => [
            'roles' => promotion_parse_string_list($segments['roles'] ?? []),
            'cities' => promotion_parse_string_list($segments['cities'] ?? []),
            'states' => promotion_parse_string_list($segments['states'] ?? []),
            'emailDomains' => promotion_parse_string_list($segments['emailDomains'] ?? []),
            'allowGuests' => ($segments['allowGuests'] ?? true) !== false,
        ],
    ];

    $actions = promo_default_actions($offerType, array_merge($actionsInput, $input));

    return [
        'id' => $id,
        'code' => trim((string)($input['code'] ?? '')) ?: strtoupper(str_replace('-', '_', promotion_slugify($name))),
        'name' => $name,
        'banner_text' => trim((string)($input['bannerText'] ?? $input['banner_text'] ?? $input['text'] ?? $name)),
        'description' => trim((string)($input['description'] ?? '')),
        'target_url' => $targetUrl,
        'status' => $status,
        'enabled' => ($input['enabled'] ?? true) !== false,
        'is_primary' => !empty($input['isPrimary']) || !empty($input['is_primary']),
        'priority' => max(1, (int)($input['priority'] ?? 100)),
        'display_mode' => in_array((string)($input['displayMode'] ?? $input['display_mode'] ?? 'both'), ['banner', 'silent', 'both'], true)
            ? (string)($input['displayMode'] ?? $input['display_mode'] ?? 'both')
            : 'both',
        'start_date' => promotion_datetime_string($input['startAt'] ?? $input['start_date'] ?? ''),
        'end_date' => promotion_datetime_string($input['endAt'] ?? $input['end_date'] ?? ''),
        'conditions_json' => $conditions,
        'actions_json' => $actions,
    ];
}

function promo_fetch_by_id(int $id): ?array
{
    if ($id <= 0 || !promotions_table_ready()) {
        return null;
    }

    $stmt = db()->prepare('SELECT * FROM promotions WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? promotion_normalize_row($row) : null;
}

if ($method === 'GET') {
    ok([
        'promotions' => promotions_list_all(),
        'templates' => function_exists('promotion_templates_list_all') ? promotion_templates_list_all() : [],
    ]);
}

if ($method !== 'POST') {
    fail('Method not allowed', 405);
}

$body = json_input();
$action = strtolower(trim((string)($body['action'] ?? '')));

if ($action === 'delete') {
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        fail('Promo id is required', 422);
    }

    $existing = promo_fetch_by_id($id);
    if (!$existing) {
        fail('Promo not found', 404);
    }

    $stmt = db()->prepare('DELETE FROM promotions WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);

    try {
        log_admin_action((int)$admin['id'], 'promo_delete', 'promotion', (string)$id, [
            'code' => $existing['code'] ?? '',
            'name' => $existing['name'] ?? '',
        ]);
    } catch (Throwable) {
        // Do not block admin delete when audit storage is unavailable.
    }

    ok(['message' => 'Promo deleted']);
}

if ($action !== 'upsert') {
    fail('Invalid action', 422);
}

$promotion = promo_payload_from_input($body['promotion'] ?? $body);

$startTs = promotion_datetime_ts($promotion['start_date']);
$endTs = promotion_datetime_ts($promotion['end_date']);
if ($startTs !== null && $endTs !== null && $endTs < $startTs) {
    fail('Promo end date must be after the start date', 422);
}

if ($promotion['is_primary']) {
    db()->exec('UPDATE promotions SET is_primary = 0');
}

$conditionsJson = json_encode($promotion['conditions_json'], JSON_UNESCAPED_UNICODE);
$actionsJson = json_encode($promotion['actions_json'], JSON_UNESCAPED_UNICODE);

if (!promotions_table_ready()) {
    fail('Promotions table is unavailable', 500);
}

if ($promotion['id'] > 0) {
    $stmt = db()->prepare(
        'UPDATE promotions
         SET code = ?, name = ?, banner_text = ?, description = ?, target_url = ?, status = ?, enabled = ?, is_primary = ?, priority = ?, display_mode = ?, conditions_json = ?, actions_json = ?, updated_by = ?, start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?'
    );
    $stmt->execute([
        $promotion['code'],
        $promotion['name'],
        $promotion['banner_text'],
        $promotion['description'] !== '' ? $promotion['description'] : null,
        $promotion['target_url'],
        $promotion['status'],
        $promotion['enabled'] ? 1 : 0,
        $promotion['is_primary'] ? 1 : 0,
        $promotion['priority'],
        $promotion['display_mode'],
        $conditionsJson === false ? '{}' : $conditionsJson,
        $actionsJson === false ? '{}' : $actionsJson,
        (int)$admin['id'],
        $promotion['start_date'] !== '' ? $promotion['start_date'] : null,
        $promotion['end_date'] !== '' ? $promotion['end_date'] : null,
        $promotion['id'],
    ]);
    $savedId = $promotion['id'];
    $auditAction = 'promo_update';
} else {
    $stmt = db()->prepare(
        'INSERT INTO promotions (code, name, banner_text, description, target_url, status, enabled, is_primary, priority, display_mode, conditions_json, actions_json, created_by, updated_by, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $promotion['code'],
        $promotion['name'],
        $promotion['banner_text'],
        $promotion['description'] !== '' ? $promotion['description'] : null,
        $promotion['target_url'],
        $promotion['status'],
        $promotion['enabled'] ? 1 : 0,
        $promotion['is_primary'] ? 1 : 0,
        $promotion['priority'],
        $promotion['display_mode'],
        $conditionsJson === false ? '{}' : $conditionsJson,
        $actionsJson === false ? '{}' : $actionsJson,
        (int)$admin['id'],
        (int)$admin['id'],
        $promotion['start_date'] !== '' ? $promotion['start_date'] : null,
        $promotion['end_date'] !== '' ? $promotion['end_date'] : null,
    ]);
    $savedId = (int)db()->lastInsertId();
    $auditAction = 'promo_create';
}

$savedPromo = promo_fetch_by_id((int)$savedId);

try {
    log_admin_action((int)$admin['id'], $auditAction, 'promotion', (string)$savedId, [
        'code' => $promotion['code'],
        'name' => $promotion['name'],
        'status' => $promotion['status'],
        'priority' => $promotion['priority'],
        'display_mode' => $promotion['display_mode'],
        'target_url' => $promotion['target_url'],
    ]);
} catch (Throwable) {
    // Keep API successful even when audit storage is unavailable.
}

ok([
    'message' => 'Promo saved',
    'promotion' => $savedPromo,
    'promotions' => promotions_list_all(),
]);
