<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function table_exists(string $table): bool
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

function payment_confirm_variant_table_name(): string
{
    return table_exists('product_variants') ? 'product_variants' : 'products_detail';
}

function payment_confirm_variant_price_column(): string
{
    if (table_exists('product_variants')) {
        return db_column_exists('product_variants', 'base_price') ? 'base_price' : 'price';
    }

    if (db_column_exists('products_detail', 'price')) {
        return 'price';
    }

    return db_column_exists('products_detail', 'base_price') ? 'base_price' : 'price';
}

function b64url_decode(string $value): string
{
    $padding = strlen($value) % 4;
    if ($padding > 0) {
        $value .= str_repeat('=', 4 - $padding);
    }

    return (string)base64_decode(strtr($value, '-_', '+/'), true);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

$token = bearer_token();
$user = null;

if ($token !== '') {
    cleanup_expired_tokens();
    if (table_exists('auth_tokens')) {
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
}

fail_if_admin_purchase($user, 'Admin accounts cannot place orders from the storefront. Please use a customer account.');

$checkoutSessionId = trim((string)($_POST['checkoutSessionId'] ?? $_POST['checkout_session_id'] ?? ''));
$razorpayOrderId = trim((string)($_POST['razorpayOrderId'] ?? $_POST['razorpay_order_id'] ?? ''));
$razorpayPaymentId = trim((string)($_POST['razorpayPaymentId'] ?? $_POST['razorpay_payment_id'] ?? ''));
$razorpaySignature = trim((string)($_POST['razorpaySignature'] ?? $_POST['razorpay_signature'] ?? ''));

$gatewaySettings = operational_settings()['paymentGateway'] ?? [];
$provider = strtolower(trim((string)($gatewaySettings['provider'] ?? 'razorpay')));
$sandboxMode = !empty($gatewaySettings['sandboxMode']);

if ($checkoutSessionId === '') {
    fail('Missing checkout session', 422);
}

$legacyMode = !table_exists('payment_transactions');

if ($legacyMode) {
    if ($razorpayOrderId === '' || $razorpayPaymentId === '' || $razorpaySignature === '') {
        fail('Missing payment confirmation data', 422);
    }

    if (!str_starts_with($checkoutSessionId, 'sim_')) {
        fail('Invalid checkout session', 422);
    }

    $encodedAndSig = substr($checkoutSessionId, 4);
    $parts = explode('.', $encodedAndSig, 2);
    if (count($parts) !== 2) {
        fail('Invalid checkout session', 422);
    }

    [$encodedPayload, $signature] = $parts;
    $expectedSig = hash_hmac('sha256', $encodedPayload, DB_NAME . '|' . DB_HOST);
    if (!hash_equals($expectedSig, $signature)) {
        fail('Invalid checkout session signature', 422);
    }

    $payload = json_decode(b64url_decode($encodedPayload), true);
    if (!is_array($payload) || (int)($payload['exp'] ?? 0) < time()) {
        fail('Checkout session expired', 422);
    }

    $expectedOrderId = (string)($payload['providerOrderId'] ?? '');
    if ($expectedOrderId !== '' && $expectedOrderId !== $razorpayOrderId) {
        fail('Razorpay order mismatch', 422);
    }

    if ($sandboxMode) {
        $validSandboxPayment = str_starts_with($razorpayPaymentId, 'pay_sim_') && str_starts_with($razorpaySignature, 'sim_signature_');
        if (!$validSandboxPayment) {
            fail('Invalid sandbox payment payload', 422);
        }
    } else {
        if ($provider !== 'razorpay' || !razorpay_provider_enabled()) {
            fail('Razorpay is not enabled in Admin Settings > Payment Gateway', 422);
        }
        if (!razorpay_has_credentials()) {
            fail('Razorpay credentials are missing in backend/ecommerce/lib/config.php', 422);
        }
        if (!razorpay_verify_signature($razorpayOrderId, $razorpayPaymentId, $razorpaySignature)) {
            fail('Invalid Razorpay signature', 422);
        }
    }

    $orderNumber = 'SIM-' . date('Ymd') . '-' . strtoupper(substr(hash('sha1', $checkoutSessionId), 0, 6));
    $simulatedOrderId = (int)substr((string)time(), -6);

    ok([
        'order_id' => $simulatedOrderId,
        'order_number' => $orderNumber,
        'discount_amount' => 0,
        'grand_total' => round((float)($payload['total'] ?? 0), 2),
        'guest_checkout' => !empty($payload['guest']),
        'upsell_offer' => !empty($payload['guest']) ? 'Create your account now and get 10% off your next order plus saved addresses and order history.' : null,
        'upsell_coupon' => !empty($payload['guest']) ? 'WELCOME10' : null,
        'guest_email' => !empty($payload['guest']) ? (string)($payload['guestEmail'] ?? '') : null,
        'simulated' => true,
    ]);
}

$txStmt = db()->prepare('SELECT * FROM payment_transactions WHERE session_token = ? LIMIT 1');
$txStmt->execute([$checkoutSessionId]);
$paymentTx = $txStmt->fetch();

if (!$paymentTx) {
    fail('Payment session not found', 404);
}

$isGuestCheckout = $user === null;
if ($isGuestCheckout) {
    if ((string)($paymentTx['guest_token'] ?? '') === '') {
        fail('Unauthorized payment confirmation', 401);
    }
} else {
    if ((int)($paymentTx['user_id'] ?? 0) !== (int)$user['id']) {
        fail('Unauthorized payment confirmation', 401);
    }
}

if ((string)$paymentTx['provider'] !== 'razorpay') {
    fail('Invalid payment provider for this session', 422);
}

if ($razorpayOrderId === '' || $razorpayPaymentId === '' || $razorpaySignature === '') {
    fail('Missing payment confirmation data', 422);
}

if ((string)$paymentTx['provider_order_id'] !== $razorpayOrderId) {
    fail('Razorpay order mismatch', 422);
}

if (!$sandboxMode && !razorpay_verify_signature($razorpayOrderId, $razorpayPaymentId, $razorpaySignature)) {
    $failTxStmt = db()->prepare('UPDATE payment_transactions SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $failTxStmt->execute(['failed', 'Signature verification failed', (int)$paymentTx['id']]);
    fail('Invalid Razorpay signature', 422);
}

if ($sandboxMode) {
    $validSandboxPayment = str_starts_with($razorpayPaymentId, 'pay_sim_') && str_starts_with($razorpaySignature, 'sim_signature_');
    if (!$validSandboxPayment) {
        $failTxStmt = db()->prepare('UPDATE payment_transactions SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        $failTxStmt->execute(['failed', 'Invalid sandbox payment payload', (int)$paymentTx['id']]);
        fail('Invalid sandbox payment payload', 422);
    }
}

if ((string)$paymentTx['status'] === 'captured' && (int)$paymentTx['order_id'] > 0) {
    $existingOrderStmt = db()->prepare('SELECT id, order_number, grand_total FROM orders WHERE id = ? LIMIT 1');
    $existingOrderStmt->execute([(int)$paymentTx['order_id']]);
    $existingOrder = $existingOrderStmt->fetch();

    if ($existingOrder) {
        ok([
            'order_id' => (int)$existingOrder['id'],
            'order_number' => (string)$existingOrder['order_number'],
            'grand_total' => round((float)$existingOrder['grand_total'], 2),
            'idempotent_replay' => true,
        ]);
    }
}

$payload = json_decode((string)($paymentTx['checkout_payload'] ?? '{}'), true);
if (!is_array($payload)) {
    fail('Invalid checkout session payload', 422);
}

$paymentMethod = (string)($paymentTx['payment_method'] ?? 'card');
if (!in_array($paymentMethod, ['card', 'upi'], true)) {
    fail('Invalid payment method in session', 422);
}

$pdo = db();
$pdo->beginTransaction();

try {
    $resolvedUserId = 0;
    $shippingAddressId = (int)($payload['shippingAddressId'] ?? 0);
    $billingAddressId = (int)($payload['billingAddressId'] ?? 0);

    if ($isGuestCheckout) {
        $guestEmail = trim((string)($payload['guestEmail'] ?? ''));
        $guestFullName = trim((string)($payload['guestFullName'] ?? ''));
        $guestPhone = trim((string)($payload['guestPhone'] ?? ''));
        if ($guestEmail === '' || $guestFullName === '' || $guestPhone === '') {
            throw new RuntimeException('Guest details are missing from payment session');
        }

        $guestUserStmt = $pdo->prepare('SELECT id, email, status FROM users WHERE email = ? LIMIT 1');
        $guestUserStmt->execute([$guestEmail]);
        $existingGuestUser = $guestUserStmt->fetch();

        if ($existingGuestUser) {
            if (($existingGuestUser['status'] ?? 'active') !== 'active') {
                throw new RuntimeException('This email cannot be used for guest checkout');
            }
            $resolvedUserId = (int)$existingGuestUser['id'];
        } else {
            $insertGuestUser = $pdo->prepare('INSERT INTO users (name, email, password_hash, role, status, phone) VALUES (?, ?, ?, ?, ?, ?)');
            $insertGuestUser->execute([
                $guestFullName,
                $guestEmail,
                password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT),
                'customer',
                'active',
                $guestPhone,
            ]);
            $resolvedUserId = (int)$pdo->lastInsertId();
        }

        $guestAddressInsert = $pdo->prepare('INSERT INTO addresses (user_id, label, full_name, email, phone_number, street_address, city, state, zip, country, landmark, instructions, is_default, use_for_billing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)');
        $guestAddressInsert->execute([
            $resolvedUserId,
            trim((string)($payload['guestLabel'] ?? 'Guest Checkout')) ?: 'Guest Checkout',
            $guestFullName,
            $guestEmail,
            $guestPhone,
            trim((string)($payload['guestStreetAddress'] ?? '')),
            trim((string)($payload['guestCity'] ?? '')),
            trim((string)($payload['guestState'] ?? '')),
            trim((string)($payload['guestZip'] ?? '')),
            trim((string)($payload['guestCountry'] ?? 'India')) ?: 'India',
            trim((string)($payload['guestLandmark'] ?? '')) ?: null,
            trim((string)($payload['guestInstructions'] ?? '')) ?: null,
        ]);
        $shippingAddressId = (int)$pdo->lastInsertId();
        $billingAddressId = $shippingAddressId;
        $promoAddressContext = [
            'city' => trim((string)($payload['guestCity'] ?? '')),
            'state' => trim((string)($payload['guestState'] ?? '')),
        ];
    } else {
        $resolvedUserId = (int)$user['id'];
        $addrCheck = $pdo->prepare('SELECT id, city, state FROM addresses WHERE user_id = ? AND id IN (?, ?)');
        $addrCheck->execute([$resolvedUserId, $shippingAddressId, $billingAddressId]);
        $addrRows = $addrCheck->fetchAll();
        $addrIds = array_map(static fn(array $row): int => (int)$row['id'], $addrRows);
        if (!in_array($shippingAddressId, $addrIds, true) || !in_array($billingAddressId, $addrIds, true)) {
            throw new RuntimeException('Address does not belong to current user');
        }
        $promoAddressContext = [];
        foreach ($addrRows as $addressRow) {
            if ((int)$addressRow['id'] === $shippingAddressId) {
                $promoAddressContext = [
                    'city' => (string)($addressRow['city'] ?? ''),
                    'state' => (string)($addressRow['state'] ?? ''),
                ];
                break;
            }
        }
    }

    $categoryPk = function_exists('promotion_category_pk') ? promotion_category_pk() : 'id';
    $variantTable = payment_confirm_variant_table_name();
    $variantPriceCol = payment_confirm_variant_price_column();
    $activeVariantDiscountExpr = 'CASE
                        WHEN v.discount_price IS NOT NULL
                             AND v.discount_price > 0
                             AND v.discount_price < v.' . $variantPriceCol . '
                             AND (v.discount_end IS NULL OR v.discount_end = "0000-00-00 00:00:00" OR v.discount_end >= NOW())
                        THEN v.discount_price
                        ELSE NULL
                     END';
    $itemsSql = 'SELECT c.product_id, c.variant_id, c.quantity,
                        COALESCE(NULLIF(c.price, 0), v.' . $variantPriceCol . ', p.price, 0) AS base_price,
                        COALESCE(' . $activeVariantDiscountExpr . ', NULLIF(c.price, 0), v.' . $variantPriceCol . ', p.price, 0) AS effective_price,
                        COALESCE(v.stock_quantity, 0) AS stock_quantity,
                        p.name,
                        COALESCE(cat.name, "") AS category_name
                 FROM carts c
                 JOIN ' . $variantTable . ' v ON v.id = c.variant_id
                 JOIN products p ON p.id = c.product_id
                 LEFT JOIN categories cat ON cat.' . $categoryPk . ' = p.category_id
                 WHERE ' . ($isGuestCheckout ? 'c.guest_token = ?' : 'c.user_id = ?') . '
                 FOR UPDATE';
    $itemsStmt = $pdo->prepare($itemsSql);
    $itemsStmt->execute([$isGuestCheckout ? (string)$paymentTx['guest_token'] : $resolvedUserId]);
    $cartItems = $itemsStmt->fetchAll();

    if (!$cartItems) {
        throw new RuntimeException('Cart is empty');
    }

    $settings = site_settings();
    $threshold = (float)($settings['offers']['freeShippingThreshold'] ?? 999);
    $shippingFee = (float)($settings['offers']['standardShippingFee'] ?? 80);

    $pricingItems = [];
    foreach ($cartItems as $item) {
        $qty = (int)$item['quantity'];
        $stock = (int)$item['stock_quantity'];
        if ($qty <= 0) {
            throw new RuntimeException('Invalid cart quantity');
        }
        if ($stock < $qty) {
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
        promotion_context_from_user($user, (string)($paymentTx['guest_token'] ?? ''), $promoAddressContext),
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

    $expectedAmount = round((float)$paymentTx['amount'], 2);
    if (abs($expectedAmount - round($grandTotal, 2)) > 0.01) {
        throw new RuntimeException('Cart total changed. Please retry checkout.');
    }

    $orderNumber = 'ORD-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));

    $orderStmt = $pdo->prepare('INSERT INTO orders (order_number, user_id, shipping_address_id, billing_address_id, status, payment_status, payment_method, subtotal, shipping_cost, discount_amount, grand_total)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $orderStmt->execute([
        $orderNumber,
        $resolvedUserId,
        $shippingAddressId,
        $billingAddressId,
        'processing',
        'paid',
        $paymentMethod,
        $subtotal,
        $shippingCost,
        $discountAmount,
        $grandTotal,
    ]);

    $orderId = (int)$pdo->lastInsertId();

    $itemStmt = $pdo->prepare('INSERT INTO order_items (order_id, product_id, variant_id, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?)');
    $stockStmt = $pdo->prepare('UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?');

    foreach ($cartItems as $item) {
        $qty = (int)$item['quantity'];
        $pricedItem = $pricedByVariant[(int)$item['variant_id']] ?? null;
        $price = (float)($pricedItem['effective_price'] ?? $item['effective_price']);
        $lineTotal = $price * $qty;

        $itemStmt->execute([$orderId, (int)$item['product_id'], (int)$item['variant_id'], $qty, $price, $lineTotal]);
        $stockStmt->execute([$qty, (int)$item['variant_id']]);
    }

    $clearCart = $pdo->prepare('DELETE FROM carts WHERE ' . ($isGuestCheckout ? 'guest_token = ?' : 'user_id = ?'));
    $clearCart->execute([$isGuestCheckout ? (string)$paymentTx['guest_token'] : $resolvedUserId]);

    record_order_event(
        $orderId,
        'payment_captured',
        'Payment captured via Razorpay',
        'Payment ID: ' . $razorpayPaymentId,
        'customer',
        $resolvedUserId
    );

    $updateTxStmt = $pdo->prepare('UPDATE payment_transactions
                                  SET provider_payment_id = ?, provider_signature = ?, status = ?, order_id = ?, error_message = NULL, updated_at = CURRENT_TIMESTAMP
                                  WHERE id = ?');
    $updateTxStmt->execute([$razorpayPaymentId, $razorpaySignature, 'captured', $orderId, (int)$paymentTx['id']]);

    $pdo->commit();

    $subject = 'Order confirmation: ' . $orderNumber;
    $text = "Thanks for your order.\nOrder: {$orderNumber}\nTotal: Rs." . round($grandTotal, 2) . "\nStatus: processing";
    $html = '<p>Thanks for your order.</p><p><strong>Order:</strong> ' . htmlspecialchars($orderNumber, ENT_QUOTES, 'UTF-8') . '</p>'
        . '<p><strong>Total:</strong> Rs.' . htmlspecialchars((string)round($grandTotal, 2), ENT_QUOTES, 'UTF-8') . '</p>'
        . '<p><strong>Status:</strong> processing</p>';
    $notificationEmail = $isGuestCheckout ? (string)($payload['guestEmail'] ?? '') : (string)$user['email'];
    if ($notificationEmail !== '') {
        queue_email($notificationEmail, $subject, $text, $html, ['type' => 'order_confirmation', 'order_id' => $orderId]);
        if (notifications_enabled()) {
            process_email_outbox(10);
        }
    }
} catch (RuntimeException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $markFailed = db()->prepare('UPDATE payment_transactions SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $markFailed->execute(['failed', $e->getMessage(), (int)$paymentTx['id']]);
    fail($e->getMessage(), 422);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $markFailed = db()->prepare('UPDATE payment_transactions SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $markFailed->execute(['failed', 'Payment confirmation failed', (int)$paymentTx['id']]);
    fail('Payment confirmation failed', 500);
}

ok([
    'order_id' => $orderId,
    'order_number' => $orderNumber,
    'discount_amount' => round($discountAmount, 2),
    'grand_total' => round($grandTotal, 2),
    'guest_checkout' => $isGuestCheckout,
    'upsell_offer' => $isGuestCheckout ? 'Create your account now and get 10% off your next order plus saved addresses and order history.' : null,
    'upsell_coupon' => $isGuestCheckout ? 'WELCOME10' : null,
    'guest_email' => $isGuestCheckout ? (string)($payload['guestEmail'] ?? '') : null,
]);
