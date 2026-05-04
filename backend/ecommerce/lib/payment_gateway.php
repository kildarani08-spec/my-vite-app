<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/settings.php';

function razorpay_provider_enabled(): bool
{
    $gateway = operational_settings()['paymentGateway'] ?? [];
    return strtolower(trim((string)($gateway['provider'] ?? ''))) === 'razorpay';
}

function razorpay_has_credentials(): bool
{
    return trim((string)RAZORPAY_KEY_ID) !== '' && trim((string)RAZORPAY_KEY_SECRET) !== '';
}

function razorpay_public_key(): string
{
    return trim((string)RAZORPAY_KEY_ID);
}

function razorpay_create_order(int $amountPaise, string $receipt, array $notes = []): array
{
    if (!razorpay_provider_enabled()) {
        throw new RuntimeException('Payment provider is not configured to Razorpay');
    }

    if (!razorpay_has_credentials()) {
        throw new RuntimeException('Razorpay credentials are missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/ecommerce/lib/config.php');
    }

    if ($amountPaise <= 0) {
        throw new RuntimeException('Invalid Razorpay order amount');
    }

    $payload = [
        'amount' => $amountPaise,
        'currency' => 'INR',
        'receipt' => $receipt,
        'payment_capture' => 1,
        'notes' => $notes,
    ];

    $ch = curl_init('https://api.razorpay.com/v1/orders');
    if ($ch === false) {
        throw new RuntimeException('Unable to initialize payment request');
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_USERPWD => RAZORPAY_KEY_ID . ':' . RAZORPAY_KEY_SECRET,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES),
        CURLOPT_TIMEOUT => 25,
    ]);

    $response = curl_exec($ch);
    $curlErr = curl_error($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false) {
        throw new RuntimeException('Failed to connect to Razorpay: ' . ($curlErr !== '' ? $curlErr : 'Unknown cURL error'));
    }

    $decoded = json_decode($response, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Razorpay returned an invalid response');
    }

    if ($httpCode >= 400 || empty($decoded['id'])) {
        $message = trim((string)($decoded['error']['description'] ?? $decoded['error']['reason'] ?? 'Failed to create Razorpay order'));
        throw new RuntimeException($message);
    }

    return $decoded;
}

function razorpay_verify_signature(string $razorpayOrderId, string $razorpayPaymentId, string $razorpaySignature): bool
{
    if (!razorpay_has_credentials()) {
        return false;
    }

    if ($razorpayOrderId === '' || $razorpayPaymentId === '' || $razorpaySignature === '') {
        return false;
    }

    $body = $razorpayOrderId . '|' . $razorpayPaymentId;
    $expected = hash_hmac('sha256', $body, RAZORPAY_KEY_SECRET);
    return hash_equals($expected, $razorpaySignature);
}
