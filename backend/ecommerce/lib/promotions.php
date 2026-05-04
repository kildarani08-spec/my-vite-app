<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';

function promotions_table_ready(): bool
{
    static $ready = null;
    if ($ready !== null) {
        return $ready;
    }

    try {
        if (function_exists('db_table_exists') && db_table_exists('promotions')) {
            $ready = true;
            return true;
        }

        db()->exec(
            "CREATE TABLE IF NOT EXISTS promotions (
                id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
                code VARCHAR(80) NOT NULL UNIQUE,
                name VARCHAR(160) NOT NULL,
                banner_text VARCHAR(255) DEFAULT NULL,
                description TEXT DEFAULT NULL,
                target_url VARCHAR(255) DEFAULT '/products',
                status ENUM('draft', 'active', 'inactive', 'archived') NOT NULL DEFAULT 'draft',
                enabled TINYINT(1) NOT NULL DEFAULT 1,
                is_primary TINYINT(1) NOT NULL DEFAULT 0,
                priority INT NOT NULL DEFAULT 100,
                display_mode ENUM('banner', 'silent', 'both') NOT NULL DEFAULT 'both',
                conditions_json JSON DEFAULT NULL,
                actions_json JSON DEFAULT NULL,
                created_by BIGINT UNSIGNED DEFAULT NULL,
                updated_by BIGINT UNSIGNED DEFAULT NULL,
                start_date DATETIME DEFAULT NULL,
                end_date DATETIME DEFAULT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY idx_promotions_status (status, enabled, start_date, end_date),
                KEY idx_promotions_priority (priority, is_primary),
                KEY idx_promotions_created_by (created_by),
                KEY idx_promotions_updated_by (updated_by)
            )"
        );
        $ready = true;
    } catch (Throwable) {
        $ready = false;
    }

    return $ready;
}

