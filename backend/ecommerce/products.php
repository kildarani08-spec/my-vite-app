<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function disabled_category_names(): array
{
    $settings = [];
    try {
        $settings = site_settings();
    } catch (Throwable $e) {
        $settings = [];
    }

    $links = $settings['navbar']['links'] ?? [];
    if (!is_array($links)) {
        return [];
    }

    $blocked = [];
    foreach ($links as $link) {
        if (!is_array($link) || ($link['enabled'] ?? true) !== false) {
            continue;
        }

        $to = trim((string)($link['to'] ?? ''));
        if ($to === '') {
            continue;
        }

        $queryString = parse_url($to, PHP_URL_QUERY);
        if (!is_string($queryString) || $queryString === '') {
            continue;
        }

        $query = [];
        parse_str($queryString, $query);
        $categoryName = trim((string)($query['category'] ?? ''));
        if ($categoryName !== '') {
            $blocked[] = $categoryName;
        }
    }

    return array_values(array_unique($blocked));
}

    function products_variant_table(): string
    {
        static $t = null;
        if ($t !== null) {
            return $t;
        }
        $stmt = db()->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1');
        $stmt->execute(['product_variants']);
        $t = $stmt->fetchColumn() ? 'product_variants' : 'products_detail';
        return $t;
    }

    function products_variant_active_cond(string $alias = 'v'): string
    {
        return products_variant_table() === 'product_variants'
            ? "{$alias}.status = 'active'"
            : "{$alias}.availability != 'out_of_stock'";
    }

    function products_category_pk(): string
    {
        static $pk = null;
        if ($pk !== null) {
            return $pk;
        }
        $stmt = db()->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1');
        $stmt->execute(['categories', 'id']);
        $pk = $stmt->fetchColumn() ? 'id' : 'category_id';
        return $pk;
    }

    function products_promo_shipping_config(): array
    {
        try {
            $settings = function_exists('site_settings') ? site_settings() : [];
            $offers = is_array($settings['offers'] ?? null) ? $settings['offers'] : [];

            return [
                'threshold' => max(0, (float)($offers['freeShippingThreshold'] ?? 999)),
                'fee' => max(0, (float)($offers['standardShippingFee'] ?? 80)),
            ];
        } catch (Throwable) {
            return ['threshold' => 999, 'fee' => 80];
        }
    }

    function products_variant_display_price(array $variant): float
    {
        return max(0, (float)($variant['effective_price'] ?? $variant['price'] ?? 0));
    }

$params = $_GET;
$query = strtolower(trim((string)($params['query'] ?? '')));
$category = trim((string)($params['category'] ?? ''));
$productId = max(0, (int)($params['productId'] ?? $params['promoProduct'] ?? 0));
$productIds = array_values(array_unique(array_filter(
    array_map('intval', preg_split('/\s*,\s*/', (string)($params['ids'] ?? ''))),
    static fn ($id) => $id > 0
)));
if (empty($productIds) && $productId > 0) {
    $productIds = [$productId];
}
$variantIds = array_values(array_unique(array_filter(
    array_map('intval', preg_split('/\s*,\s*/', (string)($params['variantIds'] ?? $params['variantId'] ?? ''))),
    static fn ($id) => $id > 0
)));
$minPrice = (float)($params['minPrice'] ?? 0);
$maxPrice = isset($params['maxPrice']) ? (float)$params['maxPrice'] : null;
$sort = trim((string)($params['sort'] ?? 'relevance'));
$limit = max(1, min(300, (int)($params['limit'] ?? 100)));

$categoryPk = products_category_pk();
$variantTable = products_variant_table();
$variantActiveCond = products_variant_active_cond();
$variantPriceCol = $variantTable === 'product_variants' ? 'base_price' : 'price';
$effectiveExpr = "CASE
            WHEN v.discount_price IS NOT NULL
                 AND v.discount_price > 0
                 AND v.discount_price < v.{$variantPriceCol}
                 AND (v.discount_end IS NULL OR v.discount_end = '0000-00-00 00:00:00' OR v.discount_end >= NOW())
            THEN v.discount_price
            ELSE v.{$variantPriceCol}
        END";

$sql = "SELECT
    p.id AS product_id,
    p.name,
    p.description,
    p.image,
    c.name AS category_name,
    v.id AS variant_id,
    v.sku,
    v.{$variantPriceCol} AS price,
    {$effectiveExpr} AS effective_price,
    v.discount_end,
    v.stock_quantity,
    ROUND(COALESCE(AVG(r.rating), 0), 1) AS rating_avg,
    COUNT(r.id) AS rating_count
FROM products p
LEFT JOIN categories c ON c.{$categoryPk} = p.category_id
JOIN {$variantTable} v ON v.product_id = p.id AND {$variantActiveCond}
LEFT JOIN reviews r ON r.product_id = p.id
WHERE p.status = 'active'";

$bind = [];

$blockedCategories = disabled_category_names();
if (!empty($blockedCategories)) {
    $placeholders = implode(',', array_fill(0, count($blockedCategories), '?'));
    $sql .= " AND (c.name IS NULL OR c.name NOT IN ($placeholders))";
    $bind = array_merge($bind, $blockedCategories);
}

