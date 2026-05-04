CREATE DATABASE IF NOT EXISTS ecommerce CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ecommerce;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer', 'admin', 'super_admin') NOT NULL DEFAULT 'customer',
  status ENUM('active', 'inactive', 'blocked') NOT NULL DEFAULT 'active',
  phone VARCHAR(20) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  category_id BIGINT UNSIGNED DEFAULT NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  sku VARCHAR(80) DEFAULT NULL,
  image VARCHAR(255) DEFAULT NULL,
  payment_offer VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(80) DEFAULT NULL,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_price DECIMAL(10,2) DEFAULT NULL,
  discount_end DATETIME DEFAULT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  tax_included TINYINT(1) NOT NULL DEFAULT 0,
  color VARCHAR(50) DEFAULT NULL,
  size VARCHAR(50) DEFAULT NULL,
  image VARCHAR(255) DEFAULT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT NOT NULL,
  review_text TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_wishlist (user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS addresses (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(40) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(191) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  street_address VARCHAR(255) NOT NULL,
  city VARCHAR(120) NOT NULL,
  state VARCHAR(120) NOT NULL,
  zip VARCHAR(20) NOT NULL,
  country VARCHAR(80) DEFAULT 'India',
  landmark VARCHAR(120) DEFAULT NULL,
  instructions VARCHAR(255) DEFAULT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  use_for_billing TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS carts (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED DEFAULT NULL,
  guest_token VARCHAR(80) DEFAULT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  variant_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_variant (user_id, variant_id),
  UNIQUE KEY uniq_guest_variant (guest_token, variant_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS promotions (
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
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(30) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  shipping_address_id BIGINT UNSIGNED NOT NULL,
  billing_address_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  payment_status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  payment_method ENUM('card', 'upi', 'cod') NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  grand_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shipping_address_id) REFERENCES addresses(id),
  FOREIGN KEY (billing_address_id) REFERENCES addresses(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  variant_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (variant_id) REFERENCES product_variants(id)
);

CREATE TABLE IF NOT EXISTS order_events (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  title VARCHAR(160) NOT NULL,
  details TEXT,
  actor_type ENUM('system', 'customer', 'admin', 'webhook') NOT NULL DEFAULT 'system',
  actor_id BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_events_order (order_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  channel ENUM('email') NOT NULL DEFAULT 'email',
  recipient VARCHAR(191) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_html MEDIUMTEXT,
  body_text MEDIUMTEXT,
  status ENUM('queued', 'sent', 'failed') NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  last_error VARCHAR(255) DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME DEFAULT NULL,
  KEY idx_notification_status (status),
  KEY idx_notification_created (created_at),
  KEY idx_notification_next_attempt (next_attempt_at)
);

CREATE TABLE IF NOT EXISTS settings (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(120) NOT NULL UNIQUE,
  setting_value JSON NOT NULL,
  updated_by BIGINT UNSIGNED DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS checkout_requests (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  idem_key CHAR(64) NOT NULL,
  status ENUM('processing', 'completed', 'failed') NOT NULL DEFAULT 'processing',
  order_id BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_checkout_user_key (user_id, idem_key),
  KEY idx_checkout_order (order_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payment_transactions (
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
  KEY idx_payment_tx_order (order_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  action_type VARCHAR(80) NOT NULL,
  target_type VARCHAR(80) NOT NULL,
  target_id VARCHAR(120) DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  ip_address VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_admin_audit_admin (admin_user_id),
  KEY idx_admin_audit_action (action_type),
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rate_limits (
  rate_key CHAR(64) PRIMARY KEY,
  hit_count INT NOT NULL DEFAULT 0,
  window_expires_at DATETIME NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO users (name, email, password_hash, role, status)
VALUES (
  'Admin',
  'admin@myshop.com',
  '$2y$10$rU3A8q6m1rDK4pH7TrxY5OL.CBP7f6E0Vf6tR5hi7Yn.YqWGmLh8i',
  'super_admin',
  'active'
) ON DUPLICATE KEY UPDATE email=email;

INSERT INTO categories (name)
VALUES ('Fashion'), ('Electronics'), ('Home'), ('Beauty'), ('Sports')
ON DUPLICATE KEY UPDATE name=name;

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'Classic Crew T-Shirt', 'Soft cotton everyday t-shirt for all-day comfort.', 'active', 'FASH-TSHIRT-001', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Fashion'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'FASH-TSHIRT-001');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'Slim Fit Denim Jeans', 'Modern fit denim with stretch comfort.', 'active', 'FASH-DENIM-001', 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Fashion'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'FASH-DENIM-001');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'Street Runner Sneakers', 'Lightweight sneakers designed for city walks and daily wear.', 'active', 'FASH-SHOE-001', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Fashion'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'FASH-SHOE-001');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'True Wireless Earbuds X2', 'Noise-reduced audio with low-latency bluetooth mode.', 'active', 'ELEC-EARBUD-001', 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f37?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Electronics'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'ELEC-EARBUD-001');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'Smart Watch Pro Fit', 'Heart-rate tracking, sleep analytics, and workout modes.', 'active', 'ELEC-WATCH-001', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Electronics'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'ELEC-WATCH-001');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'Portable Bluetooth Speaker', 'Punchy sound and long battery life for indoor/outdoor listening.', 'active', 'ELEC-SPKR-001', 'https://images.unsplash.com/photo-1589003077984-894e133dabab?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Electronics'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'ELEC-SPKR-001');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'Ceramic Table Lamp', 'Minimal warm-light lamp for bedside and workspace corners.', 'active', 'HOME-LAMP-001', 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Home'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'HOME-LAMP-001');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'Kitchen Power Blender', 'Multi-speed blender for smoothies, sauces, and prep mixes.', 'active', 'HOME-BLEND-001', 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Home'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'HOME-BLEND-001');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'Hydra Glow Serum', 'Daily hydration serum for balanced and radiant skin.', 'active', 'BEAUTY-SERUM-001', 'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Beauty'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'BEAUTY-SERUM-001');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'Active Yoga Mat', 'Non-slip 6mm workout mat for yoga and stretching.', 'active', 'SPORT-MAT-001', 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Sports'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'SPORT-MAT-001');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'FASH-TSHIRT-001-V1', 899, 699, 60, 18, 0, 'active'
FROM products p
WHERE p.sku = 'FASH-TSHIRT-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'FASH-TSHIRT-001-V1');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'FASH-DENIM-001-V1', 1999, 1599, 42, 18, 0, 'active'
FROM products p
WHERE p.sku = 'FASH-DENIM-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'FASH-DENIM-001-V1');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'FASH-SHOE-001-V1', 3299, 2799, 35, 18, 0, 'active'
FROM products p
WHERE p.sku = 'FASH-SHOE-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'FASH-SHOE-001-V1');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'ELEC-EARBUD-001-V1', 2499, 1999, 50, 18, 0, 'active'
FROM products p
WHERE p.sku = 'ELEC-EARBUD-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'ELEC-EARBUD-001-V1');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'ELEC-WATCH-001-V1', 4999, 4299, 28, 18, 0, 'active'
FROM products p
WHERE p.sku = 'ELEC-WATCH-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'ELEC-WATCH-001-V1');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'ELEC-SPKR-001-V1', 3499, 2899, 31, 18, 0, 'active'
FROM products p
WHERE p.sku = 'ELEC-SPKR-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'ELEC-SPKR-001-V1');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'HOME-LAMP-001-V1', 1499, 1199, 44, 18, 0, 'active'
FROM products p
WHERE p.sku = 'HOME-LAMP-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'HOME-LAMP-001-V1');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'HOME-BLEND-001-V1', 3899, 3299, 22, 18, 0, 'active'
FROM products p
WHERE p.sku = 'HOME-BLEND-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'HOME-BLEND-001-V1');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'BEAUTY-SERUM-001-V1', 1299, 999, 64, 18, 0, 'active'
FROM products p
WHERE p.sku = 'BEAUTY-SERUM-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'BEAUTY-SERUM-001-V1');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'SPORT-MAT-001-V1', 1799, 1399, 47, 18, 0, 'active'
FROM products p
WHERE p.sku = 'SPORT-MAT-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'SPORT-MAT-001-V1');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'Weekend Travel Backpack', 'Water-resistant backpack with laptop sleeve and multiple travel compartments.', 'active', 'FASH-BAG-001', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Fashion'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'FASH-BAG-001');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'Noise Cancel Headphones H9', 'Over-ear wireless headphones with adaptive noise cancellation and deep bass.', 'active', 'ELEC-HEADPH-001', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Electronics'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'ELEC-HEADPH-001');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, '4K Streaming Stick', 'Smart TV streaming stick with voice remote and all major app support.', 'active', 'ELEC-STREAM-001', 'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Electronics'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'ELEC-STREAM-001');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'Air Fryer Family XL', 'Large-capacity digital air fryer for healthy and fast home cooking.', 'active', 'HOME-AIRFRY-001', 'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Home'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'HOME-AIRFRY-001');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'Luxury Cotton Bedsheet Set', 'Breathable premium cotton bedsheet set with two pillow covers.', 'active', 'HOME-BED-001', 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Home'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'HOME-BED-001');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'Matte Lip Color Kit', 'Long-lasting matte lip shades with smooth finish and transfer resistance.', 'active', 'BEAUTY-LIP-001', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Beauty'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'BEAUTY-LIP-001');

INSERT INTO products (category_id, name, description, status, sku, image)
SELECT c.id, 'Home Workout Dumbbell Set', 'Adjustable dumbbell set for strength training and home fitness routines.', 'active', 'SPORT-DBELL-001', 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80'
FROM categories c
WHERE c.name = 'Sports'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = 'SPORT-DBELL-001');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'FASH-BAG-001-V1', 2499, 1999, 39, 18, 0, 'active'
FROM products p
WHERE p.sku = 'FASH-BAG-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'FASH-BAG-001-V1');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'ELEC-HEADPH-001-V1', 6999, 5799, 24, 18, 0, 'active'
FROM products p
WHERE p.sku = 'ELEC-HEADPH-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'ELEC-HEADPH-001-V1');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'ELEC-STREAM-001-V1', 3499, 2999, 41, 18, 0, 'active'
FROM products p
WHERE p.sku = 'ELEC-STREAM-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'ELEC-STREAM-001-V1');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'HOME-AIRFRY-001-V1', 8999, 7699, 19, 18, 0, 'active'
FROM products p
WHERE p.sku = 'HOME-AIRFRY-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'HOME-AIRFRY-001-V1');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'HOME-BED-001-V1', 3299, 2599, 36, 18, 0, 'active'
FROM products p
WHERE p.sku = 'HOME-BED-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'HOME-BED-001-V1');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'BEAUTY-LIP-001-V1', 1499, 1099, 53, 18, 0, 'active'
FROM products p
WHERE p.sku = 'BEAUTY-LIP-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'BEAUTY-LIP-001-V1');

INSERT INTO product_variants (product_id, sku, base_price, discount_price, stock_quantity, tax_rate, tax_included, status)
SELECT p.id, 'SPORT-DBELL-001-V1', 4599, 3999, 29, 18, 0, 'active'
FROM products p
WHERE p.sku = 'SPORT-DBELL-001'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku = 'SPORT-DBELL-001-V1');

INSERT INTO reviews (user_id, product_id, rating, review_text)
SELECT 1, p.id, 5, 'Excellent value and quality. Fast delivery too.'
FROM products p
WHERE p.sku = 'ELEC-HEADPH-001'
  AND NOT EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.user_id = 1
      AND r.product_id = p.id
      AND r.review_text = 'Excellent value and quality. Fast delivery too.'
  );

INSERT INTO reviews (user_id, product_id, rating, review_text)
SELECT 1, p.id, 4, 'Looks premium and performs as expected for daily use.'
FROM products p
WHERE p.sku = 'HOME-AIRFRY-001'
  AND NOT EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.user_id = 1
      AND r.product_id = p.id
      AND r.review_text = 'Looks premium and performs as expected for daily use.'
  );

INSERT INTO reviews (user_id, product_id, rating, review_text)
SELECT 1, p.id, 5, 'Great fit and comfort. Definitely buying again.'
FROM products p
WHERE p.sku = 'FASH-DENIM-001'
  AND NOT EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.user_id = 1
      AND r.product_id = p.id
      AND r.review_text = 'Great fit and comfort. Definitely buying again.'
  );

INSERT INTO settings (setting_key, setting_value)
VALUES (
  'site_content',
  JSON_OBJECT(
    'brand', JSON_OBJECT(
      'name', 'MYSHOP',
      'tagline', 'Everyday products, clear prices, fast checkout.',
      'supportEmail', 'support@myshop.com',
      'supportPhone', '+910000000000',
      'supportHours', 'Mon - Sat, 9:00 AM to 8:00 PM'
    ),
    'offers', JSON_OBJECT(
      'promoStrip', JSON_OBJECT('enabled', true, 'text', 'Free shipping on orders over Rs.999', 'to', '/products?minPrice=999&offer=free-shipping'),
      'freeShippingThreshold', 999,
      'standardShippingFee', 80,
      'freeShippingProgressTemplate', 'Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.',
      'freeShippingUnlockedText', 'Free shipping applied.'
    ),
    'checkout', JSON_OBJECT(
      'paymentSectionTitle', 'Payment Method',
      'paymentMethods', JSON_ARRAY(
        JSON_OBJECT('id', 'card', 'label', 'Credit/Debit Card', 'enabled', true),
        JSON_OBJECT('id', 'upi', 'label', 'UPI', 'enabled', true),
        JSON_OBJECT('id', 'cod', 'label', 'Cash on Delivery', 'enabled', true)
      )
    ),
    'homePage', JSON_OBJECT(
      'announcement', 'Everything store for everyday life',
      'heroSlides', JSON_ARRAY(
        JSON_OBJECT(
          'id', 'hero-1',
          'title', 'Shop fashion, electronics, home, beauty and more.',
          'subtitle', 'One destination for all categories, verified quality, and fast checkout.',
          'image', 'https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=1600&q=80',
          'ctaLabel', 'Shop all categories',
          'ctaTo', '/products'
        ),
        JSON_OBJECT(
          'id', 'hero-2',
          'title', 'Daily deals across every department.',
          'subtitle', 'Compare prices, ratings, and delivery options before you buy.',
          'image', 'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1600&q=80',
          'ctaLabel', 'Explore best rated',
          'ctaTo', '/products?sort=rating'
        ),
        JSON_OBJECT(
          'id', 'hero-3',
          'title', 'Big basket energy, small-cart convenience.',
          'subtitle', 'From single-item buys to bulk household orders, checkout stays simple.',
          'image', 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80',
          'ctaLabel', 'View offers',
          'ctaTo', '/products?offer=free-shipping&minPrice=999'
        )
      ),
      'trustBadges', JSON_ARRAY('Secure checkout', 'Easy returns', 'Support 7 days', 'Fast dispatch'),
      'primaryCategories', JSON_ARRAY(
        JSON_OBJECT('id', 'cat-fashion', 'label', 'Fashion', 'to', '/products?category=Fashion', 'image', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80'),
        JSON_OBJECT('id', 'cat-electronics', 'label', 'Electronics', 'to', '/products?category=Electronics', 'image', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80'),
        JSON_OBJECT('id', 'cat-home', 'label', 'Home', 'to', '/products?category=Home', 'image', 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=800&q=80'),
        JSON_OBJECT('id', 'cat-beauty', 'label', 'Beauty', 'to', '/products?category=Beauty', 'image', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80'),
        JSON_OBJECT('id', 'cat-sports', 'label', 'Sports', 'to', '/products?category=Sports', 'image', 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80')
      ),
      'spotlightCards', JSON_ARRAY(
        JSON_OBJECT('id', 'spot-1', 'title', 'Top picks this week', 'subtitle', 'High-rated products across categories.', 'to', '/products?sort=rating', 'tone', 'warm'),
        JSON_OBJECT('id', 'spot-2', 'title', 'Free shipping zone', 'subtitle', 'Unlock delivery savings on larger carts.', 'to', '/products?offer=free-shipping&minPrice=999', 'tone', 'mint'),
        JSON_OBJECT('id', 'spot-3', 'title', 'New arrivals', 'subtitle', 'Fresh stock added recently.', 'to', '/products?sort=relevance', 'tone', 'sky')
      )
    )
  )
) ON DUPLICATE KEY UPDATE setting_key=setting_key;

INSERT INTO settings (setting_key, setting_value)
VALUES (
  'operational_settings',
  JSON_OBJECT(
    'paymentGateway', JSON_OBJECT(
      'provider', 'demo-gateway',
      'webhookEnabled', false,
      'webhookSecret', ''
    ),
    'notifications', JSON_OBJECT(
      'provider', 'mail',
      'smtpHost', '',
      'smtpPort', 587,
      'smtpUser', '',
      'smtpPass', '',
      'sendgridApiKey', '',
      'mailgunDomain', '',
      'mailgunApiKey', '',
      'fromEmail', 'support@myshop.com',
      'enabled', false
    ),
    'features', JSON_OBJECT(
      'allowGuestCheckout', true,
      'maintenanceMode', false
    ),
    'jobs', JSON_OBJECT(
      'workerEnabled', false,
      'workerToken', '',
      'outboxBatchSize', 25,
      'maxEmailAttempts', 3,
      'retryBackoffSeconds', 90
    )
  )
) ON DUPLICATE KEY UPDATE setting_key=setting_key;
