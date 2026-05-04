<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function ao_table_exists(string $table): bool
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

function ao_column_exists(string $table, string $column): bool
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

function ao_order_total_select(string $alias = 'o'): string
{
    if (ao_column_exists('orders', 'grand_total')) {
        return 'COALESCE(' . $alias . '.grand_total, 0) AS grand_total';
    }

    if (ao_column_exists('orders', 'total_amount')) {
        return 'COALESCE(' . $alias . '.total_amount, 0) AS grand_total';
    }

    return '0 AS grand_total';
}

function ao_order_status_select(string $alias = 'o'): string
{
    return "LOWER(TRIM(COALESCE({$alias}.status, 'pending'))) AS status";
}

function ao_order_payment_status_select(string $alias = 'o'): string
{
    return ao_column_exists('orders', 'payment_status')
        ? "LOWER(TRIM(COALESCE({$alias}.payment_status, 'pending'))) AS payment_status"
        : "'pending' AS payment_status";
}

function ao_order_payment_method_select(string $alias = 'o'): string
{
    return ao_column_exists('orders', 'payment_method')
        ? "LOWER(TRIM(COALESCE({$alias}.payment_method, 'cod'))) AS payment_method"
        : "'cod' AS payment_method";
}

function ao_order_address_joins(string $alias = 'o'): string
{
    if (ao_table_exists('addresses') && ao_column_exists('orders', 'shipping_address_id') && ao_column_exists('orders', 'billing_address_id')) {
        return ' LEFT JOIN addresses sa ON sa.id = ' . $alias . '.shipping_address_id
                 LEFT JOIN addresses ba ON ba.id = ' . $alias . '.billing_address_id ';
    }

    return '';
}

function ao_order_address_select(string $kind, string $alias = 'o'): string
{
    if (ao_table_exists('addresses') && ao_column_exists('orders', $kind . '_address_id')) {
        $addressAlias = $kind === 'shipping' ? 'sa' : 'ba';
        return "TRIM(CONCAT_WS(', ',\n            NULLIF({$addressAlias}.full_name, ''),\n            NULLIF({$addressAlias}.street_address, ''),\n            NULLIF({$addressAlias}.city, ''),\n            NULLIF({$addressAlias}.state, ''),\n            NULLIF({$addressAlias}.zip, ''),\n            NULLIF({$addressAlias}.country, '')\n        )) AS {$kind}_address";
    }

    if (ao_column_exists('orders', $kind . '_address')) {
        return "COALESCE({$alias}.{$kind}_address, '') AS {$kind}_address";
    }

    return "'' AS {$kind}_address";
}