function promotion_default_template_rows(): array
{
    return [
        [
            'code' => 'DEFAULT_SALE',
            'offerType' => 'sale',
            'label' => 'On Sale',
            'hint' => 'Always-on or seasonal catalog markdowns',
            'description' => 'Wide catalog markdown campaign template.',
            'bannerTemplate' => 'Storewide Sale – extra 10% off today',
            'defaultDiscount' => '10% off eligible items',
            'taxMode' => 'Standard checkout tax rules',
            'shippingMode' => 'Store shipping rules',
            'threshold' => 999,
            'shippingFee' => 80,
            'progressTemplate' => 'Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.',
            'unlockedText' => 'Free shipping applied.',
            'summary' => 'Use for wide catalog markdowns or festival sale periods.',
            'example' => 'Example: Weekend sale on all discounted products.',
            'multiOfferTip' => 'Best kept non-stackable so the highest-priority discount wins cleanly.',
            'conditions' => ['offerType' => 'sale', 'segments' => ['allowGuests' => true]],
            'actions' => ['discountType' => 'percent', 'discountValue' => 10, 'freeShipping' => false, 'stackable' => false],
            'sortOrder' => 10,
            'enabled' => true,
        ],
        [
            'code' => 'DEFAULT_CLEARANCE',
            'offerType' => 'clearance-sale',
            'label' => 'Clearance Sale',
            'hint' => 'Extra discount on already marked-down clearance picks',
            'description' => 'End-of-season clearance template.',
            'bannerTemplate' => 'Clearance Sale – extra 10% off, tax included',
            'defaultDiscount' => 'Extra 10% off clearance items',
            'taxMode' => 'Standard checkout tax rules',
            'shippingMode' => 'Store shipping rules',
            'threshold' => 499,
            'shippingFee' => 49,
            'progressTemplate' => 'Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.',
            'unlockedText' => 'Free shipping applied.',
            'summary' => 'Good for end-of-season clearance or fast stock cleanup.',
            'example' => 'Example: Books clearance sale this week only.',
            'multiOfferTip' => 'Use a higher priority than regular sales when you want clearance to win first.',
            'conditions' => ['offerType' => 'clearance-sale', 'requiresSaleItem' => true, 'segments' => ['allowGuests' => true]],
            'actions' => ['discountType' => 'percent', 'discountValue' => 10, 'freeShipping' => false, 'stackable' => false],
            'sortOrder' => 20,
            'enabled' => true,
        ],
        [
            'code' => 'DEFAULT_SUMMER',
            'offerType' => 'summer-sale',
            'label' => 'Summer Sale',
            'hint' => 'Seasonal apparel and warm-weather picks',
            'description' => 'Seasonal sale template for time-bound campaigns.',
            'bannerTemplate' => 'Summer Sale – extra 6% off styles',
            'defaultDiscount' => '6% off eligible styles',
            'taxMode' => 'Standard checkout tax rules',
            'shippingMode' => 'Store shipping rules',
            'threshold' => 699,
            'shippingFee' => 59,
            'progressTemplate' => 'Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.',
            'unlockedText' => 'Free shipping applied.',
            'summary' => 'Useful for seasonal campaigns with banner + pricing sync.',
            'example' => 'Example: Summer collection extra 6% off.',
            'multiOfferTip' => 'Can run with a banner while other silent promos remain active.',
            'conditions' => ['offerType' => 'summer-sale', 'segments' => ['allowGuests' => true]],
            'actions' => ['discountType' => 'percent', 'discountValue' => 6, 'freeShipping' => false, 'stackable' => false],
            'sortOrder' => 30,
            'enabled' => true,
        ],
        [
            'code' => 'DEFAULT_CATEGORY',
            'offerType' => 'category-sale',
            'label' => 'Category Sale',
            'hint' => 'Discounted items in one category',
            'description' => 'Category-focused discount template.',
            'bannerTemplate' => 'Category Sale – extra 4% off today',
            'defaultDiscount' => '4% off eligible category items',
            'taxMode' => 'Standard checkout tax rules',
            'shippingMode' => 'Store shipping rules',
            'threshold' => 799,
            'shippingFee' => 69,
            'progressTemplate' => 'Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.',
            'unlockedText' => 'Free shipping applied.',
            'summary' => 'Target one category without changing the whole store banner system.',
            'example' => 'Example: Extra off only on Books or T-shirts.',
            'multiOfferTip' => 'Ideal when multiple categories each need separate promotions.',
            'conditions' => ['offerType' => 'category-sale', 'segments' => ['allowGuests' => true]],
            'actions' => ['discountType' => 'percent', 'discountValue' => 4, 'freeShipping' => false, 'stackable' => false],
            'sortOrder' => 40,
            'enabled' => true,
        ],
        [
            'code' => 'DEFAULT_PROMO_GROUP',
            'offerType' => 'promo-group',
            'label' => 'Selected Products',
            'hint' => 'Hand-pick exact products or variants',
            'description' => 'Targeted SKU or product collection promo template.',
            'bannerTemplate' => 'Special deals on selected products',
            'defaultDiscount' => '7% off selected products or variants',
            'taxMode' => 'Standard checkout tax rules',
            'shippingMode' => 'Store shipping rules',
            'threshold' => 599,
            'shippingFee' => 49,
            'progressTemplate' => 'Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.',
            'unlockedText' => 'Free shipping applied.',
            'summary' => 'Hand-pick products or variants for brand deals and featured collections.',
            'example' => 'Example: New arrivals promo on selected SKUs.',
            'multiOfferTip' => 'Useful for running multiple product-specific deals together.',
            'conditions' => ['offerType' => 'promo-group', 'segments' => ['allowGuests' => true]],
            'actions' => ['discountType' => 'percent', 'discountValue' => 7, 'freeShipping' => false, 'stackable' => false],
            'sortOrder' => 50,
            'enabled' => true,
        ],
        [
            'code' => 'DEFAULT_BUNDLE',
            'offerType' => 'buy-x-get-y',
            'label' => 'Buy X Get Y',
            'hint' => 'Bundle deals like buy 2 T-shirts, get 1 free',
            'description' => 'Classic ecommerce bundle deal template.',
            'bannerTemplate' => 'Buy 2, get 1 free on selected styles',
            'defaultDiscount' => 'Cheapest eligible item becomes free',
            'taxMode' => 'Standard checkout tax rules',
            'shippingMode' => 'Store shipping rules',
            'threshold' => 699,
            'shippingFee' => 59,
            'progressTemplate' => 'Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.',
            'unlockedText' => 'Free shipping applied.',
            'summary' => 'Set bundle rules like buy 2 get 1 free, common in real ecommerce campaigns.',
            'example' => 'Example: Buy 2 T-shirts, get 1 T-shirt free.',
            'multiOfferTip' => 'Best when paired with product or category targeting so the bundle applies only where expected.',
            'conditions' => ['offerType' => 'buy-x-get-y', 'segments' => ['allowGuests' => true]],
            'actions' => ['discountType' => 'buy_x_get_y', 'discountValue' => 0, 'freeShipping' => false, 'stackable' => false, 'buyQuantity' => 2, 'freeQuantity' => 1],
            'sortOrder' => 60,
            'enabled' => true,
        ],
        [
            'code' => 'DEFAULT_FLASH_SALE',
            'offerType' => 'flash-sale',
            'label' => 'Flash Sale',
            'hint' => 'Short-window deals with start/end timing',
            'description' => 'Time-based flash sale template for limited windows.',
            'bannerTemplate' => 'Flash Sale – extra 15% off for a limited time',
            'defaultDiscount' => '15% off during the scheduled window',
            'taxMode' => 'Standard checkout tax rules',
            'shippingMode' => 'Store shipping rules',
            'threshold' => 699,
            'shippingFee' => 59,
            'progressTemplate' => 'Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.',
            'unlockedText' => 'Free shipping applied.',
            'summary' => 'Best for short bursts like evening flash deals or countdown campaigns.',
            'example' => 'Example: 6 PM to 10 PM flash sale on books.',
            'multiOfferTip' => 'Use the schedule fields so the offer starts and ends automatically.',
            'conditions' => ['offerType' => 'flash-sale', 'segments' => ['allowGuests' => true]],
            'actions' => ['discountType' => 'percent', 'discountValue' => 15, 'triggerType' => 'flash_sale', 'freeShipping' => false, 'stackable' => false],
            'sortOrder' => 65,
            'enabled' => true,
        ],
        [
            'code' => 'DEFAULT_HAPPY_HOUR',
            'offerType' => 'happy-hour',
            'label' => 'Happy Hour',
            'hint' => 'Quick promo windows for lunch or evening peaks',
            'description' => 'Time-based happy-hour template for short daily bursts.',
            'bannerTemplate' => 'Happy Hour – extra 10% off right now',
            'defaultDiscount' => '10% off during the happy-hour window',
            'taxMode' => 'Standard checkout tax rules',
            'shippingMode' => 'Store shipping rules',
            'threshold' => 699,
            'shippingFee' => 59,
            'progressTemplate' => 'Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.',
            'unlockedText' => 'Free shipping applied.',
            'summary' => 'Great for midday or evening conversion pushes without a full-day sale.',
            'example' => 'Example: Happy hour 1 PM to 3 PM, extra 10% off.',
            'multiOfferTip' => 'Keep the schedule short and the banner clear so shoppers trust the urgency.',
            'conditions' => ['offerType' => 'happy-hour', 'segments' => ['allowGuests' => true]],
            'actions' => ['discountType' => 'percent', 'discountValue' => 10, 'triggerType' => 'happy_hour', 'freeShipping' => false, 'stackable' => false],
            'sortOrder' => 67,
            'enabled' => true,
        ],
        [
            'code' => 'DEFAULT_THRESHOLD',
            'offerType' => 'threshold-offer',
            'label' => 'Spend & Save',
            'hint' => 'Threshold-based offers like spend Rs.2000, get Rs.200 off',
            'description' => 'Cart-threshold discount template.',
            'bannerTemplate' => 'Spend Rs.2000, get Rs.200 off',
            'defaultDiscount' => 'Rs.200 off on carts above Rs.2000',
            'taxMode' => 'Standard checkout tax rules',
            'shippingMode' => 'Store shipping rules',
            'threshold' => 2000,
            'shippingFee' => 80,
            'progressTemplate' => 'Add Rs.{remaining} more to reach Rs.{threshold} and unlock this offer.',
            'unlockedText' => 'Threshold offer applied.',
            'summary' => 'Perfect for basket-building promotions like spend more, save more.',
            'example' => 'Example: Spend Rs.2000, get Rs.200 off instantly.',
            'multiOfferTip' => 'Works best with a clear minimum cart total so the cart and checkout feel predictable.',
            'conditions' => ['offerType' => 'threshold-offer', 'minCartSubtotal' => 2000, 'segments' => ['allowGuests' => true]],
            'actions' => ['discountType' => 'fixed', 'discountValue' => 200, 'triggerType' => 'cart_threshold', 'freeShipping' => false, 'stackable' => false],
            'sortOrder' => 68,
            'enabled' => true,
        ],
        [
            'code' => 'DEFAULT_FREE_SHIPPING',
            'offerType' => 'free-shipping',
            'label' => 'Free Shipping',
            'hint' => 'Focus on delivery-threshold campaigns',
            'description' => 'Cart-threshold free delivery template.',
            'bannerTemplate' => 'Free shipping on orders over Rs.999',
            'defaultDiscount' => 'No price cut, delivery perk only',
            'taxMode' => 'Standard checkout tax rules',
            'shippingMode' => 'Free shipping threshold active',
            'threshold' => 999,
            'shippingFee' => 80,
            'progressTemplate' => 'Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.',
            'unlockedText' => 'Free shipping applied.',
            'summary' => 'Use this when you want delivery incentive without reducing item price.',
            'example' => 'Example: Free shipping above Rs.999 for a weekend campaign.',
            'multiOfferTip' => 'Works well as stackable because it can sit alongside item discounts.',
            'conditions' => ['offerType' => 'free-shipping', 'minCartSubtotal' => 999, 'segments' => ['allowGuests' => true]],
            'actions' => ['discountType' => 'none', 'discountValue' => 0, 'freeShipping' => true, 'stackable' => true],
            'sortOrder' => 70,
            'enabled' => true,
        ],
    ];
}