if ($query !== '') {
    $sql .= " AND (LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(v.sku) LIKE ? )";
    $like = '%' . $query . '%';
    $bind[] = $like;
    $bind[] = $like;
    $bind[] = $like;
}

if ($category !== '' && strtolower($category) !== 'all') {
    $sql .= " AND c.name = ?";
    $bind[] = $category;
}

if (!empty($productIds)) {
    $placeholders = implode(',', array_fill(0, count($productIds), '?'));
    $sql .= " AND p.id IN ($placeholders)";
    foreach ($productIds as $selectedProductId) {
        $bind[] = $selectedProductId;
    }
}

if (!empty($variantIds)) {
    $placeholders = implode(',', array_fill(0, count($variantIds), '?'));
    $sql .= " AND v.id IN ($placeholders)";
    foreach ($variantIds as $selectedVariantId) {
        $bind[] = $selectedVariantId;
    }
}

if ($minPrice > 0) {
    $sql .= " AND {$effectiveExpr} >= ?";
    $bind[] = $minPrice;
}

if ($maxPrice !== null && $maxPrice > 0) {
    $sql .= " AND {$effectiveExpr} <= ?";
    $bind[] = $maxPrice;
}

$sql .= " GROUP BY p.id, v.id";

switch ($sort) {
    case 'price-asc':
        $sql .= ' ORDER BY effective_price ASC';
        break;
    case 'price-desc':
        $sql .= ' ORDER BY effective_price DESC';
        break;
    case 'rating':
        $sql .= ' ORDER BY rating_avg DESC';
        break;
    case 'name':
        $sql .= ' ORDER BY p.name ASC';
        break;
    default:
        $sql .= ' ORDER BY p.created_at DESC';
}

$sql .= ' LIMIT ' . $limit;

$stmt = db()->prepare($sql);
$stmt->execute($bind);
$rows = $stmt->fetchAll();

$products = [];
$maxAvailablePrice = 0;
$promoShippingConfig = products_promo_shipping_config();

foreach ($rows as $row) {
    $pid = (int)$row['product_id'];
    $price = (float)$row['price'];
    $catalogEffectivePrice = (float)$row['effective_price'];
    $promoPreview = function_exists('apply_promotions_to_catalog_item')
        ? apply_promotions_to_catalog_item([
            'product_id' => $pid,
            'variant_id' => (int)$row['variant_id'],
            'category_name' => $row['category_name'] ?: 'General',
            'snapshot_price' => $price,
            'catalog_effective_price' => $catalogEffectivePrice,
            'effective_price' => $catalogEffectivePrice,
            'catalog_discount_amount' => round(max(0, $price - $catalogEffectivePrice), 2),
            'quantity' => 1,
        ], ['is_guest' => true], $promoShippingConfig)
        : [
            'effective_price' => $catalogEffectivePrice,
            'promo_discount_amount' => 0,
            'promo_offer' => null,
            'applied_promotions' => [],
        ];
    $effectivePrice = (float)($promoPreview['effective_price'] ?? $catalogEffectivePrice);
    $maxAvailablePrice = max($maxAvailablePrice, $effectivePrice);

    if (!isset($products[$pid])) {
        $products[$pid] = [
            'product_id' => $pid,
            'name' => $row['name'],
            'description' => $row['description'],
            'image' => $row['image'] ?: 'https://via.placeholder.com/400',
            'category_name' => $row['category_name'] ?: 'General',
            'variants' => []
        ];
    }

    $products[$pid]['variants'][] = [
        'id' => (int)$row['variant_id'],
        'sku' => $row['sku'],
        'price' => $price,
        'effective_price' => $effectivePrice,
        'catalog_effective_price' => $catalogEffectivePrice,
        'promo_discount_amount' => round((float)($promoPreview['promo_discount_amount'] ?? 0), 2),
        'promo_offer' => $promoPreview['promo_offer'] ?? null,
        'applied_promotions' => array_values(is_array($promoPreview['applied_promotions'] ?? null) ? $promoPreview['applied_promotions'] : []),
        'discount_end' => $row['discount_end'],
        'availability' => ((int)$row['stock_quantity'] > 0),
        'rating_avg' => (float)$row['rating_avg'],
        'rating_count' => (int)$row['rating_count']
    ];
}

$productList = array_values($products);
if (in_array($sort, ['price-asc', 'price-desc'], true)) {
    usort($productList, static function (array $left, array $right) use ($sort): int {
        $leftPrices = array_map('products_variant_display_price', is_array($left['variants'] ?? null) ? $left['variants'] : []);
        $rightPrices = array_map('products_variant_display_price', is_array($right['variants'] ?? null) ? $right['variants'] : []);
        $leftPrice = $leftPrices ? min($leftPrices) : 0;
        $rightPrice = $rightPrices ? min($rightPrices) : 0;

        return $sort === 'price-desc'
            ? ($rightPrice <=> $leftPrice)
            : ($leftPrice <=> $rightPrice);
    });
}

ok([
    'products' => $productList,
    'meta' => [
        'total' => count($productList),
        'maxAvailablePrice' => $maxAvailablePrice
    ]
]);
