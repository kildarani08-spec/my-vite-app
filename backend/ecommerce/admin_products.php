<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function ap_table_exists(string $table): bool
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

function ap_column_exists(string $table, string $column): bool
{
    static $cache = [];
    $key = $table . '.' . $column;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = db()->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1');
    $stmt->execute([$table, $column]);
    $cache[$key] = (bool)$stmt->fetchColumn();

    return $cache[$key];
}

function ap_category_pk(): string
{
    return ap_column_exists('categories', 'id') ? 'id' : 'category_id';
}

function ap_variant_table(): string
{
    return ap_table_exists('product_variants') ? 'product_variants' : 'products_detail';
}

function ap_cart_table(): string
{
    if (ap_table_exists('carts')) {
        return 'carts';
    }

    return ap_table_exists('cart') ? 'cart' : '';
}

function ap_wishlist_table(): string
{
    if (ap_table_exists('wishlist_items')) {
        return 'wishlist_items';
    }

    return ap_table_exists('wishlist') ? 'wishlist' : '';
}

function ap_slugify(string $value): string
{
    $slug = strtolower(trim($value));
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
    $slug = trim($slug, '-');
    return $slug !== '' ? $slug : 'category';
}

$admin = auth_user(true);
$method = $_SERVER['REQUEST_METHOD'];

$categoryNames = ['Electronics', 'Mobiles', 'Clothing', 'Shoes', "Men's Shirts", "Women's Dresses", 'Books'];
$hasSlug = ap_column_exists('categories', 'slug');
if ($hasSlug) {
    $syncCategoriesStmt = db()->prepare('INSERT INTO categories (name, slug) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), slug = VALUES(slug)');
    foreach ($categoryNames as $categoryName) {
        $syncCategoriesStmt->execute([$categoryName, ap_slugify($categoryName)]);
    }
} else {
    $syncCategoriesStmt = db()->prepare('INSERT INTO categories (name) VALUES (?) ON DUPLICATE KEY UPDATE name = VALUES(name)');
    foreach ($categoryNames as $categoryName) {
        $syncCategoriesStmt->execute([$categoryName]);
    }
}

$categoryPk = ap_category_pk();
$cleanupCategoriesStmt = db()->prepare(
        "DELETE c
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.{$categoryPk}
         WHERE p.id IS NULL
             AND c.name NOT IN (
                 'Electronics',
                 'Mobiles',
                 'Clothing',
                 'Shoes',
                 'Men\'s Shirts',
                 'Women\'s Dresses',
                 'Books'
             )"
);
try {
    $cleanupCategoriesStmt->execute();
} catch (Throwable) {
    // Some schemas enforce category foreign keys (e.g. products_detail.category_id).
    // Keep request flow working even if cleanup cannot run safely.
}

if ($method === 'GET') {
    $q = strtolower(trim((string)($_GET['q'] ?? '')));
    $status = trim((string)($_GET['status'] ?? ''));

        $variantTable = ap_table_exists('product_variants') ? 'product_variants' : 'products_detail';
        $variantPriceCol = ap_table_exists('product_variants') ? 'base_price' : 'price';
    $sql = 'SELECT p.id, p.name, p.sku, p.status,
                   COUNT(v.id) AS variant_count,
                 MIN(v.' . $variantPriceCol . ') AS min_base_price,
                   SUM(v.stock_quantity) AS total_stock
            FROM products p
             LEFT JOIN ' . $variantTable . ' v ON v.product_id = p.id
            WHERE 1=1';
    $bind = [];

    if ($q !== '') {
        $sql .= ' AND (LOWER(p.name) LIKE ? OR LOWER(p.sku) LIKE ?)';
        $like = '%' . $q . '%';
        $bind[] = $like;
        $bind[] = $like;
    }

    if ($status !== '') {
        $sql .= ' AND p.status = ?';
        $bind[] = $status;
    }

    $sql .= ' GROUP BY p.id ORDER BY p.updated_at DESC';

    $stmt = db()->prepare($sql);
    $stmt->execute($bind);
    ok(['products' => $stmt->fetchAll()]);
}

if ($method !== 'POST') {
    fail('Method not allowed', 405);
}

$body = json_input();
$action = trim((string)($body['action'] ?? ''));

if ($action === 'create') {
    $name = trim((string)($body['name'] ?? ''));
    $basePrice = max(0, (float)($body['base_price'] ?? 0));
    if ($name === '') {
        fail('Product name is required');
    }

    $productStmt = db()->prepare('INSERT INTO products (category_id, name, description, price, status, sku, image) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $productStmt->execute([
        isset($body['category_id']) ? (int)$body['category_id'] : null,
        $name,
        trim((string)($body['description'] ?? '')),
        $basePrice,
        trim((string)($body['status'] ?? 'active')) ?: 'active',
        trim((string)($body['product_sku'] ?? '')) ?: null,
        trim((string)($body['image'] ?? '')) ?: null,
    ]);

    $productId = (int)db()->lastInsertId();
    if (ap_table_exists('product_variants')) {
        $variantStmt = db()->prepare('INSERT INTO product_variants (product_id, sku, base_price, stock_quantity, tax_rate, tax_included, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $variantStmt->execute([
            $productId,
            trim((string)($body['variant_sku'] ?? '')) ?: null,
            $basePrice,
            (int)($body['stock_quantity'] ?? 0),
            (float)($body['tax_rate'] ?? 18),
            !empty($body['tax_included']) ? 1 : 0,
            trim((string)($body['status'] ?? 'active')) ?: 'active',
        ]);
    } else {
        $variantStmt = db()->prepare('INSERT INTO products_detail (product_id, category_id, sku, price, base_price, stock_quantity, tax_rate, tax_included, availability, discount_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stockQty = (int)($body['stock_quantity'] ?? 0);
        $variantStmt->execute([
            $productId,
            isset($body['category_id']) ? (int)$body['category_id'] : null,
            trim((string)($body['variant_sku'] ?? '')) ?: null,
            $basePrice,
            $basePrice,
            $stockQty,
            (float)($body['tax_rate'] ?? 18),
            !empty($body['tax_included']) ? 1 : 0,
            $stockQty > 0 ? 'in_stock' : 'out_of_stock',
            null,
        ]);
    }

    log_admin_action(
        (int)$admin['id'],
        'product_create',
        'product',
        (string)$productId,
        [
            'name' => $name,
            'category_id' => isset($body['category_id']) ? (int)$body['category_id'] : null,
            'status' => trim((string)($body['status'] ?? 'active')) ?: 'active',
        ]
    );

    ok(['message' => 'Product created', 'product_id' => $productId]);
}