function promotion_templates_table_ready(): bool
{
    static $ready = null;
    if ($ready !== null) {
        return $ready;
    }

    try {
        if (!function_exists('db_table_exists') || !db_table_exists('promotion_templates')) {
            db()->exec(
                "CREATE TABLE IF NOT EXISTS promotion_templates (
                    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
                    code VARCHAR(80) NOT NULL UNIQUE,
                    offer_type VARCHAR(80) NOT NULL,
                    name VARCHAR(160) NOT NULL,
                    hint VARCHAR(255) DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    banner_template VARCHAR(255) DEFAULT NULL,
                    presentation_json JSON DEFAULT NULL,
                    conditions_json JSON DEFAULT NULL,
                    actions_json JSON DEFAULT NULL,
                    sort_order INT NOT NULL DEFAULT 100,
                    enabled TINYINT(1) NOT NULL DEFAULT 1,
                    is_builtin TINYINT(1) NOT NULL DEFAULT 1,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    KEY idx_promotion_templates_enabled (enabled, sort_order),
                    KEY idx_promotion_templates_offer (offer_type)
                )"
            );
        }

        $ready = true;
    } catch (Throwable) {
        $ready = false;
    }

    if ($ready) {
        promotion_seed_default_templates();
    }

    return $ready;
}

function promotion_seed_default_templates(): void
{
    static $seeded = false;
    if ($seeded || !promotion_templates_table_ready()) {
        return;
    }

    $seeded = true;

    try {
        $stmt = db()->prepare(
            'INSERT INTO promotion_templates (code, offer_type, name, hint, description, banner_template, presentation_json, conditions_json, actions_json, sort_order, enabled, is_builtin)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                offer_type = VALUES(offer_type),
                name = VALUES(name),
                hint = VALUES(hint),
                description = VALUES(description),
                banner_template = VALUES(banner_template),
                presentation_json = VALUES(presentation_json),
                conditions_json = VALUES(conditions_json),
                actions_json = VALUES(actions_json),
                sort_order = VALUES(sort_order),
                enabled = VALUES(enabled),
                is_builtin = VALUES(is_builtin),
                updated_at = CURRENT_TIMESTAMP'
        );

        foreach (promotion_default_template_rows() as $template) {
            $presentationJson = json_encode([
                'defaultDiscount' => $template['defaultDiscount'] ?? '',
                'taxMode' => $template['taxMode'] ?? '',
                'shippingMode' => $template['shippingMode'] ?? '',
                'threshold' => $template['threshold'] ?? 0,
                'shippingFee' => $template['shippingFee'] ?? 0,
                'progressTemplate' => $template['progressTemplate'] ?? '',
                'unlockedText' => $template['unlockedText'] ?? '',
                'summary' => $template['summary'] ?? '',
                'example' => $template['example'] ?? '',
                'multiOfferTip' => $template['multiOfferTip'] ?? '',
            ], JSON_UNESCAPED_UNICODE);

            $conditionsJson = json_encode($template['conditions'] ?? [], JSON_UNESCAPED_UNICODE);
            $actionsJson = json_encode($template['actions'] ?? [], JSON_UNESCAPED_UNICODE);

            $stmt->execute([
                (string)($template['code'] ?? ''),
                (string)($template['offerType'] ?? ''),
                (string)($template['label'] ?? 'Promo template'),
                (string)($template['hint'] ?? ''),
                (string)($template['description'] ?? ''),
                (string)($template['bannerTemplate'] ?? ''),
                $presentationJson === false ? '{}' : $presentationJson,
                $conditionsJson === false ? '{}' : $conditionsJson,
                $actionsJson === false ? '{}' : $actionsJson,
                max(1, (int)($template['sortOrder'] ?? 100)),
                !empty($template['enabled']) ? 1 : 0,
                1,
            ]);
        }
    } catch (Throwable) {
        // Keep promo engine working even when template seeding fails.
    }
}