function ao_update_order_values(int $orderId, array $updates): void
{
    $sets = [];
    $bind = [];

    foreach ($updates as $field => $value) {
        if (!in_array($field, ['status', 'payment_status'], true)) {
            continue;
        }
        if (!ao_column_exists('orders', $field)) {
            continue;
        }

        $sets[] = $field . ' = ?';
        $bind[] = $value;
    }

    if (!$sets) {
        return;
    }

    $sets[] = 'updated_at = CURRENT_TIMESTAMP';
    $bind[] = $orderId;

    $stmt = db()->prepare('UPDATE orders SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($bind);
}

function ao_fetch_order_record(int $orderId): ?array
{
    $sql = 'SELECT o.id, o.order_number, ' . ao_order_status_select('o') . ', ' . ao_order_payment_status_select('o') . ', ' . ao_order_payment_method_select('o') . ',
                   ' . ao_order_total_select('o') . ',
                   u.name AS customer_name, u.email AS customer_email,
                   o.created_at, o.updated_at,
                   ' . ao_order_address_select('shipping', 'o') . ',
                   ' . ao_order_address_select('billing', 'o') . '
            FROM orders o
            JOIN users u ON u.id = o.user_id' . ao_order_address_joins('o') . '
            WHERE o.id = ?
            LIMIT 1';

    $stmt = db()->prepare($sql);
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    return $order ?: null;
}

function ao_fetch_order_items(int $orderId): array
{
    if (!ao_table_exists('order_items')) {
        return [];
    }

    $itemIdColumn = ao_column_exists('order_items', 'order_item_id') ? 'order_item_id' : 'id';
    $hasDirectName = ao_column_exists('order_items', 'name');
    $hasDirectSku = ao_column_exists('order_items', 'sku');
    $hasDiscountPrice = ao_column_exists('order_items', 'discount_price');
    $hasVariantTable = ao_table_exists('product_variants') || ao_table_exists('products_detail');

    if ($hasDirectName) {
        $priceSelect = $hasDiscountPrice ? 'COALESCE(discount_price, price)' : 'price';
        $skuSelect = $hasDirectSku ? 'sku' : "'' AS sku";
        $itemsStmt = db()->prepare(
            'SELECT ' . $itemIdColumn . ' AS order_item_id, product_id, variant_id, quantity, ' . $priceSelect . ' AS price, total, name, ' . $skuSelect . '
             FROM order_items
             WHERE order_id = ?
             ORDER BY ' . $itemIdColumn . ' ASC'
        );
    } else {
        $variantTable = ao_table_exists('product_variants') ? 'product_variants' : 'products_detail';
        $variantJoin = $hasVariantTable ? ' LEFT JOIN ' . $variantTable . ' v ON v.id = oi.variant_id ' : ' ';
        $skuSelect = $hasVariantTable ? 'COALESCE(v.sku, "") AS sku' : "'' AS sku";
        $itemsStmt = db()->prepare(
            'SELECT oi.id AS order_item_id, oi.product_id, oi.variant_id, oi.quantity, oi.price, oi.total, p.name, ' . $skuSelect . '
             FROM order_items oi
             JOIN products p ON p.id = oi.product_id' . $variantJoin . '
             WHERE oi.order_id = ?
             ORDER BY oi.id ASC'
        );
    }

    $itemsStmt->execute([$orderId]);
    return $itemsStmt->fetchAll();
}

function ao_send_customer_update(array $order, string $subject, array $lines, array $metadata = []): void
{
    $email = trim((string)($order['customer_email'] ?? ''));
    if ($email === '') {
        return;
    }

    $cleanLines = array_values(array_filter(array_map(
        static fn ($line): string => trim((string)$line),
        $lines
    )));

    if (!$cleanLines) {
        return;
    }

    $text = implode("\n", $cleanLines);
    $html = '<p>' . implode('</p><p>', array_map(
        static fn (string $line): string => htmlspecialchars($line, ENT_QUOTES, 'UTF-8'),
        $cleanLines
    )) . '</p>';

    queue_email($email, $subject, $text, $html, array_merge([
        'type' => 'order_admin_update',
        'order_id' => (int)($order['id'] ?? 0),
    ], $metadata));

    if (notifications_enabled()) {
        process_email_outbox(10);
    }
}

function ao_summary_from_orders(array $orders): array
{
    $totalOrders = count($orders);
    $attentionCount = 0;
    $shippedCount = 0;
    $refundCount = 0;
    $revenue = 0.0;

    foreach ($orders as $order) {
        $status = strtolower(trim((string)($order['status'] ?? 'pending')));
        $paymentStatus = strtolower(trim((string)($order['payment_status'] ?? 'pending')));
        $amount = (float)($order['grand_total'] ?? 0);

        if (in_array($status, ['pending', 'confirmed', 'processing'], true)) {
            $attentionCount++;
        }
        if ($status === 'shipped') {
            $shippedCount++;
        }
        if ($paymentStatus === 'refunded') {
            $refundCount++;
        }
        if (in_array($paymentStatus, ['paid', 'pending'], true)) {
            $revenue += $amount;
        }
    }

    return [
        'totalOrders' => $totalOrders,
        'attentionCount' => $attentionCount,
        'shippedCount' => $shippedCount,
        'refundCount' => $refundCount,
        'revenue' => round($revenue, 2),
    ];
}

$admin = auth_user(true);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $detailOrderId = (int)($_GET['order_id'] ?? 0);

    if ($detailOrderId > 0) {
        $order = ao_fetch_order_record($detailOrderId);
        if (!$order) {
            fail('Order not found', 404);
        }

        ok([
            'order' => $order,
            'items' => ao_fetch_order_items($detailOrderId),
            'events' => order_events($detailOrderId),
        ]);
    }

    $q = strtolower(trim((string)($_GET['q'] ?? '')));
    $status = strtolower(trim((string)($_GET['status'] ?? '')));
    $paymentStatus = strtolower(trim((string)($_GET['payment_status'] ?? '')));
    $itemCountSelect = ao_table_exists('order_items')
        ? '(SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count'
        : '0 AS item_count';

    $sql = 'SELECT o.id, o.order_number, ' . ao_order_status_select('o') . ', ' . ao_order_payment_status_select('o') . ', ' . ao_order_payment_method_select('o') . ',
                   ' . ao_order_total_select('o') . ',
                   u.name AS customer_name, u.email AS customer_email,
                   o.created_at, o.updated_at,
                   ' . $itemCountSelect . '
            FROM orders o
            JOIN users u ON u.id = o.user_id
            WHERE 1=1';
    $bind = [];

    if ($q !== '') {
        $sql .= ' AND (LOWER(o.order_number) LIKE ? OR LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ?)';
        $like = '%' . $q . '%';
        $bind[] = $like;
        $bind[] = $like;
        $bind[] = $like;
    }

    if ($status !== '') {
        $sql .= ' AND LOWER(o.status) = ?';
        $bind[] = $status;
    }

    if ($paymentStatus !== '' && ao_column_exists('orders', 'payment_status')) {
        $sql .= ' AND LOWER(o.payment_status) = ?';
        $bind[] = $paymentStatus;
    }

    $sql .= ' ORDER BY o.created_at DESC';

    $stmt = db()->prepare($sql);
    $stmt->execute($bind);
    $orders = $stmt->fetchAll();

    ok([
        'orders' => $orders,
        'summary' => ao_summary_from_orders($orders),
    ]);
}

