<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/settings.php';

function post_json_request(string $url, array $headers, array $payload): array
{
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'error' => 'cURL extension is not available'];
    }

    $ch = curl_init($url);
    if ($ch === false) {
        return ['ok' => false, 'error' => 'Failed to initialize cURL'];
    }

    $body = json_encode($payload);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_POSTFIELDS => $body,
    ]);

    $responseBody = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($responseBody === false) {
        return ['ok' => false, 'error' => $error !== '' ? $error : 'HTTP request failed'];
    }

    if ($code < 200 || $code >= 300) {
        return ['ok' => false, 'error' => 'HTTP ' . $code . ': ' . substr((string)$responseBody, 0, 180)];
    }

    return ['ok' => true, 'error' => ''];
}

function post_form_request(string $url, string $username, string $password, array $form): array
{
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'error' => 'cURL extension is not available'];
    }

    $ch = curl_init($url);
    if ($ch === false) {
        return ['ok' => false, 'error' => 'Failed to initialize cURL'];
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_USERPWD => $username . ':' . $password,
        CURLOPT_POSTFIELDS => http_build_query($form),
    ]);

    $responseBody = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($responseBody === false) {
        return ['ok' => false, 'error' => $error !== '' ? $error : 'HTTP request failed'];
    }

    if ($code < 200 || $code >= 300) {
        return ['ok' => false, 'error' => 'HTTP ' . $code . ': ' . substr((string)$responseBody, 0, 180)];
    }

    return ['ok' => true, 'error' => ''];
}

