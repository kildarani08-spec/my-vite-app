<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function cart_table_exists(string $table): bool
{
    static $cache = [];
    if (array_key_exists($table, $cache)) {
        return $cache[$table];
    }

    $stmt = db()->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1');
    $stmt->execute([$table]);
    $cache[$table] = (bool)$stmt->fetchColumn();

    return $cache[$table];
}

function cart_column_exists(string $table, string $column): bool
{
    $stmt = db()->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1');
    $stmt->execute([$table, $column]);
    return (bool)$stmt->fetchColumn();
}

function ensure_cart_price_columns(): void
{
    static $ensured = false;

    if ($ensured) {
        return;
    }

    if (cart_table_exists('carts')) {
        if (!cart_column_exists('carts', 'price')) {
            db()->exec('ALTER TABLE carts ADD COLUMN price DECIMAL(10,2) DEFAULT NULL AFTER quantity');
        }
        if (!cart_column_exists('carts', 'discount_price')) {
            db()->exec('ALTER TABLE carts ADD COLUMN discount_price DECIMAL(10,2) DEFAULT NULL AFTER price');
        }
        if (!cart_column_exists('carts', 'promo_offer')) {
            db()->exec('ALTER TABLE carts ADD COLUMN promo_offer VARCHAR(60) DEFAULT NULL AFTER discount_price');
        }
    }

    $ensured = true;
}

function cart_schema(): array
{
    ensure_cart_price_columns();

    $isModern = cart_table_exists('carts');
    $cartTable = $isModern ? 'carts' : 'cart';

    return [
        'modern' => $isModern,
        'cart_table' => $cartTable,
        'cart_id_col' => $isModern ? 'id' : 'cart_id',
        'variant_table' => cart_table_exists('product_variants') ? 'product_variants' : 'products_detail',
        'variant_price_col' => cart_table_exists('product_variants') ? 'base_price' : 'price',
        'has_price_column' => cart_column_exists($cartTable, 'price'),
        'has_discount_price_column' => cart_column_exists($cartTable, 'discount_price'),
        'has_promo_offer_column' => cart_column_exists($cartTable, 'promo_offer'),
    ];
}

