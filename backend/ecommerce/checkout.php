<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function checkout_user_phone_column(): string
{
    if (db_column_exists('users', 'phone_number')) {
        return 'phone_number';
    }

    if (db_column_exists('users', 'phone')) {
        return 'phone';
    }

    return '';
}

function checkout_has_request_tracking(): bool
{
    return db_table_exists('checkout_requests');
}

function checkout_has_modern_addresses(): bool
{
    return db_table_exists('addresses');
}

function checkout_has_legacy_addresses(): bool
{
    return db_table_exists('user_addresses');
}

function checkout_cart_table_name(): string
{
    return db_table_exists('carts') ? 'carts' : 'cart';
}

function checkout_variant_table_name(): string
{
    return db_table_exists('product_variants') ? 'product_variants' : 'products_detail';
}

function checkout_variant_price_column(): string
{
    if (db_table_exists('product_variants')) {
        return db_column_exists('product_variants', 'base_price') ? 'base_price' : 'price';
    }

    if (db_column_exists('products_detail', 'price')) {
        return 'price';
    }

    return db_column_exists('products_detail', 'base_price') ? 'base_price' : 'price';
}

function checkout_format_address_text(array $address): string
{
    $parts = [
        trim((string)($address['full_name'] ?? '')),
        trim((string)($address['street_address'] ?? $address['shipping_address'] ?? '')),
        trim((string)($address['city'] ?? '')),
        trim((string)($address['state'] ?? '')),
        trim((string)($address['zip'] ?? '')),
        trim((string)($address['country'] ?? '')),
    ];

    return implode(', ', array_values(array_filter($parts, static fn (string $value): bool => $value !== '')));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

$token = bearer_token();
$user = null;

if ($token !== '') {
    cleanup_expired_tokens();
    $authStmt = db()->prepare('SELECT u.id, u.name, u.email, u.role, u.status
                               FROM auth_tokens t
                               JOIN users u ON u.id = t.user_id
                               WHERE t.token = ? AND t.expires_at > NOW() LIMIT 1');
    $authStmt->execute([$token]);
    $resolvedUser = $authStmt->fetch();
    if ($resolvedUser && ($resolvedUser['status'] ?? 'active') === 'active') {
        $user = $resolvedUser;
    }
}

fail_if_admin_purchase($user, 'Admin accounts cannot place orders from the storefront. Please use a customer account.');

$isGuestCheckout = $user === null;
$guestToken = trim((string)($_POST['guestToken'] ?? $_POST['guest_token'] ?? ''));
$shippingAddressId = (int)($_POST['address'] ?? 0);
$billingAddressId = (int)($_POST['billingAddress'] ?? 0);
$paymentMethod = trim((string)($_POST['payment'] ?? 'cod'));
$idempotencyKey = trim((string)($_POST['idempotencyKey'] ?? header_value('Idempotency-Key')));

$guestFullName = trim((string)($_POST['guestFullName'] ?? $_POST['guest_full_name'] ?? ''));
$guestEmail = trim((string)($_POST['guestEmail'] ?? $_POST['guest_email'] ?? ''));
$guestPhone = trim((string)($_POST['guestPhone'] ?? $_POST['guest_phone'] ?? ''));
$guestLabel = trim((string)($_POST['guestLabel'] ?? $_POST['guest_label'] ?? 'Guest Checkout'));
$guestStreetAddress = trim((string)($_POST['guestStreetAddress'] ?? $_POST['guest_street_address'] ?? ''));
$guestCity = trim((string)($_POST['guestCity'] ?? $_POST['guest_city'] ?? ''));
$guestState = trim((string)($_POST['guestState'] ?? $_POST['guest_state'] ?? ''));
$guestZip = trim((string)($_POST['guestZip'] ?? $_POST['guest_zip'] ?? ''));
$guestCountry = trim((string)($_POST['guestCountry'] ?? $_POST['guest_country'] ?? 'India'));
$guestLandmark = trim((string)($_POST['guestLandmark'] ?? $_POST['guest_landmark'] ?? ''));
$guestInstructions = trim((string)($_POST['guestInstructions'] ?? $_POST['guest_instructions'] ?? ''));

if ($isGuestCheckout) {
    if ($guestToken === '') {
        fail('Guest checkout requires a guest cart token', 422);
    }
    if ($guestFullName === '' || $guestEmail === '' || $guestPhone === '' || $guestStreetAddress === '' || $guestCity === '' || $guestState === '' || $guestZip === '') {
        fail('Guest checkout requires full shipping details', 422);
    }
    if (!filter_var($guestEmail, FILTER_VALIDATE_EMAIL)) {
        fail('Guest checkout email is invalid', 422);
    }
}

if (!$isGuestCheckout && ($shippingAddressId <= 0 || $billingAddressId <= 0)) {
    fail('Shipping and billing address are required');
}

if ($idempotencyKey === '' || strlen($idempotencyKey) > 120) {
    fail('Missing or invalid idempotency key', 422);
}

$allowedPayments = enabled_payment_methods();
if (!in_array($paymentMethod, $allowedPayments, true)) {
    fail('Invalid payment method');
}

$settings = site_settings();
$threshold = (float)($settings['offers']['freeShippingThreshold'] ?? 999);
$shippingFee = (float)($settings['offers']['standardShippingFee'] ?? 80);
$promoAddressContext = [];
$orderId = 0;
$orderNumber = '';
$discountAmount = 0.0;
$grandTotal = 0.0;
$userId = 0;
$requestHash = hash('sha256', $idempotencyKey);
$supportsRequestTracking = checkout_has_request_tracking();
$usesModernOrders = db_column_exists('orders', 'shipping_address_id');
$shippingAddressText = '';
$billingAddressText = '';

try {
    if ($isGuestCheckout) {
        $guestUserStmt = db()->prepare('SELECT id, email, role, status FROM users WHERE email = ? LIMIT 1');
        $guestUserStmt->execute([$guestEmail]);
        $existingGuestUser = $guestUserStmt->fetch();

        if ($existingGuestUser) {
            if (($existingGuestUser['status'] ?? 'active') !== 'active') {
                fail('This email cannot be used for guest checkout', 403);
            }
            if (is_admin_role($existingGuestUser['role'] ?? '')) {
                fail('Admin accounts cannot be used for checkout. Please use a customer account.', 403);
            }
            $userId = (int)$existingGuestUser['id'];
        } else {
            $phoneColumn = checkout_user_phone_column();
            if ($phoneColumn !== '') {
                $insertGuestUser = db()->prepare('INSERT INTO users (name, email, password_hash, role, status, ' . $phoneColumn . ') VALUES (?, ?, ?, ?, ?, ?)');
                $insertGuestUser->execute([
                    $guestFullName,
                    $guestEmail,
                    password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT),
                    'customer',
                    'active',
                    $guestPhone,
                ]);
            } else {
                $insertGuestUser = db()->prepare('INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)');
                $insertGuestUser->execute([
                    $guestFullName,
                    $guestEmail,
                    password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT),
                    'customer',
                    'active',
                ]);
            }
            $userId = (int)db()->lastInsertId();
        }
    } else {
        $userId = (int)$user['id'];
    }

    if ($supportsRequestTracking) {
        $requestStmt = db()->prepare('SELECT order_id, status FROM checkout_requests WHERE user_id = ? AND idem_key = ? LIMIT 1');
        $requestStmt->execute([$userId, $requestHash]);
        $requestRow = $requestStmt->fetch();

        if ($requestRow && !empty($requestRow['order_id'])) {
            $existingOrderStmt = db()->prepare('SELECT id, order_number, COALESCE(grand_total, total_amount, 0) AS grand_total FROM orders WHERE id = ? AND user_id = ? LIMIT 1');
            $existingOrderStmt->execute([(int)$requestRow['order_id'], $userId]);
            $existingOrder = $existingOrderStmt->fetch();
            if ($existingOrder) {
                ok([
                    'order_id' => (int)$existingOrder['id'],
                    'order_number' => (string)$existingOrder['order_number'],
                    'grand_total' => round((float)$existingOrder['grand_total'], 2),
                    'idempotent_replay' => true,
                    'guest_checkout' => $isGuestCheckout,
                    'upsell_offer' => $isGuestCheckout ? 'Create your account and unlock 10% off your next order, saved preferences, and faster checkout.' : null,
                    'upsell_coupon' => $isGuestCheckout ? 'WELCOME10' : null,
                ]);
            }
        }

        if ($requestRow && (string)$requestRow['status'] === 'processing') {
            fail('A checkout request is already processing. Please wait and retry.', 409);
        }

        if ($requestRow) {
            $resetRequest = db()->prepare('UPDATE checkout_requests SET status = ?, order_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND idem_key = ?');
            $resetRequest->execute(['processing', $userId, $requestHash]);
        } else {
            $insertRequest = db()->prepare('INSERT INTO checkout_requests (user_id, idem_key, status) VALUES (?, ?, ?)');
            $insertRequest->execute([$userId, $requestHash, 'processing']);
        }
    }

    $orderNumber = 'ORD-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));

    if (function_exists('promotions_table_ready')) {
        promotions_table_ready();
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        if ($isGuestCheckout) {
            $shippingAddressText = implode(', ', array_values(array_filter([
                $guestFullName,
                $guestStreetAddress,
                $guestLandmark,
                $guestCity,
                $guestState,
                $guestZip,
                $guestCountry,
            ], static fn ($value): bool => trim((string)$value) !== '')));
            $billingAddressText = $shippingAddressText;

            if (checkout_has_modern_addresses()) {
                $guestAddressInsert = $pdo->prepare('INSERT INTO addresses (user_id, label, full_name, email, phone_number, street_address, city, state, zip, country, landmark, instructions, is_default, use_for_billing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)');
                $guestAddressInsert->execute([
                    $userId,
                    $guestLabel !== '' ? $guestLabel : 'Guest Checkout',
                    $guestFullName,
                    $guestEmail,
                    $guestPhone,
                    $guestStreetAddress,
                    $guestCity,
                    $guestState,
                    $guestZip,
                    $guestCountry !== '' ? $guestCountry : 'India',
                    $guestLandmark !== '' ? $guestLandmark : null,
                    $guestInstructions !== '' ? $guestInstructions : null,
                ]);
                $shippingAddressId = (int)$pdo->lastInsertId();
                $billingAddressId = $shippingAddressId;
            } elseif (checkout_has_legacy_addresses()) {
                $guestAddressInsert = $pdo->prepare('INSERT INTO user_addresses (user_id, label, full_name, email, street_address, city, state, zip, phone_number, is_default, use_for_billing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)');
                $guestAddressInsert->execute([
                    $userId,
                    $guestLabel !== '' ? $guestLabel : 'Guest Checkout',
                    $guestFullName,
                    $guestEmail,
                    $guestStreetAddress,
                    $guestCity,
                    $guestState,
                    $guestZip,
                    $guestPhone,
                ]);
                $shippingAddressId = (int)$pdo->lastInsertId();
                $billingAddressId = $shippingAddressId;
            }

            $promoAddressContext = [
                'city' => $guestCity,
                'state' => $guestState,
            ];
        } else {
            if (checkout_has_modern_addresses()) {
                $addrCheck = $pdo->prepare('SELECT * FROM addresses WHERE user_id = ? AND id IN (?, ?)');
                $addrCheck->execute([$userId, $shippingAddressId, $billingAddressId]);
                $addrRows = $addrCheck->fetchAll();
                $addrIds = array_map(static fn(array $row): int => (int)$row['id'], $addrRows);
                if (!in_array($shippingAddressId, $addrIds, true) || !in_array($billingAddressId, $addrIds, true)) {
                    throw new RuntimeException('Address does not belong to current user');
                }

                foreach ($addrRows as $addressRow) {
                    if ((int)$addressRow['id'] === $shippingAddressId) {
                        $shippingAddressText = checkout_format_address_text($addressRow);
                        $promoAddressContext = [
                            'city' => (string)($addressRow['city'] ?? ''),
                            'state' => (string)($addressRow['state'] ?? ''),
                        ];
                    }

                    if ((int)$addressRow['id'] === $billingAddressId) {
                        $billingAddressText = checkout_format_address_text($addressRow);
                    }
                }
            } elseif (checkout_has_legacy_addresses()) {
                $addrCheck = $pdo->prepare('SELECT * FROM user_addresses WHERE user_id = ? AND id IN (?, ?)');
                $addrCheck->execute([$userId, $shippingAddressId, $billingAddressId]);
                $addrRows = $addrCheck->fetchAll();
                $addrIds = array_map(static fn(array $row): int => (int)$row['id'], $addrRows);
                if (!in_array($shippingAddressId, $addrIds, true) || !in_array($billingAddressId, $addrIds, true)) {
                    throw new RuntimeException('Address does not belong to current user');
                }

                foreach ($addrRows as $addressRow) {
                    if ((int)$addressRow['id'] === $shippingAddressId) {
                        $shippingAddressText = checkout_format_address_text($addressRow);
                        $promoAddressContext = [
                            'city' => (string)($addressRow['city'] ?? ''),
                            'state' => (string)($addressRow['state'] ?? ''),
                        ];
                    }

                    if ((int)$addressRow['id'] === $billingAddressId) {
                        $billingAddressText = checkout_format_address_text($addressRow);
                    }
                }
            }
        }

        $categoryPk = function_exists('promotion_category_pk') ? promotion_category_pk() : 'id';
        $cartTable = checkout_cart_table_name();
        $variantTable = checkout_variant_table_name();
        $variantPriceColumn = checkout_variant_price_column();
       $activeVariantDiscountExpr = 'CASE
                        WHEN v.discount_price IS NOT NULL
                             AND v.discount_price > 0
                             AND v.discount_price < v.' . $variantPriceColumn . '
                             AND (v.discount_end IS NULL OR v.discount_end >= NOW())
                        THEN v.discount_price
                        ELSE NULL
                     END';

        if ($cartTable === 'carts') {
            $itemsSql = 'SELECT c.product_id, c.variant_id, c.quantity,
                                COALESCE(NULLIF(c.price, 0), v.' . $variantPriceColumn . ') AS base_price,
                                COALESCE(' . $activeVariantDiscountExpr . ', NULLIF(c.price, 0), v.' . $variantPriceColumn . ') AS effective_price,
                                COALESCE(v.stock_quantity, 0) AS stock_quantity,
                                p.name,
                                COALESCE(v.sku, p.sku, "") AS sku,
                                COALESCE(cat.name, "") AS category_name
                         FROM carts c
                         JOIN ' . $variantTable . ' v ON v.id = c.variant_id
                         JOIN products p ON p.id = c.product_id
                         LEFT JOIN categories cat ON cat.' . $categoryPk . ' = p.category_id
                         WHERE ' . ($isGuestCheckout ? 'c.guest_token = ?' : 'c.user_id = ?') . '
                         FOR UPDATE';
        } else {
            $itemsSql = 'SELECT c.product_id, c.variant_id, c.quantity,
                                COALESCE(NULLIF(c.price, 0), v.' . $variantPriceColumn . ', p.price, 0) AS base_price,
                                COALESCE(' . $activeVariantDiscountExpr . ', NULLIF(c.price, 0), v.' . $variantPriceColumn . ', p.price, 0) AS effective_price,
                                COALESCE(v.stock_quantity, 0) AS stock_quantity,
                                COALESCE(p.name, CONCAT("Product #", c.product_id)) AS name,
                                COALESCE(v.sku, p.sku, "") AS sku,
                                COALESCE(cat.name, "") AS category_name
                         FROM cart c
                         JOIN products p ON p.id = c.product_id
                         LEFT JOIN ' . $variantTable . ' v ON v.id = c.variant_id
                         LEFT JOIN categories cat ON cat.' . $categoryPk . ' = p.category_id
                         WHERE ' . ($isGuestCheckout ? 'c.guest_token = ?' : 'c.user_id = ?') . ' AND COALESCE(c.status, "active") = "active"
                         FOR UPDATE';
        }

        $itemsStmt = $pdo->prepare($itemsSql);
        $itemsStmt->execute([$isGuestCheckout ? $guestToken : $userId]);
        $cartItems = $itemsStmt->fetchAll();

        if (!$cartItems) {
            throw new RuntimeException('Cart is empty');
        }

        $pricingItems = [];
        foreach ($cartItems as $item) {
            $qty = (int)$item['quantity'];
            $stock = (int)$item['stock_quantity'];
            if ($qty <= 0) {
                throw new RuntimeException('Invalid cart quantity');
            }
            if ($stock > 0 && $stock < $qty) {
                throw new RuntimeException('Insufficient stock for one or more items');
            }

            $pricingItems[] = [
                'product_id' => (int)$item['product_id'],
                'variant_id' => (int)$item['variant_id'],
                'quantity' => $qty,
                'name' => (string)($item['name'] ?? ''),
                'category_name' => (string)($item['category_name'] ?? 'General'),
                'snapshot_price' => (float)$item['base_price'],
                'catalog_effective_price' => (float)$item['effective_price'],
                'effective_price' => (float)$item['effective_price'],
            ];
        }

        $pricing = apply_promotions_to_cart(
            $pricingItems,
            promotion_context_from_user($user, $guestToken, $promoAddressContext),
            [
                'threshold' => $threshold,
                'fee' => $shippingFee,
            ]
        );

        $pricedByVariant = [];
        foreach (($pricing['items'] ?? []) as $pricedItem) {
            $pricedByVariant[(int)$pricedItem['variant_id']] = $pricedItem;
        }

        $subtotal = (float)($pricing['summary']['subtotal'] ?? 0);
        $discountAmount = (float)($pricing['summary']['discount_amount'] ?? 0);
        $shippingCost = (float)($pricing['summary']['shipping_cost'] ?? 0);
        $grandTotal = max(0.0, (float)($pricing['summary']['grand_total'] ?? ($subtotal + $shippingCost)));

        if ($usesModernOrders) {
            $orderStmt = $pdo->prepare('INSERT INTO orders (order_number, user_id, shipping_address_id, billing_address_id, status, payment_status, payment_method, subtotal, shipping_cost, discount_amount, grand_total)
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $orderStmt->execute([
                $orderNumber,
                $userId,
                $shippingAddressId,
                $billingAddressId,
                'pending',
                $paymentMethod === 'cod' ? 'pending' : 'paid',
                $paymentMethod,
                $subtotal,
                $shippingCost,
                $discountAmount,
                $grandTotal,
            ]);
        } else {
            $orderStmt = $pdo->prepare('INSERT INTO orders (user_id, order_number, total_amount, status, shipping_address, billing_address, subtotal, tax_amount, shipping_cost, discount_amount, grand_total, payment_method, payment_status)
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $orderStmt->execute([
                $userId,
                $orderNumber,
                $grandTotal,
                'pending',
                $shippingAddressText !== '' ? $shippingAddressText : 'Saved Address',
                $billingAddressText !== '' ? $billingAddressText : ($shippingAddressText !== '' ? $shippingAddressText : 'Saved Address'),
                $subtotal,
                0,
                $shippingCost,
                $discountAmount,
                $grandTotal,
                $paymentMethod,
                $paymentMethod === 'cod' ? 'Pending' : 'Completed',
            ]);
        }

        $orderId = (int)$pdo->lastInsertId();

        if ($usesModernOrders) {
            $itemStmt = $pdo->prepare('INSERT INTO order_items (order_id, product_id, variant_id, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?)');
        } else {
            $itemStmt = $pdo->prepare('INSERT INTO order_items (order_id, product_id, variant_id, sku, name, quantity, price, discount_price, tax_rate, tax_amount, subtotal, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        }

        $stockStmt = db_column_exists($variantTable, 'stock_quantity')
            ? $pdo->prepare('UPDATE ' . $variantTable . ' SET stock_quantity = GREATEST(stock_quantity - ?, 0) WHERE id = ?')
            : null;

        foreach ($cartItems as $item) {
            $qty = (int)$item['quantity'];
            $pricedItem = $pricedByVariant[(int)$item['variant_id']] ?? null;
            $price = (float)($pricedItem['effective_price'] ?? $item['effective_price']);
            $basePrice = (float)($item['base_price'] ?? $price);
            $lineSubtotal = $basePrice * $qty;
            $lineTotal = $price * $qty;

            if ($usesModernOrders) {
                $itemStmt->execute([$orderId, (int)$item['product_id'], (int)$item['variant_id'], $qty, $price, $lineTotal]);
            } else {
                $itemStmt->execute([
                    $orderId,
                    (int)$item['product_id'],
                    (int)$item['variant_id'],
                    (string)($item['sku'] ?? ''),
                    (string)($item['name'] ?? ''),
                    $qty,
                    $basePrice,
                    $price,
                    0,
                    0,
                    $lineSubtotal,
                    $lineTotal,
                ]);
            }

            if ($stockStmt) {
                $stockStmt->execute([$qty, (int)$item['variant_id']]);
            }
        }

        $clearCart = $pdo->prepare('DELETE FROM ' . $cartTable . ' WHERE ' . ($isGuestCheckout ? 'guest_token = ?' : 'user_id = ?'));
        $clearCart->execute([$isGuestCheckout ? $guestToken : $userId]);

        record_order_event(
            $orderId,
            'order_placed',
            'Order placed',
            'Order created with payment method ' . $paymentMethod,
            'customer',
            $userId
        );

        if ($supportsRequestTracking) {
            $completeRequest = $pdo->prepare('UPDATE checkout_requests SET status = ?, order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND idem_key = ?');
            $completeRequest->execute(['completed', $orderId, $userId, $requestHash]);
        }

        $pdo->commit();
    } catch (RuntimeException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($supportsRequestTracking) {
            $markFailed = db()->prepare('UPDATE checkout_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND idem_key = ?');
            $markFailed->execute(['failed', $userId, $requestHash]);
        }
        fail($e->getMessage(), 422);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($supportsRequestTracking) {
            $markFailed = db()->prepare('UPDATE checkout_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND idem_key = ?');
            $markFailed->execute(['failed', $userId, $requestHash]);
        }
        fail('Checkout failed. Please try again.', 500);
    }

    $subject = 'Order confirmation: ' . $orderNumber;
    $text = "Thanks for your order.\nOrder: {$orderNumber}\nTotal: Rs." . round($grandTotal, 2) . "\nStatus: pending";
    $html = '<p>Thanks for your order.</p><p><strong>Order:</strong> ' . htmlspecialchars($orderNumber, ENT_QUOTES, 'UTF-8') . '</p>'
        . '<p><strong>Total:</strong> Rs.' . htmlspecialchars((string)round($grandTotal, 2), ENT_QUOTES, 'UTF-8') . '</p>'
        . '<p><strong>Status:</strong> pending</p>';
    $notificationEmail = $user !== null ? (string)$user['email'] : $guestEmail;
    queue_email($notificationEmail, $subject, $text, $html, ['type' => 'order_confirmation', 'order_id' => $orderId]);
    if (notifications_enabled()) {
        process_email_outbox(10);
    }
} catch (Throwable $e) {
    fail('Checkout failed. Please try again.', 500);
}

ok([
    'order_id' => $orderId,
    'order_number' => $orderNumber,
    'discount_amount' => round($discountAmount, 2),
    'grand_total' => round($grandTotal, 2),
    'guest_checkout' => $isGuestCheckout,
    'upsell_offer' => $isGuestCheckout ? 'Create your account now and get 10% off your next order plus saved addresses and order history.' : null,
    'upsell_coupon' => $isGuestCheckout ? 'WELCOME10' : null,
    'guest_email' => $isGuestCheckout ? $guestEmail : null,
]);
