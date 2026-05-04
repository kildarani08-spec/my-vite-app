<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

$settings = operational_settings();
$gateway = $settings['paymentGateway'] ?? [];
$webhookEnabled = !empty($gateway['webhookEnabled']);
$secret = trim((string)($gateway['webhookSecret'] ?? ''));

if (!$webhookEnabled || $secret === '') {
    fail('Webhook is disabled', 403);
}

$rawBody = file_get_contents('php://input') ?: '';
$signature = header_value('X-Signature');

if ($signature === '') {
    fail('Missing signature', 401);
}

$expected = hash_hmac('sha256', $rawBody, $secret);
if (!hash_equals($expected, $signature)) {
    fail('Invalid signature', 401);
}

$payload = json_decode($rawBody, true);
if (!is_array($payload)) {
    fail('Invalid payload', 422);
}

$eventType = trim((string)($payload['event'] ?? ''));
if ($eventType === '') {
    fail('Missing event type', 422);
}

if ($eventType === 'payment.captured') {
    $orderNumber = trim((string)($payload['data']['order_number'] ?? ''));
    $transactionId = trim((string)($payload['data']['transaction_id'] ?? ''));

    if ($orderNumber === '') {
        fail('Missing order number', 422);
    }

    $stmt = db()->prepare('UPDATE orders SET payment_status = ?, status = CASE WHEN status = ? THEN ? ELSE status END, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?');
    $stmt->execute(['paid', 'pending', 'processing', $orderNumber]);

    if ($stmt->rowCount() === 0) {
        fail('Order not found', 404);
    }

    $orderStmt = db()->prepare('SELECT o.id, o.order_number, o.status, o.payment_status, u.email
                                FROM orders o
                                JOIN users u ON u.id = o.user_id
                                WHERE o.order_number = ? LIMIT 1');
    $orderStmt->execute([$orderNumber]);
    $order = $orderStmt->fetch();

    if ($order) {
        record_order_event(
            (int)$order['id'],
            'payment_captured',
            'Payment captured',
            'Transaction ID: ' . ($transactionId !== '' ? $transactionId : 'N/A'),
            'webhook',
            null
        );

        $subject = 'Payment received for ' . (string)$order['order_number'];
        $text = "Payment confirmed for order " . (string)$order['order_number'] . ".\nStatus: " . (string)$order['status'];
        queue_email((string)$order['email'], $subject, $text, '<p>Payment confirmed for order <strong>' . htmlspecialchars((string)$order['order_number'], ENT_QUOTES, 'UTF-8') . '</strong>.</p>', ['type' => 'payment_captured', 'order_id' => (int)$order['id']]);
        if (notifications_enabled()) {
            process_email_outbox(10);
        }
    }

    ok([
        'message' => 'Payment captured and order updated',
        'order_number' => $orderNumber,
        'transaction_id' => $transactionId,
    ]);
}

if ($eventType === 'payment.failed') {
    $orderNumber = trim((string)($payload['data']['order_number'] ?? ''));
    if ($orderNumber === '') {
        fail('Missing order number', 422);
    }

    $stmt = db()->prepare('UPDATE orders SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?');
    $stmt->execute(['failed', $orderNumber]);

    if ($stmt->rowCount() === 0) {
        fail('Order not found', 404);
    }

    $orderStmt = db()->prepare('SELECT o.id, o.order_number, u.email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.order_number = ? LIMIT 1');
    $orderStmt->execute([$orderNumber]);
    $order = $orderStmt->fetch();

    if ($order) {
        record_order_event(
            (int)$order['id'],
            'payment_failed',
            'Payment failed',
            'Gateway reported payment failure.',
            'webhook',
            null
        );

        $subject = 'Payment failed for ' . (string)$order['order_number'];
        $text = "Payment failed for order " . (string)$order['order_number'] . ". Please retry payment.";
        queue_email((string)$order['email'], $subject, $text, '<p>Payment failed for order <strong>' . htmlspecialchars((string)$order['order_number'], ENT_QUOTES, 'UTF-8') . '</strong>. Please retry payment.</p>', ['type' => 'payment_failed', 'order_id' => (int)$order['id']]);
        if (notifications_enabled()) {
            process_email_outbox(10);
        }
    }

    ok([
        'message' => 'Payment failure recorded',
        'order_number' => $orderNumber,
    ]);
}

ok(['message' => 'Event acknowledged', 'event' => $eventType]);