function promotion_template_normalize_row(array $row): array
{
    $presentation = promotion_json_decode($row['presentation_json'] ?? []);
    $conditions = promotion_json_decode($row['conditions_json'] ?? []);
    $actions = promotion_json_decode($row['actions_json'] ?? []);

    return [
        'id' => (int)($row['id'] ?? 0),
        'code' => (string)($row['code'] ?? ''),
        'value' => (string)($row['offer_type'] ?? ''),
        'offerType' => (string)($row['offer_type'] ?? ''),
        'label' => (string)($row['name'] ?? 'Promo template'),
        'name' => (string)($row['name'] ?? 'Promo template'),
        'hint' => (string)($row['hint'] ?? ''),
        'description' => (string)($row['description'] ?? ''),
        'bannerTemplate' => (string)($row['banner_template'] ?? ''),
        'defaultDiscount' => (string)($presentation['defaultDiscount'] ?? ''),
        'taxMode' => (string)($presentation['taxMode'] ?? 'Standard checkout tax rules'),
        'shippingMode' => (string)($presentation['shippingMode'] ?? 'Store shipping rules'),
        'threshold' => max(0, (float)($presentation['threshold'] ?? 0)),
        'shippingFee' => max(0, (float)($presentation['shippingFee'] ?? 0)),
        'progressTemplate' => (string)($presentation['progressTemplate'] ?? ''),
        'unlockedText' => (string)($presentation['unlockedText'] ?? ''),
        'summary' => (string)($presentation['summary'] ?? ''),
        'example' => (string)($presentation['example'] ?? ''),
        'multiOfferTip' => (string)($presentation['multiOfferTip'] ?? ''),
        'conditions' => $conditions,
        'actions' => $actions,
        'sortOrder' => max(1, (int)($row['sort_order'] ?? 100)),
        'enabled' => ($row['enabled'] ?? true) !== false,
        'isBuiltin' => !empty($row['is_builtin']),
    ];
}

function promotion_templates_list_all(): array
{
    if (!promotion_templates_table_ready()) {
        return array_values(array_filter(array_map(static function (array $template): array {
            return [
                'id' => 0,
                'code' => (string)($template['code'] ?? ''),
                'value' => (string)($template['offerType'] ?? ''),
                'offerType' => (string)($template['offerType'] ?? ''),
                'label' => (string)($template['label'] ?? 'Promo template'),
                'name' => (string)($template['label'] ?? 'Promo template'),
                'hint' => (string)($template['hint'] ?? ''),
                'description' => (string)($template['description'] ?? ''),
                'bannerTemplate' => (string)($template['bannerTemplate'] ?? ''),
                'defaultDiscount' => (string)($template['defaultDiscount'] ?? ''),
                'taxMode' => (string)($template['taxMode'] ?? ''),
                'shippingMode' => (string)($template['shippingMode'] ?? ''),
                'threshold' => max(0, (float)($template['threshold'] ?? 0)),
                'shippingFee' => max(0, (float)($template['shippingFee'] ?? 0)),
                'progressTemplate' => (string)($template['progressTemplate'] ?? ''),
                'unlockedText' => (string)($template['unlockedText'] ?? ''),
                'summary' => (string)($template['summary'] ?? ''),
                'example' => (string)($template['example'] ?? ''),
                'multiOfferTip' => (string)($template['multiOfferTip'] ?? ''),
                'conditions' => is_array($template['conditions'] ?? null) ? $template['conditions'] : [],
                'actions' => is_array($template['actions'] ?? null) ? $template['actions'] : [],
                'sortOrder' => max(1, (int)($template['sortOrder'] ?? 100)),
                'enabled' => ($template['enabled'] ?? true) !== false,
                'isBuiltin' => true,
            ];
        }, promotion_default_template_rows())));
    }

    $stmt = db()->query('SELECT * FROM promotion_templates WHERE enabled = 1 ORDER BY sort_order ASC, name ASC, id ASC');
    $rows = $stmt ? $stmt->fetchAll() : [];
    return array_values(array_map('promotion_template_normalize_row', is_array($rows) ? $rows : []));
}

function promotion_template_by_offer(string $offerType): array
{
    $normalizedOfferType = strtolower(trim($offerType));
    foreach (promotion_templates_list_all() as $template) {
        $templateOfferType = strtolower(trim((string)($template['offerType'] ?? $template['value'] ?? '')));
        if ($templateOfferType === $normalizedOfferType) {
            return $template;
        }
    }

    return [];
}

function promotion_category_pk(): string
{
    static $pk = null;
    if ($pk !== null) {
        return $pk;
    }

    try {
        $stmt = db()->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1');
        $stmt->execute(['categories', 'id']);
        $pk = $stmt->fetchColumn() ? 'id' : 'category_id';
    } catch (Throwable) {
        $pk = 'id';
    }

    return $pk;
}

function promotion_json_decode(mixed $value): array
{
    if (is_array($value)) {
        return $value;
    }

    if (!is_string($value) || trim($value) === '') {
        return [];
    }

    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : [];
}

function promotion_slugify(string $value): string
{
    $slug = strtolower(trim($value));
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
    $slug = trim($slug, '-');
    return $slug !== '' ? $slug : 'promo';
}

function promotion_datetime_string(mixed $value): string
{
    return is_string($value) ? trim($value) : '';
}

