<?php

declare(strict_types=1);

/**
 * One-time migration script.
 * Visit: http://localhost/ecommerce/run_migration.php
 * Delete this file after running.
 */

require_once __DIR__ . '/lib/config.php';
require_once __DIR__ . '/lib/db.php';

header('Content-Type: text/plain; charset=utf-8');

$pdo = db();

function table_exists(PDO $pdo, string $table): bool
{
  $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1');
  $stmt->execute([$table]);
  return (bool)$stmt->fetchColumn();
}

function column_exists(PDO $pdo, string $table, string $column): bool
{
  $stmt = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1');
  $stmt->execute([$table, $column]);
  return (bool)$stmt->fetchColumn();
}

function slugify(string $value): string
{
  $slug = strtolower(trim($value));
  $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
  $slug = trim($slug, '-');
  return $slug !== '' ? $slug : 'category';
}

try {
  if (!table_exists($pdo, 'categories') || !column_exists($pdo, 'categories', 'name')) {
    echo "[SKIP] sync_catalog_categories: categories table/columns not found\n";
  } else {
    $categories = ['Electronics', 'Mobiles', 'Clothing', 'Shoes', "Men's Shirts", "Women's Dresses", 'Books'];
    $hasSlug = column_exists($pdo, 'categories', 'slug');

    if ($hasSlug) {
      $stmt = $pdo->prepare(
        'INSERT INTO categories (name, slug) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), slug = VALUES(slug)'
      );
      foreach ($categories as $name) {
        $stmt->execute([$name, slugify($name)]);
      }
    } else {
      $stmt = $pdo->prepare('INSERT INTO categories (name) VALUES (?) ON DUPLICATE KEY UPDATE name = VALUES(name)');
      foreach ($categories as $name) {
        $stmt->execute([$name]);
      }
    }

    echo "[OK] sync_catalog_categories\n";
  }
} catch (PDOException $e) {
  echo "[ERR] sync_catalog_categories: " . $e->getMessage() . "\n";
}

try {
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS payment_transactions (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      session_token CHAR(40) NOT NULL UNIQUE,
      idem_key CHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED DEFAULT NULL,
      guest_token VARCHAR(80) DEFAULT NULL,
      payment_method ENUM('card', 'upi') NOT NULL,
      provider VARCHAR(40) NOT NULL DEFAULT 'razorpay',
      amount DECIMAL(10,2) NOT NULL,
      currency CHAR(3) NOT NULL DEFAULT 'INR',
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
      shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      status ENUM('created', 'captured', 'failed', 'expired') NOT NULL DEFAULT 'created',
      provider_order_id VARCHAR(80) DEFAULT NULL,
      provider_payment_id VARCHAR(80) DEFAULT NULL,
      provider_signature VARCHAR(255) DEFAULT NULL,
      checkout_payload JSON DEFAULT NULL,
      error_message VARCHAR(255) DEFAULT NULL,
      order_id BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_payment_tx_user (user_id),
      KEY idx_payment_tx_guest (guest_token),
      KEY idx_payment_tx_idem (idem_key),
      KEY idx_payment_tx_order (order_id)
    )"
  );

  echo "[OK] create_payment_transactions_table\n";
} catch (PDOException $e) {
  echo "[ERR] create_payment_transactions_table: " . $e->getMessage() . "\n";
}

try {
  $pdo->exec(
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
      KEY idx_promotions_priority (priority, is_primary)
    )"
  );

  echo "[OK] create_promotions_table\n";
} catch (PDOException $e) {
  echo "[ERR] create_promotions_table: " . $e->getMessage() . "\n";
}

try {
  if (!table_exists($pdo, 'categories') || !table_exists($pdo, 'products')) {
    echo "[SKIP] cleanup_unused_non_catalog_categories: categories/products table missing\n";
  } else {
    $categoryPk = column_exists($pdo, 'categories', 'id')
      ? 'id'
      : (column_exists($pdo, 'categories', 'category_id') ? 'category_id' : null);
    $productCategoryFk = column_exists($pdo, 'products', 'category_id') ? 'category_id' : null;
    $productPk = column_exists($pdo, 'products', 'id')
      ? 'id'
      : (column_exists($pdo, 'products', 'product_id') ? 'product_id' : null);

    if ($categoryPk === null || $productCategoryFk === null || $productPk === null || !column_exists($pdo, 'categories', 'name')) {
      echo "[SKIP] cleanup_unused_non_catalog_categories: required columns not found\n";
    } else {
      $guards = ["p.{$productPk} IS NULL"];

      if (table_exists($pdo, 'products_detail') && column_exists($pdo, 'products_detail', 'category_id')) {
        $guards[] = "NOT EXISTS (SELECT 1 FROM products_detail pd WHERE pd.category_id = c.{$categoryPk})";
      }

      $sql = "DELETE c
          FROM categories c
          LEFT JOIN products p ON p.{$productCategoryFk} = c.{$categoryPk}
          WHERE " . implode(' AND ', $guards) . "
            AND c.name NOT IN (
            'Electronics',
            'Mobiles',
            'Clothing',
            'Shoes',
            'Men''s Shirts',
            'Women''s Dresses',
            'Books'
            )";
      $pdo->exec($sql);
      echo "[OK] cleanup_unused_non_catalog_categories\n";
    }
  }
} catch (PDOException $e) {
  echo "[ERR] cleanup_unused_non_catalog_categories: " . $e->getMessage() . "\n";
}

try {
  if (!table_exists($pdo, 'users') || !column_exists($pdo, 'users', 'role')) {
    echo "[SKIP] expand_user_role_enum_for_super_admin: users.role not found\n";
  } else {
    $pdo->exec("UPDATE users
      SET role = CASE
        WHEN role IS NULL OR TRIM(role) = '' THEN 'customer'
        WHEN LOWER(TRIM(role)) IN ('super_admin', 'super admin', 'superadmin') THEN 'admin'
        WHEN LOWER(TRIM(role)) IN ('admin', 'administrator', 'root') THEN 'admin'
        WHEN LOWER(TRIM(role)) IN ('customer', 'user', 'buyer', 'guest') THEN 'customer'
        ELSE 'customer'
      END");
    $pdo->exec("ALTER TABLE users MODIFY COLUMN role ENUM('customer', 'admin', 'super_admin') NOT NULL DEFAULT 'customer'");
    echo "[OK] expand_user_role_enum_for_super_admin\n";
  }
} catch (PDOException $e) {
  echo "[ERR] expand_user_role_enum_for_super_admin: " . $e->getMessage() . "\n";
}

try {
  if (!table_exists($pdo, 'users') || !column_exists($pdo, 'users', 'role')) {
    echo "[SKIP] promote_admin_users_to_super_admin: users.role not found\n";
  } else {
    $pdo->exec("UPDATE users SET role = 'super_admin' WHERE LOWER(role) = 'admin'");
    echo "[OK] promote_admin_users_to_super_admin\n";
  }
} catch (PDOException $e) {
  echo "[ERR] promote_admin_users_to_super_admin: " . $e->getMessage() . "\n";
}

echo "\nDone. Delete this file now.\n";
