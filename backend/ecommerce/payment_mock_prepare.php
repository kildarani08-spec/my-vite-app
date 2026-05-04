<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function mock_b64url_encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

$token = bearer_token();
$user = $token !== '' ? auth_user(false) : null;
fail_if_admin_purchase($user, 'Admin accounts cannot start checkout from the storefront. Please use a customer account.');

$paymentMethod = strtolower(trim((string)($_POST['payment'] ?? '')));
$idempotencyKey = trim((string)($_POST['idempotencyKey'] ?? header_value('Idempotency-Key')));

if ($idempotencyKey === '' || strlen($idempotencyKey) > 120) {
    fail('Missing or invalid idempotency key', 422);
}

if (!in_array($paymentMethod, ['card', 'upi'], true)) {
    fail('Mock gateway supports card or UPI only', 422);
}

$allowedPayments = enabled_payment_methods();
if (!in_array($paymentMethod, $allowedPayments, true)) {
    fail('Selected payment method is unavailable', 422);
}

$itemsPayload = json_decode((string)($_POST['cartItems'] ?? '[]'), true);
if (!is_array($itemsPayload) || !$itemsPayload) {
    fail('Cart is empty', 422);
}

$settings = site_settings();
$threshold = (float)($settings['offers']['freeShippingThreshold'] ?? 999);
$shippingFee = (float)($settings['offers']['standardShippingFee'] ?? 80);

$subtotal = 0.0;
$effectiveSubtotal = 0.0;
$discountAmount = 0.0;
$taxAmount = 0.0;
$freeShippingOfferActive = false;
foreach ($itemsPayload as $item) {
    $qty = max(0, (int)($item['quantity'] ?? 0));
    $basePrice = (float)($item['snapshot_price'] ?? $item['price'] ?? $item['effective_price'] ?? 0);
    $price = (float)($item['effective_price'] ?? $item['price'] ?? 0);
    $taxRate = max(0, (float)($item['tax_rate'] ?? 0));
    if ($qty <= 0 || $price < 0 || $basePrice < 0) {
        continue;
    }

    $itemPromotions = is_array($item['applied_promotions'] ?? null) ? $item['applied_promotions'] : [];
    foreach ($itemPromotions as $promotion) {
        if (is_array($promotion) && !empty($promotion['free_shipping'])) {
            $freeShippingOfferActive = true;
            break;
        }
    }

    if (!$freeShippingOfferActive) {
        $promoOffer = strtolower(trim((string)($item['promo_offer'] ?? '')));
        if ($promoOffer !== '' && (str_contains($promoOffer, 'free_shipping') || str_contains($promoOffer, 'free-shipping') || str_contains($promoOffer, 'free shipping'))) {
            $freeShippingOfferActive = true;
        }
    }

    $lineSubtotal = $qty * $basePrice;
    $lineEffectiveTotal = $qty * $price;
    $subtotal += $lineSubtotal;
    $effectiveSubtotal += $lineEffectiveTotal;
    $discountAmount += max(0, $lineSubtotal - $lineEffectiveTotal);
    $taxAmount += $lineEffectiveTotal * ($taxRate / 100);
}

if ($effectiveSubtotal <= 0) {
    fail('Cart is empty', 422);
}

$subtotal = round($subtotal, 2);
$effectiveSubtotal = round($effectiveSubtotal, 2);
$discountAmount = round($discountAmount, 2);
$taxAmount = round($taxAmount, 2);

$freeShippingApplied = $freeShippingOfferActive && ($threshold <= 0 || $effectiveSubtotal >= $threshold);
$remainingForFreeShipping = $freeShippingOfferActive && $effectiveSubtotal > 0 && !$freeShippingApplied && $threshold > 0
    ? round($threshold - $effectiveSubtotal, 2)
    : 0.0;
$shippingCost = ($effectiveSubtotal <= 0 || $freeShippingApplied) ? 0.0 : $shippingFee;
$grandTotal = round($effectiveSubtotal + $shippingCost, 2);
$amountPaise = (int)round($grandTotal * 100);

if ($amountPaise <= 0) {
    fail('Invalid payable amount', 422);
}

$sessionSeed = hash('sha256', $idempotencyKey . '|' . microtime(true));
$orderId = 'order_mock_' . strtoupper(substr($sessionSeed, 0, 14));

$sessionPayload = [
    'exp' => time() + 1800,
    'method' => $paymentMethod,
    'subtotal' => round($subtotal, 2),
    'effective_subtotal' => round($effectiveSubtotal, 2),
    'shipping' => round($shippingCost, 2),
    'discount_amount' => $discountAmount,
    'tax_amount' => $taxAmount,
    'total' => $grandTotal,
    'orderId' => $orderId,
];

$payloadJson = json_encode($sessionPayload, JSON_UNESCAPED_UNICODE);
$payloadToken = mock_b64url_encode($payloadJson ?: '{}');
$sig = hash_hmac('sha256', $payloadToken, DB_NAME . '|' . DB_HOST);
$sessionToken = 'mock_' . $payloadToken . '.' . $sig;

ok([
    'requires_gateway' => true,
    'checkout_session_id' => $sessionToken,
    'gateway' => 'mock',
    'sandbox_mode' => true,
    'key_id' => 'mock_key',
    'amount' => $amountPaise,
    'currency' => 'INR',
    'order_id' => $orderId,
    'name' => 'MYSHOP Mock Gateway',
    'description' => 'Mock payment for integration testing',
    'prefill' => [
        'name' => trim((string)($_POST['guestFullName'] ?? $_POST['guest_full_name'] ?? '')),
        'email' => trim((string)($_POST['guestEmail'] ?? $_POST['guest_email'] ?? '')),
        'contact' => trim((string)($_POST['guestPhone'] ?? $_POST['guest_phone'] ?? '')),
    ],
    'summary' => [
        'subtotal' => round($subtotal, 2),
        'effective_subtotal' => $effectiveSubtotal,
        'shipping' => round($shippingCost, 2),
        'discount' => $discountAmount,
        'tax' => $taxAmount,
        'total' => $grandTotal,
    ],
    'sandbox_hint' => 'Mock API mode: no real payment will be charged.',
]);