function promotion_datetime_ts(mixed $value): ?int
{
    $normalized = promotion_datetime_string($value);
    if ($normalized === '') {
        return null;
    }

    $timestamp = strtotime($normalized);
    return $timestamp === false ? null : $timestamp;
}

function promotion_runtime_status(array $promotion, ?int $nowTs = null): string
{
    $nowTs ??= time();
    $status = strtolower(trim((string)($promotion['status'] ?? 'draft')));
    $enabled = ($promotion['enabled'] ?? true) !== false;

    if (!$enabled || in_array($status, ['inactive', 'archived'], true)) {
        return 'disabled';
    }

    if ($status === 'draft') {
        return 'draft';
    }

    $startTs = promotion_datetime_ts($promotion['start_date'] ?? $promotion['startAt'] ?? null);
    $endTs = promotion_datetime_ts($promotion['end_date'] ?? $promotion['endAt'] ?? null);

    if ($startTs !== null && $nowTs < $startTs) {
        return 'scheduled';
    }

    if ($endTs !== null && $nowTs > $endTs) {
        return 'expired';
    }

    return 'active';
}

function promotion_normalize_row(array $row): array
{
    $conditions = promotion_json_decode($row['conditions_json'] ?? []);
    $actions = promotion_json_decode($row['actions_json'] ?? []);

    return [
        'id' => (int)($row['id'] ?? 0),
        'code' => (string)($row['code'] ?? ''),
        'name' => (string)($row['name'] ?? ''),
        'banner_text' => (string)($row['banner_text'] ?? ''),
        'description' => (string)($row['description'] ?? ''),
        'target_url' => (string)($row['target_url'] ?? '/products'),
        'status' => (string)($row['status'] ?? 'draft'),
        'enabled' => ($row['enabled'] ?? true) !== false,
        'is_primary' => !empty($row['is_primary']),
        'priority' => max(1, (int)($row['priority'] ?? 100)),
        'display_mode' => (string)($row['display_mode'] ?? 'both'),
        'start_date' => promotion_datetime_string($row['start_date'] ?? ''),
        'end_date' => promotion_datetime_string($row['end_date'] ?? ''),
        'conditions' => $conditions,
        'actions' => $actions,
        'created_at' => (string)($row['created_at'] ?? ''),
        'updated_at' => (string)($row['updated_at'] ?? ''),
        'runtime_status' => promotion_runtime_status($row),
    ];
}

function promotions_list_all(): array
{
    if (!promotions_table_ready()) {
        return [];
    }

    $stmt = db()->query('SELECT * FROM promotions ORDER BY priority ASC, start_date ASC, id DESC');
    $rows = $stmt ? $stmt->fetchAll() : [];
    return array_map('promotion_normalize_row', is_array($rows) ? $rows : []);
}

function promotions_list_active(): array
{
    return array_values(array_filter(
        promotions_list_all(),
        static fn (array $promotion): bool => ($promotion['runtime_status'] ?? '') === 'active'
    ));
}

function promotion_banner_payload(?array $promotion): array
{
    if (!$promotion || ($promotion['runtime_status'] ?? '') !== 'active') {
        return [];
    }

    return [
        'enabled' => true,
        'text' => trim((string)($promotion['banner_text'] ?: $promotion['name'] ?: 'Limited time offer')),
        'to' => trim((string)($promotion['target_url'] ?? '/products')) ?: '/products',
        'sourcePromotionId' => (int)($promotion['id'] ?? 0),
        'sourcePromotionName' => (string)($promotion['name'] ?? ''),
        'priority' => (int)($promotion['priority'] ?? 100),
        'status' => (string)($promotion['runtime_status'] ?? 'active'),
        'displayMode' => (string)($promotion['display_mode'] ?? 'both'),
        'isPrimary' => !empty($promotion['is_primary']),
        'startAt' => (string)($promotion['start_date'] ?? ''),
        'endAt' => (string)($promotion['end_date'] ?? ''),
    ];
}

function active_storefront_promotions(bool $includeManualPromoStrip = false): array
{
    $active = array_values(array_filter(
        promotions_list_active(),
        static fn (array $promotion): bool => in_array($promotion['display_mode'] ?? 'both', ['banner', 'both'], true)
    ));

    if (!$active) {
        return [];
    }

    usort($active, static function (array $a, array $b): int {
        $aIsManual = strtoupper(trim((string)($a['code'] ?? ''))) === 'SITE_PROMO_STRIP';
        $bIsManual = strtoupper(trim((string)($b['code'] ?? ''))) === 'SITE_PROMO_STRIP';
        if ($aIsManual !== $bIsManual) {
            return $aIsManual ? 1 : -1;
        }

        $primaryDiff = (int)($b['is_primary'] ?? false) <=> (int)($a['is_primary'] ?? false);
        if ($primaryDiff !== 0) {
            return $primaryDiff;
        }

        $priorityDiff = (int)($a['priority'] ?? 100) <=> (int)($b['priority'] ?? 100);
        if ($priorityDiff !== 0) {
            return $priorityDiff;
        }

        return strcmp((string)($a['name'] ?? ''), (string)($b['name'] ?? ''));
    });

    if ($includeManualPromoStrip) {
        return $active;
    }

    return array_values(array_filter(
        $active,
        static fn (array $promotion): bool => strtoupper(trim((string)($promotion['code'] ?? ''))) !== 'SITE_PROMO_STRIP'
    ));
}

function active_storefront_promotion(): ?array
{
    $active = active_storefront_promotions(true);
    return $active[0] ?? null;
}

function promotion_context_from_user(?array $user, string $guestToken = '', array $addressContext = []): array
{
    $email = strtolower(trim((string)($user['email'] ?? '')));
    $emailDomain = str_contains($email, '@') ? substr($email, (int)strrpos($email, '@') + 1) : '';

    return [
        'user_id' => $user ? (int)($user['id'] ?? 0) : 0,
        'role' => strtolower(trim((string)($user['role'] ?? ($guestToken !== '' ? 'guest' : 'customer')))),
        'email' => $email,
        'email_domain' => strtolower(trim((string)$emailDomain)),
        'is_guest' => $user === null,
        'city' => strtolower(trim((string)($addressContext['city'] ?? ''))),
        'state' => strtolower(trim((string)($addressContext['state'] ?? ''))),
    ];
}