function cart_payload(?int $userId, string $guestToken, ?array $user = null): array
{
    $schema = cart_schema();
    $table = $schema['cart_table'];
    $idCol = $schema['cart_id_col'];
    $variantTable = $schema['variant_table'];
    $variantPriceCol = $schema['variant_price_col'];
    $categoryPk = function_exists('promotion_category_pk') ? promotion_category_pk() : 'id';
    $colorExpr = $variantTable === 'product_variants' ? "COALESCE(v.color, '')" : "''";
    $sizeExpr = $variantTable === 'product_variants' ? "COALESCE(v.size, '')" : "''";
    $hasVariantImageColumn = cart_column_exists($variantTable, 'image');
    $hasVariantImagesColumn = cart_column_exists($variantTable, 'images');
    $variantImageExpr = $variantTable === 'product_variants'
        ? "COALESCE(NULLIF(v.image, ''), p.image)"
        : ($hasVariantImagesColumn
            ? "COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v.images, '$[0]')), ''), " . ($hasVariantImageColumn ? "NULLIF(v.image, ''), " : '') . "p.image)"
            : ($hasVariantImageColumn ? "COALESCE(NULLIF(v.image, ''), p.image)" : 'p.image'));
    $cartSnapshotExpr = $schema['has_price_column'] ? 'NULLIF(c.price, 0)' : 'NULL';
  $activeVariantDiscountExpr = "CASE
    WHEN v.discount_price IS NOT NULL
         AND v.discount_price > 0
         AND v.discount_price < v.{$variantPriceCol}
         AND (v.discount_end IS NULL OR v.discount_end >= NOW())
    THEN v.discount_price
    ELSE NULL
END";
    $snapshotExpr = "COALESCE({$cartSnapshotExpr}, v.{$variantPriceCol}, p.price, 0)";
    $catalogEffectiveExpr = "COALESCE({$activeVariantDiscountExpr}, {$cartSnapshotExpr}, v.{$variantPriceCol}, p.price, 0)";

    $bind = [];

    if ($userId !== null) {
        $where = "c.user_id = ?";
        $bind[] = $userId;
    } elseif ($guestToken !== '') {
        $where = "c.guest_token = ?";
        $bind[] = $guestToken;
    } else {
        return [
            'items' => [],
            'summary' => [
                'catalog_subtotal' => 0,
                'subtotal' => 0,
                'discount_amount' => 0,
                'shipping_cost' => 0,
                'grand_total' => 0,
                'remaining_for_free_shipping' => 0,
                'free_shipping_applied' => false,
            ],
            'applied_promotions' => [],
        ];
    }

    $sql = "SELECT c.{$idCol} AS cart_id, c.product_id, c.variant_id, c.quantity,
                   p.name, p.image,
                   {$variantImageExpr} AS variant_image,
                   COALESCE(cat.name, '') AS category_name,
                   COALESCE(v.sku, p.sku, '') AS sku,
                   {$snapshotExpr} AS snapshot_price,
                   {$catalogEffectiveExpr} AS effective_price,
                   COALESCE(v.tax_rate, 0) AS tax_rate,
                   {$colorExpr} AS color,
                   {$sizeExpr} AS size
            FROM {$table} c
            JOIN products p ON p.id = c.product_id
            LEFT JOIN categories cat ON cat.{$categoryPk} = p.category_id
            LEFT JOIN {$variantTable} v ON v.id = c.variant_id
            WHERE {$where}
            ORDER BY c.updated_at DESC";

    $stmt = db()->prepare($sql);
    $stmt->execute($bind);
    $rows = $stmt->fetchAll();

    $items = array_map(static function (array $row): array {
        return [
            'cart_id' => (int)$row['cart_id'],
            'product_id' => (int)$row['product_id'],
            'variant_id' => (int)$row['variant_id'],
            'quantity' => (int)$row['quantity'],
            'name' => $row['name'],
            'category_name' => (string)($row['category_name'] ?: 'General'),
            'images' => [($row['variant_image'] ?: $row['image'] ?: 'https://via.placeholder.com/100')],
            'variant_description' => trim(($row['color'] ?: '') . ' ' . ($row['size'] ?: '')),
            'sku' => (string)$row['sku'],
            'snapshot_price' => (float)$row['snapshot_price'],
            'catalog_effective_price' => (float)$row['effective_price'],
            'effective_price' => (float)$row['effective_price'],
            'tax_rate' => (float)$row['tax_rate'],
        ];
    }, $rows);

    try {
        $settings = site_settings();
    } catch (Throwable) {
        $settings = [];
    }

    $pricing = apply_promotions_to_cart(
        $items,
        promotion_context_from_user($user, $guestToken),
        [
            'threshold' => (float)($settings['offers']['freeShippingThreshold'] ?? 999),
            'fee' => (float)($settings['offers']['standardShippingFee'] ?? 80),
            'freeShippingEnabled' => (float)($settings['offers']['freeShippingThreshold'] ?? 0) > 0,
        ]
    );

    return $pricing;
}

$method = $_SERVER['REQUEST_METHOD'];
$token = bearer_token();
$user = $token !== '' ? auth_user(false) : null;
fail_if_admin_purchase($user, 'Admin accounts cannot use cart or checkout. Please use a customer account.');
$userId = $user ? (int)$user['id'] : null;
$guestToken = trim((string)($_GET['guest_token'] ?? ''));
$body = json_input();

if ($guestToken === '') {
    $guestToken = trim((string)($body['guest_token'] ?? ''));
}

if ($method === 'GET') {
    $payload = cart_payload($userId, $guestToken, $user);
    ok([
        'cart' => $payload['items'] ?? [],
        'summary' => $payload['summary'] ?? new stdClass(),
        'applied_promotions' => $payload['applied_promotions'] ?? [],
    ]);
}

if ($method !== 'POST') {
    fail('Method not allowed', 405);
}