function send_via_mail(string $fromEmail, string $recipient, string $subject, string $bodyText, string $bodyHtml): array
{
    $headers = [
        'From: ' . $fromEmail,
        'MIME-Version: 1.0',
    ];

    $message = $bodyText;
    if ($bodyHtml !== '') {
        $boundary = '=_myshop_' . bin2hex(random_bytes(8));
        $headers[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';
        $message = "--{$boundary}\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n\r\n"
            . ($bodyText !== '' ? $bodyText : strip_tags($bodyHtml)) . "\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n\r\n"
            . $bodyHtml . "\r\n"
            . "--{$boundary}--";
    } else {
        $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    }

    $ok = @mail($recipient, $subject, $message, implode("\r\n", $headers));
    return ['ok' => $ok, 'error' => $ok ? '' : 'mail() failed'];
}

function send_via_sendgrid(array $notifications, string $recipient, string $subject, string $bodyText, string $bodyHtml): array
{
    $apiKey = trim((string)($notifications['sendgridApiKey'] ?? ''));
    $fromEmail = trim((string)($notifications['fromEmail'] ?? 'support@myshop.com')) ?: 'support@myshop.com';
    if ($apiKey === '') {
        return ['ok' => false, 'error' => 'SendGrid API key missing'];
    }

    $payload = [
        'personalizations' => [[
            'to' => [['email' => $recipient]],
            'subject' => $subject,
        ]],
        'from' => ['email' => $fromEmail],
        'content' => [
            ['type' => 'text/plain', 'value' => $bodyText !== '' ? $bodyText : strip_tags($bodyHtml)],
        ],
    ];

    if ($bodyHtml !== '') {
        $payload['content'][] = ['type' => 'text/html', 'value' => $bodyHtml];
    }

    return post_json_request(
        'https://api.sendgrid.com/v3/mail/send',
        ['Authorization: Bearer ' . $apiKey],
        $payload
    );
}

function send_via_mailgun(array $notifications, string $recipient, string $subject, string $bodyText, string $bodyHtml): array
{
    $domain = trim((string)($notifications['mailgunDomain'] ?? ''));
    $apiKey = trim((string)($notifications['mailgunApiKey'] ?? ''));
    $fromEmail = trim((string)($notifications['fromEmail'] ?? 'support@myshop.com')) ?: 'support@myshop.com';

    if ($domain === '' || $apiKey === '') {
        return ['ok' => false, 'error' => 'Mailgun domain/API key missing'];
    }

    $form = [
        'from' => $fromEmail,
        'to' => $recipient,
        'subject' => $subject,
        'text' => $bodyText !== '' ? $bodyText : strip_tags($bodyHtml),
    ];
    if ($bodyHtml !== '') {
        $form['html'] = $bodyHtml;
    }

    return post_form_request(
        'https://api.mailgun.net/v3/' . rawurlencode($domain) . '/messages',
        'api',
        $apiKey,
        $form
    );
}

function deliver_email(array $settings, string $recipient, string $subject, string $bodyText, string $bodyHtml): array
{
    $notifications = $settings['notifications'] ?? [];
    $provider = strtolower(trim((string)($notifications['provider'] ?? 'mail')));
    $fromEmail = trim((string)($notifications['fromEmail'] ?? 'support@myshop.com')) ?: 'support@myshop.com';

    if ($provider === 'sendgrid') {
        return send_via_sendgrid($notifications, $recipient, $subject, $bodyText, $bodyHtml);
    }

    if ($provider === 'mailgun') {
        return send_via_mailgun($notifications, $recipient, $subject, $bodyText, $bodyHtml);
    }

    return send_via_mail($fromEmail, $recipient, $subject, $bodyText, $bodyHtml);
}

function ensure_notification_outbox_table(): void
{
    static $ensured = false;

    if ($ensured) {
        return;
    }

    db()->exec("CREATE TABLE IF NOT EXISTS notification_outbox (
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
    )");

    $ensured = true;
}

function queue_email(string $recipient, string $subject, string $bodyText, string $bodyHtml = '', array $metadata = []): int
{
    $recipient = trim($recipient);
    $subject = trim($subject);

    if ($recipient === '' || $subject === '') {
        throw new InvalidArgumentException('Recipient and subject are required');
    }

    $jsonMeta = json_encode($metadata, JSON_UNESCAPED_UNICODE);
    $metadataJson = $jsonMeta === false ? '{}' : $jsonMeta;

    try {
        ensure_notification_outbox_table();

        $stmt = db()->prepare('INSERT INTO notification_outbox (channel, recipient, subject, body_html, body_text, status, metadata, next_attempt_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())');
        $stmt->execute([
            'email',
            $recipient,
            $subject,
            $bodyHtml,
            $bodyText,
            'queued',
            $metadataJson,
        ]);

        return (int)db()->lastInsertId();
    } catch (Throwable $e) {
        error_log('queue_email failed: ' . $e->getMessage());
        return 0;
    }
}

function notifications_enabled(): bool
{
    $settings = operational_settings();
    return !empty($settings['notifications']['enabled']);
}

function process_email_outbox(int $limit = 20): array
{
    $limit = max(1, min($limit, 100));
    $settings = operational_settings();
    $jobs = $settings['jobs'] ?? [];
    $maxAttempts = max(1, min((int)($jobs['maxEmailAttempts'] ?? 3), 10));
    $retryBackoffSeconds = max(10, min((int)($jobs['retryBackoffSeconds'] ?? 90), 3600));

    $stmt = db()->prepare('SELECT id, recipient, subject, body_html, body_text, attempts FROM notification_outbox WHERE status = ? AND next_attempt_at <= NOW() ORDER BY id ASC LIMIT ' . (int)$limit);
    $stmt->execute(['queued']);
    $rows = $stmt->fetchAll();

    $sent = 0;
    $failed = 0;
    $requeued = 0;

    foreach ($rows as $row) {
        $id = (int)$row['id'];
        $recipient = (string)$row['recipient'];
        $subject = (string)$row['subject'];
        $bodyText = (string)$row['body_text'];
        $bodyHtml = (string)($row['body_html'] ?? '');
        $attempts = (int)($row['attempts'] ?? 0) + 1;

        $delivery = deliver_email($settings, $recipient, $subject, $bodyText, $bodyHtml);
        $ok = (bool)($delivery['ok'] ?? false);
        $errorMessage = trim((string)($delivery['error'] ?? 'Delivery failed'));

        if ($ok) {
            $update = db()->prepare('UPDATE notification_outbox SET status = ?, attempts = ?, sent_at = NOW(), last_error = NULL WHERE id = ?');
            $update->execute(['sent', $attempts, $id]);
            $sent++;
            continue;
        }

        $status = $attempts >= $maxAttempts ? 'failed' : 'queued';
        if ($status === 'failed') {
            $update = db()->prepare('UPDATE notification_outbox SET status = ?, attempts = ?, last_error = ? WHERE id = ?');
            $update->execute([$status, $attempts, substr($errorMessage, 0, 250), $id]);
            $failed++;
            continue;
        }

        $delay = $retryBackoffSeconds * $attempts;
        $nextAttemptAt = (new DateTimeImmutable('+' . $delay . ' seconds'))->format('Y-m-d H:i:s');
        $update = db()->prepare('UPDATE notification_outbox SET status = ?, attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ?');
        $update->execute([$status, $attempts, substr($errorMessage, 0, 250), $nextAttemptAt, $id]);
        $requeued++;
    }

    return [
        'processed' => count($rows),
        'sent' => $sent,
        'failed' => $failed,
        'requeued' => $requeued,
    ];
}