function promotion_parse_id_list(mixed $value): array
{
    if (is_array($value)) {
        $values = $value;
    } else {
        $values = preg_split('/\s*,\s*/', (string)$value) ?: [];
    }

    return array_values(array_unique(array_filter(array_map('intval', $values), static fn (int $id): bool => $id > 0)));
}

function promotion_parse_string_list(mixed $value): array
{
    if (is_array($value)) {
        $values = $value;
    } else {
        $values = preg_split('/\s*,\s*/', (string)$value) ?: [];
    }

    $normalized = array_map(
        static fn ($item): string => strtolower(trim((string)$item)),
        $values
    );

    return array_values(array_unique(array_filter(
        $normalized,
        static fn (string $item): bool => $item !== ''
    )));
}

function promotion_conditions_match(array $conditions, array $item, array $cartContext, array $userContext): bool
{
    $productId = (int)($item['product_id'] ?? 0);
    $variantId = (int)($item['variant_id'] ?? 0);
    $categoryName = strtolower(trim((string)($item['category_name'] ?? '')));
    $cartSubtotal = (float)($cartContext['subtotal'] ?? 0);

    $categoryNames = promotion_parse_string_list($conditions['categoryNames'] ?? $conditions['categories'] ?? []);
    if ($categoryNames && !in_array($categoryName, $categoryNames, true)) {
        return false;
    }

    $productIds = promotion_parse_id_list($conditions['productIds'] ?? []);
    if ($productIds && !in_array($productId, $productIds, true)) {
        return false;
    }

    $variantIds = promotion_parse_id_list($conditions['variantIds'] ?? []);
    if ($variantIds && !in_array($variantId, $variantIds, true)) {
        return false;
    }

    $minCartSubtotal = (float)($conditions['minCartSubtotal'] ?? $conditions['minCartTotal'] ?? 0);
    if ($minCartSubtotal > 0 && $cartSubtotal < $minCartSubtotal) {
        return false;
    }

    if (!empty($conditions['requiresSaleItem']) && ((float)($item['catalog_discount_amount'] ?? 0) <= 0)) {
        return false;
    }

    $segments = is_array($conditions['segments'] ?? null) ? $conditions['segments'] : [];
    $roles = promotion_parse_string_list($segments['roles'] ?? []);
    if ($roles && !in_array(strtolower((string)($userContext['role'] ?? 'guest')), $roles, true)) {
        return false;
    }

    if (array_key_exists('allowGuests', $segments) && !$segments['allowGuests'] && !empty($userContext['is_guest'])) {
        return false;
    }

    $cities = promotion_parse_string_list($segments['cities'] ?? []);
    if ($cities && !in_array(strtolower((string)($userContext['city'] ?? '')), $cities, true)) {
        return false;
    }

    $states = promotion_parse_string_list($segments['states'] ?? []);
    if ($states && !in_array(strtolower((string)($userContext['state'] ?? '')), $states, true)) {
        return false;
    }

    $emailDomains = promotion_parse_string_list($segments['emailDomains'] ?? []);
    if ($emailDomains && !in_array(strtolower((string)($userContext['email_domain'] ?? '')), $emailDomains, true)) {
        return false;
    }

    return true;
}