$action = trim((string)($body['action'] ?? ''));
$productId = (int)($body['product_id'] ?? 0);
$variantId = (int)($body['variant_id'] ?? 0);
$quantity = max(0, (int)($body['quantity'] ?? 1));
$snapshotPrice = isset($body['price']) ? max(0, (float)$body['price']) : null;
$discountPrice = isset($body['discount_price']) ? max(0, (float)$body['discount_price']) : null;
$promoOffer = trim((string)($body['promo_offer'] ?? ''));

if (!in_array($action, ['add', 'update', 'remove'], true)) {
    fail('Invalid action');
}

if ($productId <= 0 || $variantId <= 0) {
    fail('Invalid product or variant');
}

if ($userId === null && $guestToken === '') {
    fail('guest_token required for guest cart');
}

$schema = cart_schema();
$table = $schema['cart_table'];
$idCol = $schema['cart_id_col'];
$whereCol = $userId !== null ? 'user_id' : 'guest_token';
$whereVal = $userId !== null ? $userId : $guestToken;

if ($action === 'remove' || $quantity <= 0) {
    $stmt = db()->prepare("DELETE FROM {$table} WHERE {$whereCol} = ? AND variant_id = ?");
    $stmt->execute([$whereVal, $variantId]);
} else {
    $check = db()->prepare("SELECT {$idCol}, quantity FROM {$table} WHERE {$whereCol} = ? AND variant_id = ? LIMIT 1");
    $check->execute([$whereVal, $variantId]);
    $row = $check->fetch();

    if ($row) {
        $newQty = $action === 'add' ? ((int)$row['quantity'] + $quantity) : $quantity;
        $updateFields = ['quantity = ?', 'updated_at = CURRENT_TIMESTAMP'];
        $updateBind = [$newQty];

        if ($schema['has_price_column'] && $snapshotPrice !== null) {
            $updateFields[] = 'price = ?';
            $updateBind[] = $snapshotPrice;
        }

        if ($schema['has_discount_price_column'] && $discountPrice !== null) {
            $updateFields[] = 'discount_price = ?';
            $updateBind[] = $discountPrice;
        }

        if ($schema['has_promo_offer_column']) {
            $updateFields[] = 'promo_offer = ?';
            $updateBind[] = $promoOffer !== '' ? $promoOffer : null;
        }

        $updateBind[] = (int)$row[$idCol];
        $upd = db()->prepare("UPDATE {$table} SET " . implode(', ', $updateFields) . " WHERE {$idCol} = ?");
        $upd->execute($updateBind);
    } else {
        if ($schema['modern']) {
            $ins = db()->prepare('INSERT INTO carts (user_id, guest_token, product_id, variant_id, quantity, price, discount_price, promo_offer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            $ins->execute([
                $userId,
                $userId === null ? $guestToken : null,
                $productId,
                $variantId,
                $quantity,
                $snapshotPrice,
                $discountPrice,
                $promoOffer !== '' ? $promoOffer : null,
            ]);
        } else {
            if ($schema['has_price_column'] || $schema['has_discount_price_column']) {
                $ins = db()->prepare('INSERT INTO cart (user_id, guest_token, product_id, variant_id, quantity, price, discount_price, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
                $ins->execute([
                    $userId,
                    $userId === null ? $guestToken : null,
                    $productId,
                    $variantId,
                    $quantity,
                    $snapshotPrice,
                    $discountPrice,
                    'active'
                ]);
            } else {
                $ins = db()->prepare('INSERT INTO cart (user_id, guest_token, product_id, variant_id, quantity, status) VALUES (?, ?, ?, ?, ?, ?)');
                $ins->execute([$userId, $userId === null ? $guestToken : null, $productId, $variantId, $quantity, 'active']);
            }
        }
    }
}

$payload = cart_payload($userId, $guestToken, $user);
ok([
    'cart' => $payload['items'] ?? [],
    'summary' => $payload['summary'] ?? new stdClass(),
    'applied_promotions' => $payload['applied_promotions'] ?? [],
]);