if ($action === 'delete') {
    $productId = (int)($body['product_id'] ?? 0);
    if ($productId <= 0) {
        fail('Invalid product id');
    }

    $productStmt = db()->prepare('SELECT id, name, status FROM products WHERE id = ? LIMIT 1');
    $productStmt->execute([$productId]);
    $product = $productStmt->fetch();

    if (!$product) {
        fail('Product not found', 404);
    }

    $pdo = db();
    $variantTable = ap_variant_table();
    $cartTable = ap_cart_table();
    $wishlistTable = ap_wishlist_table();
    $hasVariantStatus = ap_column_exists($variantTable, 'status');
    $hasAvailability = ap_column_exists($variantTable, 'availability');
    $orderItemCount = 0;

    if (ap_table_exists('order_items')) {
        $orderCheck = $pdo->prepare('SELECT COUNT(*) FROM order_items WHERE product_id = ?');
        $orderCheck->execute([$productId]);
        $orderItemCount = (int)$orderCheck->fetchColumn();
    }

    $pdo->beginTransaction();

    try {
        if ($cartTable !== '') {
            $clearCartStmt = $pdo->prepare('DELETE FROM ' . $cartTable . ' WHERE product_id = ?');
            $clearCartStmt->execute([$productId]);
        }

        if ($wishlistTable !== '') {
            $clearWishlistStmt = $pdo->prepare('DELETE FROM ' . $wishlistTable . ' WHERE product_id = ?');
            $clearWishlistStmt->execute([$productId]);
        }

        if (ap_table_exists('reviews')) {
            $clearReviewsStmt = $pdo->prepare('DELETE FROM reviews WHERE product_id = ?');
            $clearReviewsStmt->execute([$productId]);
        }

        if ($orderItemCount === 0) {
            $deleteVariantsStmt = $pdo->prepare('DELETE FROM ' . $variantTable . ' WHERE product_id = ?');
            $deleteVariantsStmt->execute([$productId]);

            $deleteProductStmt = $pdo->prepare('DELETE FROM products WHERE id = ?');
            $deleteProductStmt->execute([$productId]);

            $pdo->commit();

            log_admin_action(
                (int)$admin['id'],
                'product_delete',
                'product',
                (string)$productId,
                ['name' => (string)($product['name'] ?? ''), 'mode' => 'hard-delete']
            );

            ok(['message' => 'Product deleted', 'deleted' => true]);
        }

        $variantUpdates = [];
        if ($hasVariantStatus) {
            $variantUpdates[] = 'status = "inactive"';
        }
        if ($hasAvailability) {
            $variantUpdates[] = 'availability = "out_of_stock"';
        }

        if (!empty($variantUpdates)) {
            $archiveVariantsStmt = $pdo->prepare('UPDATE ' . $variantTable . ' SET ' . implode(', ', $variantUpdates) . ' WHERE product_id = ?');
            $archiveVariantsStmt->execute([$productId]);
        }

        $archiveProductStmt = $pdo->prepare('UPDATE products SET status = ? WHERE id = ?');
        $archiveProductStmt->execute(['inactive', $productId]);

        $pdo->commit();

        log_admin_action(
            (int)$admin['id'],
            'product_archive',
            'product',
            (string)$productId,
            ['name' => (string)($product['name'] ?? ''), 'status' => 'inactive', 'reason' => 'order-history']
        );

        ok([
            'message' => 'Product archived because it already has order history.',
            'deleted' => false,
            'archived' => true
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        fail('Unable to delete product right now. Please try again.', 500);
    }
}

if ($action === 'update') {
    $productId = (int)($body['product_id'] ?? 0);
    if ($productId <= 0) {
        fail('Invalid product id');
    }

    $allowedFields = ['name', 'description', 'status', 'image'];
    $sets = [];
    $bind = [];

    foreach ($allowedFields as $field) {
        if (array_key_exists($field, $body)) {
            $sets[] = "{$field} = ?";
            $value = trim((string)($body[$field] ?? ''));
            $bind[] = ($value === '') ? null : $value;
        }
    }

    if (empty($sets)) {
        fail('No fields to update');
    }

    $bind[] = $productId;
    $stmt = db()->prepare('UPDATE products SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($bind);

    log_admin_action(
        (int)$admin['id'],
        'product_update',
        'product',
        (string)$productId,
        array_combine($allowedFields, array_map(fn($f) => $body[$f] ?? null, $allowedFields))
    );

    ok(['message' => 'Product updated']);
}

fail('Invalid action');