function promotion_bundle_discount_map(array $promotions, array $items, array $cartContext, array $userContext): array
{
    $discountMap = [];

    foreach ($promotions as $promotion) {
        $conditions = is_array($promotion['conditions'] ?? null) ? $promotion['conditions'] : [];
        $actions = is_array($promotion['actions'] ?? null) ? $promotion['actions'] : [];
        $discountType = strtolower(trim((string)($actions['discountType'] ?? 'none')));

        if (!in_array($discountType, ['buy_x_get_y', 'bundle_fixed_total'], true)) {
            continue;
        }

        $buyQuantity = max(1, (int)($actions['buyQuantity'] ?? 2));
        $freeQuantity = max(1, (int)($actions['freeQuantity'] ?? 1));
        $bundleFixedTotal = max(0, (float)($actions['discountValue'] ?? 0));
        $promotionKey = trim((string)($promotion['code'] ?? ''));
        if ($promotionKey === '') {
            $promotionKey = (string)($promotion['id'] ?? '0');
        }

        if ($discountType === 'buy_x_get_y') {
            $bundleSize = $buyQuantity + $freeQuantity;
            if ($bundleSize <= 1) {
                continue;
            }

            $eligibleLines = [];
            $totalEligibleQty = 0;

            foreach ($items as $index => $item) {
                $quantity = max(0, (int)($item['quantity'] ?? 0));
                if ($quantity <= 0 || !promotion_conditions_match($conditions, $item, $cartContext, $userContext)) {
                    continue;
                }

                $unitPrice = max(0, (float)($item['catalog_effective_price'] ?? $item['effective_price'] ?? $item['snapshot_price'] ?? 0));
                if ($unitPrice <= 0) {
                    continue;
                }

                $eligibleLines[] = [
                    'index' => $index,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                ];
                $totalEligibleQty += $quantity;
            }

            if ($totalEligibleQty < $bundleSize) {
                continue;
            }

            $freeUnitsRemaining = intdiv($totalEligibleQty, $bundleSize) * $freeQuantity;
            if ($freeUnitsRemaining <= 0) {
                continue;
            }

            usort($eligibleLines, static function (array $a, array $b): int {
                return $a['unit_price'] <=> $b['unit_price'];
            });

            foreach ($eligibleLines as $line) {
                if ($freeUnitsRemaining <= 0) {
                    break;
                }

                $appliedFreeUnits = min($freeUnitsRemaining, (int)$line['quantity']);
                if ($appliedFreeUnits <= 0) {
                    continue;
                }

                $discountMap[$promotionKey][$line['index']] = round($appliedFreeUnits * (float)$line['unit_price'], 2);
                $freeUnitsRemaining -= $appliedFreeUnits;
            }

            continue;
        }

        if ($buyQuantity <= 1 || $bundleFixedTotal <= 0) {
            continue;
        }

        $eligibleUnits = [];
        foreach ($items as $index => $item) {
            $quantity = max(0, (int)($item['quantity'] ?? 0));
            if ($quantity <= 0 || !promotion_conditions_match($conditions, $item, $cartContext, $userContext)) {
                continue;
            }

            $unitPrice = max(0, (float)($item['catalog_effective_price'] ?? $item['effective_price'] ?? $item['snapshot_price'] ?? 0));
            if ($unitPrice <= 0) {
                continue;
            }

            for ($count = 0; $count < $quantity; $count += 1) {
                $eligibleUnits[] = [
                    'index' => $index,
                    'unit_price' => $unitPrice,
                ];
            }
        }

        if (count($eligibleUnits) < $buyQuantity) {
            continue;
        }

        usort($eligibleUnits, static function (array $a, array $b): int {
            return $b['unit_price'] <=> $a['unit_price'];
        });

        $bundleCount = intdiv(count($eligibleUnits), $buyQuantity);
        for ($bundleNumber = 0; $bundleNumber < $bundleCount; $bundleNumber += 1) {
            $bundleUnits = array_slice($eligibleUnits, $bundleNumber * $buyQuantity, $buyQuantity);
            $regularTotal = array_sum(array_column($bundleUnits, 'unit_price'));
            $bundleDiscountAmount = round(max(0.0, $regularTotal - $bundleFixedTotal), 2);

            if ($bundleDiscountAmount <= 0) {
                continue;
            }

            $remainingDiscount = $bundleDiscountAmount;
            $lastUnitIndex = count($bundleUnits) - 1;

            foreach ($bundleUnits as $unitOffset => $unit) {
                $unitPrice = max(0, (float)($unit['unit_price'] ?? 0));
                if ($unitPrice <= 0) {
                    continue;
                }

                if ($unitOffset === $lastUnitIndex) {
                    $unitDiscount = round($remainingDiscount, 2);
                } else {
                    $unitDiscount = round($bundleDiscountAmount * ($unitPrice / max(0.01, $regularTotal)), 2);
                }

                $unitDiscount = max(0.0, min($unitPrice, $unitDiscount, $remainingDiscount));
                if ($unitDiscount <= 0) {
                    continue;
                }

                $discountMap[$promotionKey][$unit['index']] = round(($discountMap[$promotionKey][$unit['index']] ?? 0) + $unitDiscount, 2);
                $remainingDiscount = round(max(0.0, $remainingDiscount - $unitDiscount), 2);
            }
        }
    }

    return $discountMap;
}