if ($method !== 'POST') {
    fail('Method not allowed', 405);
}

$body = json_input();
$action = trim((string)($body['action'] ?? ''));
$orderId = (int)($body['order_id'] ?? 0);
$note = trim((string)($body['note'] ?? ''));

if ($orderId <= 0) {
    fail('Invalid order id');
}

$order = ao_fetch_order_record($orderId);
if (!$order) {
    fail('Order not found', 404);
}

$allowedOrderStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
$allowedPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];

switch ($action) {
    case 'update_status':
        $statusValue = strtolower(trim((string)($body['status'] ?? ($order['status'] ?? 'pending'))));
        $paymentStatusValue = strtolower(trim((string)($body['payment_status'] ?? ($order['payment_status'] ?? 'pending'))));

        if (!in_array($statusValue, $allowedOrderStatuses, true)) {
            fail('Invalid order status', 422);
        }
        if (!in_array($paymentStatusValue, $allowedPaymentStatuses, true)) {
            fail('Invalid payment status', 422);
        }

        ao_update_order_values($orderId, [
            'status' => $statusValue,
            'payment_status' => $paymentStatusValue,
        ]);

        $changes = [];
        if ((string)$order['status'] !== $statusValue) {
            $changes[] = 'Order status: ' . (string)$order['status'] . ' → ' . $statusValue;
        }
        if ((string)($order['payment_status'] ?? 'pending') !== $paymentStatusValue) {
            $changes[] = 'Payment status: ' . (string)($order['payment_status'] ?? 'pending') . ' → ' . $paymentStatusValue;
        }
        if ($note !== '') {
            $changes[] = 'Admin note: ' . $note;
        }

        if ($changes) {
            record_order_event(
                $orderId,
                'admin_order_update',
                'Order updated by admin',
                implode("\n", $changes),
                'admin',
                (int)$admin['id']
            );

            ao_send_customer_update(
                $order,
                'Order update: ' . (string)$order['order_number'],
                array_merge(
                    ['Your order ' . (string)$order['order_number'] . ' has been updated.'],
                    $changes
                ),
                ['action' => 'order_status_update']
            );
        }

        log_admin_action(
            (int)$admin['id'],
            'order_update_status',
            'order',
            (string)$orderId,
            [
                'status' => $statusValue,
                'payment_status' => $paymentStatusValue,
                'note' => $note,
            ]
        );

        ok([
            'message' => 'Order updated',
            'order' => ao_fetch_order_record($orderId),
            'events' => order_events($orderId),
        ]);

    case 'add_tracking':
        $courier = trim((string)($body['courier'] ?? ''));
        $trackingNumber = trim((string)($body['tracking_number'] ?? ''));
        $eta = trim((string)($body['eta'] ?? ''));
        $trackingNote = trim((string)($body['tracking_note'] ?? $note));

        if ($courier === '' && $trackingNumber === '' && $eta === '' && $trackingNote === '') {
            fail('Add at least one tracking detail', 422);
        }

        $nextStatus = in_array((string)$order['status'], ['delivered', 'cancelled'], true)
            ? (string)$order['status']
            : 'shipped';
        ao_update_order_values($orderId, ['status' => $nextStatus]);

        $detailLines = array_values(array_filter([
            $courier !== '' ? 'Carrier: ' . $courier : '',
            $trackingNumber !== '' ? 'Tracking ID: ' . $trackingNumber : '',
            $eta !== '' ? 'Estimated delivery: ' . $eta : '',
            $trackingNote !== '' ? 'Note: ' . $trackingNote : '',
        ]));

        record_order_event(
            $orderId,
            'tracking_update',
            'Shipment tracking updated',
            implode("\n", $detailLines),
            'admin',
            (int)$admin['id']
        );

        ao_send_customer_update(
            $order,
            'Tracking update: ' . (string)$order['order_number'],
            array_merge(
                ['Your order is moving through fulfillment.'],
                $detailLines,
                ['Current order status: ' . $nextStatus]
            ),
            ['action' => 'tracking_update']
        );

        log_admin_action(
            (int)$admin['id'],
            'order_tracking_update',
            'order',
            (string)$orderId,
            [
                'courier' => $courier,
                'tracking_number' => $trackingNumber,
                'eta' => $eta,
                'note' => $trackingNote,
            ]
        );

        ok([
            'message' => 'Tracking updated',
            'order' => ao_fetch_order_record($orderId),
            'events' => order_events($orderId),
        ]);

    case 'mark_return_requested':
        record_order_event(
            $orderId,
            'return_requested',
            'Return requested',
            $note !== '' ? $note : 'Admin flagged this order for return review.',
            'admin',
            (int)$admin['id']
        );

        log_admin_action((int)$admin['id'], 'order_return_requested', 'order', (string)$orderId, ['note' => $note]);

        ok([
            'message' => 'Return request logged',
            'order' => ao_fetch_order_record($orderId),
            'events' => order_events($orderId),
        ]);

    case 'approve_return':
        record_order_event(
            $orderId,
            'return_approved',
            'Return approved',
            $note !== '' ? $note : 'Admin approved the return request.',
            'admin',
            (int)$admin['id']
        );

        ao_send_customer_update(
            $order,
            'Return approved: ' . (string)$order['order_number'],
            [
                'Your return request has been approved.',
                $note !== '' ? 'Admin note: ' . $note : 'Our team has approved the return and will guide the next step.'
            ],
            ['action' => 'return_approved']
        );

        log_admin_action((int)$admin['id'], 'order_return_approved', 'order', (string)$orderId, ['note' => $note]);

        ok([
            'message' => 'Return approved',
            'order' => ao_fetch_order_record($orderId),
            'events' => order_events($orderId),
        ]);

    case 'reject_return':
        record_order_event(
            $orderId,
            'return_rejected',
            'Return rejected',
            $note !== '' ? $note : 'Admin rejected the return request.',
            'admin',
            (int)$admin['id']
        );

        ao_send_customer_update(
            $order,
            'Return update: ' . (string)$order['order_number'],
            [
                'The return request for your order was reviewed.',
                $note !== '' ? 'Admin note: ' . $note : 'Please contact support if you need more help.'
            ],
            ['action' => 'return_rejected']
        );

        log_admin_action((int)$admin['id'], 'order_return_rejected', 'order', (string)$orderId, ['note' => $note]);

        ok([
            'message' => 'Return rejected',
            'order' => ao_fetch_order_record($orderId),
            'events' => order_events($orderId),
        ]);

    case 'issue_refund':
        $refundUpdates = ['payment_status' => 'refunded'];
        if (in_array((string)$order['status'], ['pending', 'confirmed', 'processing'], true)) {
            $refundUpdates['status'] = 'cancelled';
        }
        ao_update_order_values($orderId, $refundUpdates);

        record_order_event(
            $orderId,
            'refund_issued',
            'Refund issued',
            $note !== '' ? $note : 'Admin issued a refund for this order.',
            'admin',
            (int)$admin['id']
        );

        ao_send_customer_update(
            $order,
            'Refund update: ' . (string)$order['order_number'],
            [
                'A refund has been processed for your order.',
                $note !== '' ? 'Admin note: ' . $note : 'Please allow the normal bank or wallet settlement time.'
            ],
            ['action' => 'refund_issued']
        );

        log_admin_action((int)$admin['id'], 'order_refund_issued', 'order', (string)$orderId, ['note' => $note]);

        ok([
            'message' => 'Refund marked as issued',
            'order' => ao_fetch_order_record($orderId),
            'events' => order_events($orderId),
        ]);

    case 'add_note':
        if ($note === '') {
            fail('Note is required', 422);
        }

        record_order_event(
            $orderId,
            'admin_note',
            'Internal admin note',
            $note,
            'admin',
            (int)$admin['id']
        );

        log_admin_action((int)$admin['id'], 'order_note_added', 'order', (string)$orderId, ['note' => $note]);

        ok([
            'message' => 'Note added',
            'order' => ao_fetch_order_record($orderId),
            'events' => order_events($orderId),
        ]);
}

fail('Invalid action');
