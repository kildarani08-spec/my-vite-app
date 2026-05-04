<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function pd_table_exists(string $table): bool
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

function pd_column_exists(string $table, string $column): bool
{
    static $cache = [];
    $key = $table . ':' . $column;

    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = db()->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1');
    $stmt->execute([$table, $column]);
    $cache[$key] = (bool)$stmt->fetchColumn();

    return $cache[$key];
}

function pd_category_pk(): string
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

function pd_normalize_about_item(?string $aboutItem, ?string $fallback): string
{
    $value = trim((string)($aboutItem ?? ''));
    if ($value === '' || strtolower($value) === 'null') {
        $value = trim((string)($fallback ?? ''));
    }

    if ($value === '') {
        return 'No additional details.';
    }

    // Convert common separators/newlines into PDP bullet delimiter expected by frontend.
    $parts = preg_split('/\r\n|\r|\n|\||;\s*/', $value) ?: [];
    $parts = array_values(array_filter(array_map(static fn (string $line): string => trim($line), $parts), static fn (string $line): bool => $line !== ''));

    return $parts ? implode('|', $parts) : $value;
}

function pd_decode_assoc(mixed $raw): ?array
{
    if (!is_string($raw) || trim($raw) === '') {
        return null;
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function pd_promo_shipping_config(): array
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

$productId = (int)($_GET['id'] ?? 0);
if ($productId <= 0) {
    fail('Invalid product id');
}

$categoryPk = pd_category_pk();
$productStmt = db()->prepare("SELECT p.id, p.name, p.description, p.image, c.name AS category_name FROM products p LEFT JOIN categories c ON c.{$categoryPk} = p.category_id WHERE p.id = ? LIMIT 1");
$productStmt->execute([$productId]);
$product = $productStmt->fetch();
if (!$product) {
    fail('Product not found', 404);
}

$variantTable = pd_table_exists('product_variants') ? 'product_variants' : 'products_detail';
$priceCol = $variantTable === 'product_variants' ? 'base_price' : 'price';
$hasProductsDetail = pd_table_exists('products_detail');
$hasProductsDetailSku = $hasProductsDetail && pd_column_exists('products_detail', 'sku');
$hasProductsDetailVariants = $hasProductsDetail && pd_column_exists('products_detail', 'variants');
$hasProductsDetailImages = $hasProductsDetail && pd_column_exists('products_detail', 'images');
$hasProductsDetailSpecifications = $hasProductsDetail && pd_column_exists('products_detail', 'specifications');
$hasProductsDetailShippingInfo = $hasProductsDetail && pd_column_exists('products_detail', 'shipping_info');
$hasProductsDetailReturnPolicy = $hasProductsDetail && pd_column_exists('products_detail', 'return_policy');
$hasProductsDetailWarranty = $hasProductsDetail && pd_column_exists('products_detail', 'warranty');
$hasProductsDetailAboutItem = $hasProductsDetail && pd_column_exists('products_detail', 'about_item');

if ($variantTable === 'product_variants') {
    $detailsJoin = ($hasProductsDetail && $hasProductsDetailSku)
        ? ' LEFT JOIN products_detail pd ON pd.product_id = v.product_id AND pd.sku = v.sku '
        : '';
    $detailsSkuExpr = ($detailsJoin !== '' && $hasProductsDetailSku) ? 'pd.sku' : "''";
    $detailsColorExpr = ($detailsJoin !== '' && $hasProductsDetailVariants) ? "JSON_UNQUOTE(JSON_EXTRACT(pd.variants, '$.color'))" : "''";
    $detailsSizeExpr = ($detailsJoin !== '' && $hasProductsDetailVariants) ? "JSON_UNQUOTE(JSON_EXTRACT(pd.variants, '$.size'))" : "''";
    $detailsImageExpr = ($detailsJoin !== '' && $hasProductsDetailImages) ? "JSON_UNQUOTE(JSON_EXTRACT(pd.images, '$[0]'))" : 'NULL';
    $detailsSpecificationsExpr = ($detailsJoin !== '' && $hasProductsDetailSpecifications) ? 'pd.specifications' : 'NULL';
    $detailsShippingInfoExpr = ($detailsJoin !== '' && $hasProductsDetailShippingInfo) ? 'pd.shipping_info' : 'NULL';
    $detailsReturnPolicyExpr = ($detailsJoin !== '' && $hasProductsDetailReturnPolicy) ? 'pd.return_policy' : 'NULL';
    $detailsWarrantyExpr = ($detailsJoin !== '' && $hasProductsDetailWarranty) ? 'pd.warranty' : 'NULL';
    $detailsAboutItemExpr = ($detailsJoin !== '' && $hasProductsDetailAboutItem) ? 'pd.about_item' : 'NULL';

    $variantStmt = db()->prepare("SELECT
        v.id,
        COALESCE(NULLIF(v.sku, ''), {$detailsSkuExpr}) AS sku,
        v.{$priceCol} AS base_price,
        v.discount_price,
        v.discount_end,
        v.stock_quantity,
        v.tax_included,
        v.tax_rate,
        COALESCE(NULLIF(v.color, ''), {$detailsColorExpr}, '') AS color,
        COALESCE(NULLIF(v.size, ''), {$detailsSizeExpr}, '') AS size,
        COALESCE({$detailsImageExpr}, NULLIF(v.image, ''), NULL) AS image,
        {$detailsSpecificationsExpr} AS specifications,
        {$detailsShippingInfoExpr} AS shipping_info,
        {$detailsReturnPolicyExpr} AS return_policy,
        {$detailsWarrantyExpr} AS warranty,
        {$detailsAboutItemExpr} AS about_item
      FROM {$variantTable} v
      {$detailsJoin}
      WHERE v.product_id = ? AND v.status = 'active'");
    $variantStmt->execute([$productId]);
    $variantsRows = $variantStmt->fetchAll();
} else {
    $colorExpr = $hasProductsDetailVariants ? "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(variants, '$.color')), '') AS color" : "'' AS color";
    $sizeExpr = $hasProductsDetailVariants ? "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(variants, '$.size')), '') AS size" : "'' AS size";
    $imageExpr = $hasProductsDetailImages ? "JSON_UNQUOTE(JSON_EXTRACT(images, '$[0]')) AS image" : 'NULL AS image';
    $specificationsExpr = $hasProductsDetailSpecifications ? 'specifications' : 'NULL AS specifications';
    $shippingInfoExpr = $hasProductsDetailShippingInfo ? 'shipping_info' : 'NULL AS shipping_info';
    $returnPolicyExpr = $hasProductsDetailReturnPolicy ? 'return_policy' : 'NULL AS return_policy';
    $warrantyExpr = $hasProductsDetailWarranty ? 'warranty' : 'NULL AS warranty';
    $aboutItemExpr = $hasProductsDetailAboutItem ? 'about_item' : 'NULL AS about_item';
    $taxIncludedExpr = pd_column_exists('products_detail', 'tax_included') ? 'tax_included' : '1 AS tax_included';
    $statusCond = pd_column_exists('products_detail', 'availability') ? "availability != 'out_of_stock'" : '1=1';

    $variantStmt = db()->prepare("SELECT id, sku, {$priceCol} AS base_price, discount_price, discount_end, stock_quantity, {$taxIncludedExpr}, tax_rate, {$colorExpr}, {$sizeExpr}, {$imageExpr}, {$specificationsExpr}, {$shippingInfoExpr}, {$returnPolicyExpr}, {$warrantyExpr}, {$aboutItemExpr} FROM {$variantTable} WHERE product_id = ? AND {$statusCond}");
    $variantStmt->execute([$productId]);
    $variantsRows = $variantStmt->fetchAll();
}

$ratingStatsStmt = db()->prepare('SELECT COALESCE(AVG(rating),0) AS avg_rating, COUNT(*) AS total FROM reviews WHERE product_id = ?');
$ratingStatsStmt->execute([$productId]);
$stats = $ratingStatsStmt->fetch() ?: ['avg_rating' => 0, 'total' => 0];

$distributionStmt = db()->prepare('SELECT rating, COUNT(*) AS total FROM reviews WHERE product_id = ? GROUP BY rating');
$distributionStmt->execute([$productId]);
$distributionRows = $distributionStmt->fetchAll();
$distribution = ['5' => 0, '4' => 0, '3' => 0, '2' => 0, '1' => 0];
foreach ($distributionRows as $d) {
    $distribution[(string)$d['rating']] = (int)$d['total'];
}

$reviewsStmt = db()->prepare('SELECT r.user_id, u.name AS user_name, r.rating, r.review_text, r.created_at FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = ? ORDER BY r.created_at DESC LIMIT 20');
$reviewsStmt->execute([$productId]);
$reviews = $reviewsStmt->fetchAll();

$variants = [];
$primaryWarranty = null;
$primaryAboutItem = null;
$promoShippingConfig = pd_promo_shipping_config();
$nowTs = time();
foreach ($variantsRows as $row) {
    $price = (float)$row['base_price'];
    $discountEndValue = trim((string)($row['discount_end'] ?? ''));
    $discountEndTs = null;
    if ($discountEndValue !== '' && $discountEndValue !== '0000-00-00 00:00:00') {
        $parsedDiscountEnd = strtotime($discountEndValue);
        $discountEndTs = $parsedDiscountEnd === false ? null : $parsedDiscountEnd;
    }
    $hasActiveDiscount = $row['discount_price'] !== null
        && (float)$row['discount_price'] > 0
        && (float)$row['discount_price'] < $price
        && ($discountEndTs === null || $discountEndTs >= $nowTs);
    $catalogEffective = $hasActiveDiscount ? (float)$row['discount_price'] : $price;
    $promoPreview = function_exists('apply_promotions_to_catalog_item')
        ? apply_promotions_to_catalog_item([
            'product_id' => (int)$product['id'],
            'variant_id' => (int)$row['id'],
            'category_name' => $product['category_name'] ?: 'General',
            'snapshot_price' => $price,
            'catalog_effective_price' => $catalogEffective,
            'effective_price' => $catalogEffective,
            'catalog_discount_amount' => round(max(0, $price - $catalogEffective), 2),
            'quantity' => 1,
        ], ['is_guest' => true], $promoShippingConfig)
        : [
            'effective_price' => $catalogEffective,
            'promo_discount_amount' => 0,
            'promo_offer' => null,
            'applied_promotions' => [],
        ];
    $effective = (float)($promoPreview['effective_price'] ?? $catalogEffective);
    $specifications = pd_decode_assoc($row['specifications'] ?? null);
    $shippingInfo = trim((string)($row['shipping_info'] ?? ''));
    $returnPolicy = trim((string)($row['return_policy'] ?? ''));
    $warranty = trim((string)($row['warranty'] ?? ''));
    $aboutItem = trim((string)($row['about_item'] ?? ''));

    if ($primaryWarranty === null && $warranty !== '' && strtolower($warranty) !== 'null') {
        $primaryWarranty = $warranty;
    }
    if ($primaryAboutItem === null && $aboutItem !== '' && strtolower($aboutItem) !== 'null') {
        $primaryAboutItem = $aboutItem;
    }

    $variants[] = [
        'id' => (int)$row['id'],
        'variant_id' => (int)$row['id'],
        'sku' => $row['sku'],
        'price' => $price,
        'effective_price' => $effective,
        'catalog_effective_price' => $catalogEffective,
        'promo_discount_amount' => round((float)($promoPreview['promo_discount_amount'] ?? 0), 2),
        'promo_offer' => $promoPreview['promo_offer'] ?? null,
        'applied_promotions' => array_values(is_array($promoPreview['applied_promotions'] ?? null) ? $promoPreview['applied_promotions'] : []),
        'discount_end' => $row['discount_end'],
        'availability' => ((int)$row['stock_quantity'] > 0),
        'stock_status' => ((int)$row['stock_quantity'] > 0) ? 'in_stock' : 'out_of_stock',
        'tax_included' => ((int)$row['tax_included'] === 1),
        'tax_rate' => (float)$row['tax_rate'],
        'variants' => [
            'color' => $row['color'],
            'size' => $row['size']
        ],
        'specifications' => $specifications,
        'shipping_info' => $shippingInfo !== '' ? $shippingInfo : null,
        'return_policy' => $returnPolicy !== '' ? $returnPolicy : null,
        'images' => [
            $row['image'] ?: ($product['image'] ?: 'https://via.placeholder.com/400')
        ],
        'rating_avg' => round((float)$stats['avg_rating'], 1),
        'rating_count' => (int)$stats['total'],
        'description' => $product['name']
    ];
}

ok([
    'id' => (int)$product['id'],
    'product_id' => (int)$product['id'],
    'name' => $product['name'],
    'description' => $product['description'],
    'info' => [
        'rating_distribution' => $distribution,
        'warranty' => $primaryWarranty ?: 'Standard seller warranty.',
        'about_item' => pd_normalize_about_item($primaryAboutItem, $product['description'])
    ],
    'variants' => $variants,
    'reviews' => $reviews
]);