function apply_promotions_to_cart(array $items, array $userContext = [], array $shippingConfig = []): array
{
    $promotions = array_values(array_filter(
        promotions_list_active(),
        static fn (array $promotion): bool => in_array((string)($promotion['display_mode'] ?? 'both'), ['both', 'silent'], true)
    ));
    usort($promotions, static fn (array $a, array $b): int => (int)($a['priority'] ?? 100) <=> (int)($b['priority'] ?? 100));

    $defaultThreshold = max(0, (float)($shippingConfig['threshold'] ?? 999));
    $defaultFee = max(0, (float)($shippingConfig['fee'] ?? 80));

    $catalogSubtotal = 0.0;
    foreach ($items as $item) {
        $catalogSubtotal += max(0, (float)($item['catalog_effective_price'] ?? $item['effective_price'] ?? 0)) * max(0, (int)($item['quantity'] ?? 0));
    }

    $cartContext = ['subtotal' => round($catalogSubtotal, 2)];
    $bundleDiscountMap = promotion_bundle_discount_map($promotions, $items, $cartContext, $userContext);
    $storeFreeShippingEnabled = !empty($shippingConfig['freeShippingEnabled']) || !empty($shippingConfig['free_shipping_enabled']);
    $freeShippingOfferActive = false;
    $matchedPromotions = [];
    $processedItems = [];
    $discountAmount = 0.0;
    $payableSubtotal = 0.0;

    foreach ($items as $itemIndex => $item) {
        $quantity = max(0, (int)($item['quantity'] ?? 0));
        $snapshotPrice = max(0, (float)($item['snapshot_price'] ?? $item['catalog_effective_price'] ?? $item['effective_price'] ?? 0));
        $catalogEffectivePrice = max(0, (float)($item['catalog_effective_price'] ?? $item['effective_price'] ?? $snapshotPrice));
        $currentPrice = $catalogEffectivePrice;
        $itemMatchedPromotions = [];
        $discountLocked = false;

        foreach ($promotions as $promotion) {
            $conditions = is_array($promotion['conditions'] ?? null) ? $promotion['conditions'] : [];
            if (!promotion_conditions_match($conditions, $item, $cartContext, $userContext)) {
                continue;
            }

            $offerType = strtolower(trim((string)($conditions['offerType'] ?? '')));
            $actions = is_array($promotion['actions'] ?? null) ? $promotion['actions'] : [];

            if ($offerType !== 'free-shipping') {
                $actions['freeShipping'] = false;
            }

            $isStackable = !empty($actions['stackable']);
            $discountType = strtolower(trim((string)($actions['discountType'] ?? 'none')));
            $discountValue = (float)($actions['discountValue'] ?? 0);

            if ($offerType === 'free-shipping' && !empty($actions['freeShipping'])) {
                $freeShippingOfferActive = true;
            }

            $promotionKey = trim((string)($promotion['code'] ?? ''));
            if ($promotionKey === '') {
                $promotionKey = (string)($promotion['id'] ?? 0);
            }

            $bundleDiscountAmount = in_array($discountType, ['buy_x_get_y', 'bundle_fixed_total'], true)
                ? (float)($bundleDiscountMap[$promotionKey][$itemIndex] ?? 0)
                : 0.0;

            if (in_array($discountType, ['buy_x_get_y', 'bundle_fixed_total'], true) && $bundleDiscountAmount <= 0) {
                continue;
            }

            $entry = [
                'id' => (int)($promotion['id'] ?? 0),
                'code' => (string)($promotion['code'] ?? ''),
                'name' => (string)($promotion['name'] ?? ''),
                'priority' => (int)($promotion['priority'] ?? 100),
                'offer_type' => $offerType,
                'free_shipping' => $offerType === 'free-shipping' && !empty($actions['freeShipping']),
            ];

            if (!$discountLocked || $isStackable) {
                $candidateBasePrice = $currentPrice > 0 ? $currentPrice : ($snapshotPrice > 0 ? $snapshotPrice : $catalogEffectivePrice);

                if ($discountType === 'percent' && $discountValue > 0) {
                    $promoCandidatePrice = round(max(0.0, $candidateBasePrice * (1 - ($discountValue / 100))), 2);
                    $currentPrice = $promoCandidatePrice;
                    $entry['discount_type'] = 'percent';
                    $entry['discount_value'] = $discountValue;
                } elseif ($discountType === 'fixed' && $discountValue > 0) {
                    $promoCandidatePrice = round(max(0.0, $candidateBasePrice - $discountValue), 2);
                    $currentPrice = $promoCandidatePrice;
                    $entry['discount_type'] = 'fixed';
                    $entry['discount_value'] = $discountValue;
                } elseif (in_array($discountType, ['buy_x_get_y', 'bundle_fixed_total'], true) && $bundleDiscountAmount > 0 && $quantity > 0) {
                    $lineBaseAmount = round($candidateBasePrice * $quantity, 2);
                    $lineAfterBundle = round(max(0.0, $lineBaseAmount - $bundleDiscountAmount), 2);
                    $currentPrice = round($lineAfterBundle / $quantity, 2);
                    $entry['discount_type'] = $discountType;
                    $entry['discount_value'] = $discountType === 'bundle_fixed_total'
                        ? round((float)($actions['discountValue'] ?? 0), 2)
                        : round($bundleDiscountAmount, 2);
                    $entry['bundle_discount_amount'] = round($bundleDiscountAmount, 2);
                    $entry['buy_quantity'] = max(1, (int)($actions['buyQuantity'] ?? 2));
                    if ($discountType === 'buy_x_get_y') {
                        $entry['free_quantity'] = max(1, (int)($actions['freeQuantity'] ?? 1));
                    }
                }

                if (isset($entry['discount_type']) && !$isStackable) {
                    $discountLocked = true;
                }
            }

            $itemMatchedPromotions[] = $entry;
            $matchedPromotions[$promotionKey] = $entry;
        }

        $lineCatalog = round($catalogEffectivePrice * $quantity, 2);
        $linePayable = round($currentPrice * $quantity, 2);
        $discountAmount += max(0, $lineCatalog - $linePayable);
        $payableSubtotal += $linePayable;

        $processedItems[] = array_merge($item, [
            'snapshot_price' => $snapshotPrice,
            'catalog_effective_price' => $catalogEffectivePrice,
            'effective_price' => $currentPrice,
            'catalog_discount_amount' => round(max(0, $snapshotPrice - $catalogEffectivePrice), 2),
            'promo_discount_amount' => round(max(0, $catalogEffectivePrice - $currentPrice), 2),
            'applied_promotions' => array_values($itemMatchedPromotions),
            'promo_offer' => !empty($itemMatchedPromotions[0]['code'])
                ? $itemMatchedPromotions[0]['code']
                : (!empty($itemMatchedPromotions[0]['name']) ? $itemMatchedPromotions[0]['name'] : null),
        ]);
    }

    $remainingForFreeShipping = 0.0;
    $freeShipping = false;
    if (($freeShippingOfferActive || $storeFreeShippingEnabled) && $payableSubtotal > 0) {
        if ($defaultThreshold <= 0 || $payableSubtotal >= $defaultThreshold) {
            $freeShipping = true;
        } else {
            $remainingForFreeShipping = max(0, round($defaultThreshold - $payableSubtotal, 2));
        }
    }

    $shippingCost = ($freeShipping || $payableSubtotal <= 0) ? 0.0 : $defaultFee;
    $grandTotal = round($payableSubtotal + $shippingCost, 2);

    return [
        'items' => $processedItems,
        'summary' => [
            'catalog_subtotal' => round($catalogSubtotal, 2),
            'subtotal' => round($payableSubtotal, 2),
            'discount_amount' => round($discountAmount, 2),
            'shipping_cost' => round($shippingCost, 2),
            'grand_total' => $grandTotal,
            'remaining_for_free_shipping' => $remainingForFreeShipping,
            'free_shipping_applied' => $freeShipping,
            'free_shipping_offer_active' => ($freeShippingOfferActive || $storeFreeShippingEnabled),
            'free_shipping_threshold' => round($defaultThreshold, 2),
        ],
        'applied_promotions' => array_values($matchedPromotions),
    ];
}

function apply_promotions_to_catalog_item(array $item, array $userContext = [], array $shippingConfig = []): array
{
    $normalizedItem = $item;
    $normalizedItem['quantity'] = max(1, (int)($normalizedItem['quantity'] ?? 1));

    $result = apply_promotions_to_cart([$normalizedItem], $userContext, $shippingConfig);
    if (!empty($result['items'][0]) && is_array($result['items'][0])) {
        return $result['items'][0];
    }

    return $normalizedItem;
}
