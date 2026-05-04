<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function mock_table_exists(string $table): bool
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

function mock_column_exists(string $table, string $column): bool
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

function mock_user_phone_select_expr(string $alias = 'u'): string
{
    if (mock_column_exists('users', 'phone_number')) {
        return $alias . '.phone_number';
    }

    if (mock_column_exists('users', 'phone')) {
        return $alias . '.phone';
    }

    return "''";
}

function mock_variant_table(): string
{
    return mock_table_exists('product_variants') ? 'product_variants' : 'products_detail';
}

function mock_variant_price_column(): string
{
    return mock_table_exists('product_variants') ? 'base_price' : 'price';
}

function mock_b64url_decode(string $value): string
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

try {
    $checkoutSessionId = trim((string)($_POST['checkoutSessionId'] ?? $_POST['checkout_session_id'] ?? ''));
    $gatewayOrderId = trim((string)($_POST['razorpayOrderId'] ?? $_POST['razorpay_order_id'] ?? ''));
    $gatewayPaymentId = trim((string)($_POST['razorpayPaymentId'] ?? $_POST['razorpay_payment_id'] ?? ''));
    $gatewaySignature = trim((string)($_POST['razorpaySignature'] ?? $_POST['razorpay_signature'] ?? ''));

    if ($checkoutSessionId === '') {
        fail('Missing checkout session', 422);
    }
    if (!str_starts_with($checkoutSessionId, 'mock_')) {
        fail('Invalid mock checkout session', 422);
    }
    if ($gatewayPaymentId === '') {
        $gatewayPaymentId = 'pay_mock_' . bin2hex(random_bytes(4));
    }

    $encodedAndSig = substr($checkoutSessionId, 5);
    $parts = explode('.', $encodedAndSig, 2);
    if (count($parts) !== 2) {
        fail('Invalid mock checkout session', 422);
    }

    [$encodedPayload, $signature] = $parts;
    $expectedSig = hash_hmac('sha256', $encodedPayload, DB_NAME . '|' . DB_HOST);
    if (!hash_equals($expectedSig, $signature)) {
        fail('Invalid mock checkout session signature', 422);
    }

    $payload = json_decode(mock_b64url_decode($encodedPayload), true);
    if (!is_array($payload) || (int)($payload['exp'] ?? 0) < time()) {
        fail('Mock checkout session expired', 422);
    }

    $expectedOrderId = (string)($payload['orderId'] ?? '');
    if ($gatewayOrderId === '' && $expectedOrderId !== '') {
        $gatewayOrderId = $expectedOrderId;
    }

    $itemsPayload = json_decode((string)($_POST['cartItems'] ?? '[]'), true);
    $cartItems = is_array($itemsPayload) ? $itemsPayload : [];

    $paymentMethod = strtolower(trim((string)($payload['method'] ?? $_POST['payment'] ?? 'card')));
    if (!in_array($paymentMethod, ['card', 'upi'], true)) {
        $paymentMethod = 'card';
    }

    $subtotal = round((float)($payload['subtotal'] ?? 0), 2);
    $shippingCost = round((float)($payload['shipping'] ?? 0), 2);
        $discountAmount = round((float)($payload['discount_amount'] ?? 0), 2);
        $taxAmount = round((float)($payload['tax_amount'] ?? 0), 2);
        $grandTotal = round((float)($payload['total'] ?? ($subtotal + $shippingCost + $taxAmount - $discountAmount)), 2);

    $guestEmail = trim((string)($_POST['guestEmail'] ?? $_POST['guest_email'] ?? ''));
    $guestName = trim((string)($_POST['guestFullName'] ?? $_POST['guest_full_name'] ?? ''));
    $guestPhone = trim((string)($_POST['guestPhone'] ?? $_POST['guest_phone'] ?? ''));
    $shippingAddressId = (int)($_POST['address'] ?? 0);
    $billingAddressId = (int)($_POST['billingAddress'] ?? $_POST['billing_address'] ?? 0);

    // Resolve user (existing logged-in user or create/reuse guest user).
    $userId = null;
    $token = bearer_token();
    if ($token !== '' && mock_table_exists('auth_tokens')) {
        cleanup_expired_tokens();
        $phoneExpr = mock_user_phone_select_expr('u');
        $authStmt = db()->prepare('SELECT u.id, u.name, u.email, u.role, u.status,
                                          ' . $phoneExpr . ' AS resolved_phone
                                   FROM auth_tokens t
                                   JOIN users u ON u.id = t.user_id
                                   WHERE t.token = ? AND t.expires_at > NOW() LIMIT 1');
        $authStmt->execute([$token]);
        $resolved = $authStmt->fetch();
        if ($resolved && ($resolved['status'] ?? 'active') === 'active') {
            if (is_admin_role($resolved['role'] ?? '')) {
                fail('Admin accounts cannot place orders from the storefront. Please use a customer account.', 403);
            }

            $userId = (int)$resolved['id'];
            $guestEmail = $guestEmail !== '' ? $guestEmail : (string)($resolved['email'] ?? '');
            $guestName = $guestName !== '' ? $guestName : (string)($resolved['name'] ?? '');
            $guestPhone = $guestPhone !== '' ? $guestPhone : (string)($resolved['resolved_phone'] ?? '');
        }
    }

    if ($userId === null && ($shippingAddressId > 0 || $billingAddressId > 0) && mock_table_exists('addresses')) {
        $addressIds = array_values(array_filter([$shippingAddressId, $billingAddressId], static fn (int $value): bool => $value > 0));
        if ($addressIds) {
            $placeholders = implode(',', array_fill(0, count($addressIds), '?'));
            $phoneExpr = mock_user_phone_select_expr('u');
            $addrUserStmt = db()->prepare(
                'SELECT a.user_id, u.email, u.name,
                        ' . $phoneExpr . ' AS resolved_phone
                 FROM addresses a
                 JOIN users u ON u.id = a.user_id
                 WHERE a.id IN (' . $placeholders . ')
                 ORDER BY FIELD(a.id, ' . $placeholders . ')
                 LIMIT 1'
            );
            $addrUserStmt->execute(array_merge($addressIds, $addressIds));
            $addrUser = $addrUserStmt->fetch();
            if ($addrUser) {
                $userId = (int)$addrUser['user_id'];
                $guestEmail = $guestEmail !== '' ? $guestEmail : (string)($addrUser['email'] ?? '');
                $guestName = $guestName !== '' ? $guestName : (string)($addrUser['name'] ?? '');
                $guestPhone = $guestPhone !== '' ? $guestPhone : (string)($addrUser['resolved_phone'] ?? '');
            }
        }
    }

    $isGuestCheckout = false;

    if ($userId === null) {
        if ($guestEmail === '' || !filter_var($guestEmail, FILTER_VALIDATE_EMAIL)) {
            fail('Guest email is required for mock checkout', 422);
        }
        $isGuestCheckout = true;

        $findUserStmt = db()->prepare('SELECT id, role FROM users WHERE email = ? LIMIT 1');
        $findUserStmt->execute([$guestEmail]);
        $existingUser = $findUserStmt->fetch();
        if ($existingUser) {
            if (is_admin_role($existingUser['role'] ?? '')) {
                fail('Admin accounts cannot be used for checkout. Please use a customer account.', 403);
            }
            $userId = (int)$existingUser['id'];
        } else {
            $insertUserStmt = db()->prepare('INSERT INTO users (name, email, password_hash, role, status, phone_number) VALUES (?, ?, ?, ?, ?, ?)');
            $insertUserStmt->execute([
                $guestName !== '' ? $guestName : 'Guest User',
                $guestEmail,
                password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT),
                'customer',
                'active',
                $guestPhone !== '' ? $guestPhone : '0000000000',
            ]);
            $userId = (int)db()->lastInsertId();
        }
    }

    $guestToken = trim((string)($_POST['guestToken'] ?? $_POST['guest_token'] ?? ''));

    if (!$cartItems) {
        if (mock_table_exists('carts')) {
            $fallbackStmt = db()->prepare('SELECT product_id, variant_id, quantity FROM carts WHERE guest_token = ? OR user_id = ? ORDER BY updated_at DESC');
            $fallbackStmt->execute([$guestToken, $userId]);
            $cartItems = $fallbackStmt->fetchAll();
        } elseif (mock_table_exists('cart')) {
            $fallbackStmt = db()->prepare('SELECT product_id, variant_id, quantity, price, discount_price FROM cart WHERE (guest_token = ? OR user_id = ?) AND status = ? ORDER BY updated_at DESC');
            $fallbackStmt->execute([$guestToken, $userId, 'active']);
            $cartItems = $fallbackStmt->fetchAll();
        }
    }

    if (!$cartItems) {
        fail('Cart is empty', 422);
    }

    $shippingAddress = trim((string)($_POST['guestStreetAddress'] ?? $_POST['guest_street_address'] ?? ''));
    $shippingAddress .= $shippingAddress !== '' ? ', ' : '';
    $shippingAddress .= trim((string)($_POST['guestCity'] ?? $_POST['guest_city'] ?? ''));
    $shippingAddress .= ', ' . trim((string)($_POST['guestState'] ?? $_POST['guest_state'] ?? ''));
    $shippingAddress .= ' ' . trim((string)($_POST['guestZip'] ?? $_POST['guest_zip'] ?? ''));

    if (trim($shippingAddress, ', ') === '' && $shippingAddressId > 0 && mock_table_exists('addresses')) {
        $addrStmt = db()->prepare('SELECT street_address, city, state, zip FROM addresses WHERE id = ? LIMIT 1');
        $addrStmt->execute([$shippingAddressId]);
        $addr = $addrStmt->fetch();
        if ($addr) {
            $shippingAddress = trim((string)$addr['street_address']) . ', ' . trim((string)$addr['city']) . ', ' . trim((string)$addr['state']) . ' ' . trim((string)$addr['zip']);
        }
    }

    if (trim($shippingAddress, ', ') === '') {
        $shippingAddress = $isGuestCheckout ? 'Guest Checkout Address' : 'Saved Address';
    }

    $orderNumber = 'MOCK-' . date('Ymd') . '-' . strtoupper(substr(hash('sha1', $checkoutSessionId), 0, 6));

    $pdo = db();
    $pdo->beginTransaction();

    $orderStmt = $pdo->prepare(
        'INSERT INTO orders (user_id, order_number, total_amount, status, shipping_address, billing_address, subtotal, tax_amount, shipping_cost, discount_amount, grand_total, payment_method, payment_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $orderStmt->execute([
        $userId,
        $orderNumber,
        $grandTotal,
        'paid',
        $shippingAddress,
        $shippingAddress,
        $subtotal,
        $taxAmount,
        $shippingCost,
        $discountAmount,
        $grandTotal,
        $paymentMethod,
        'Completed',
    ]);

    $orderId = (int)$pdo->lastInsertId();

    $productStmt = $pdo->prepare('SELECT id, sku, name, price FROM products WHERE id = ? LIMIT 1');
    $variantTable = mock_variant_table();
    $variantPriceCol = mock_variant_price_column();
    $variantStmt = $pdo->prepare('SELECT id, sku, ' . $variantPriceCol . ' AS base_price, discount_price, tax_rate FROM ' . $variantTable . ' WHERE id = ? LIMIT 1');
    $itemStmt = $pdo->prepare(
        'INSERT INTO order_items (order_id, product_id, variant_id, sku, name, quantity, price, discount_price, tax_rate, tax_amount, subtotal, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    foreach ($cartItems as $item) {
        $productId = (int)($item['product_id'] ?? 0);
        $quantity = (int)($item['quantity'] ?? 0);
        $variantId = (int)($item['variant_id'] ?? 0);
        if ($productId <= 0 || $quantity <= 0) {
            continue;
        }

        $productStmt->execute([$productId]);
        $product = $productStmt->fetch();
        if (!$product) {
            continue;
        }

        $sku = (string)($item['sku'] ?? $product['sku'] ?? ('SKU-' . $productId));
        $name = (string)($item['name'] ?? $product['name'] ?? ('Product #' . $productId));
        $variant = null;

        if ($variantId > 0) {
            $variantStmt->execute([$variantId]);
            $variant = $variantStmt->fetch();
        }

        if ($variant && !empty($variant['sku'])) {
            $sku = (string)$variant['sku'];
        }

        $basePrice = (float)($item['snapshot_price'] ?? $item['price'] ?? $variant['base_price'] ?? $product['price'] ?? 0);
        $discountPrice = (float)($item['effective_price'] ?? $item['discount_price'] ?? $variant['discount_price'] ?? $variant['base_price'] ?? $basePrice);
        $taxRate = (float)($item['tax_rate'] ?? $variant['tax_rate'] ?? 0);
        $lineSubtotal = round($basePrice * $quantity, 2);
        $lineTax = round(($discountPrice * $quantity) * ($taxRate / 100), 2);
        $lineTotal = round($discountPrice * $quantity, 2);

        $itemStmt->execute([
            $orderId,
            $productId,
            $variantId > 0 ? $variantId : null,
            $sku,
            $name,
            $quantity,
            $basePrice,
            $discountPrice,
            $taxRate,
            $lineTax,
            $lineSubtotal,
            $lineTotal,
        ]);
    }

    // Clear server-side cart when that table exists.
    if (mock_table_exists('carts')) {
        if ($guestToken !== '') {
            $clearCart = $pdo->prepare('DELETE FROM carts WHERE guest_token = ? OR user_id = ?');
            $clearCart->execute([$guestToken, $userId]);
        } else {
            $clearCart = $pdo->prepare('DELETE FROM carts WHERE user_id = ?');
            $clearCart->execute([$userId]);
        }
    } elseif (mock_table_exists('cart')) {
        if ($guestToken !== '') {
            $clearCart = $pdo->prepare('DELETE FROM cart WHERE guest_token = ? OR user_id = ?');
            $clearCart->execute([$guestToken, $userId]);
        } else {
            $clearCart = $pdo->prepare('DELETE FROM cart WHERE user_id = ?');
            $clearCart->execute([$userId]);
        }
    }

    $pdo->commit();

    ok([
        'order_id' => $orderId,
        'order_number' => $orderNumber,
        'discount_amount' => $discountAmount,
        'grand_total' => $grandTotal,
        'guest_checkout' => $isGuestCheckout,
        'upsell_offer' => 'Mock gateway order placed. Switch provider to Razorpay for live-test flow.',
        'upsell_coupon' => 'WELCOME10',
        'guest_email' => $guestEmail,
        'simulated' => false,
        'gateway' => 'mock',
        'provider_reference' => [
            'order_id' => $gatewayOrderId,
            'payment_id' => $gatewayPaymentId,
            'signature' => $gatewaySignature,
        ],
    ]);
} catch (Throwable $t) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fail('Error processing payment: ' . $t->getMessage(), 500);
}
