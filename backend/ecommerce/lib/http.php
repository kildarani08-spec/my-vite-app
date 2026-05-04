<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

function boot_http(): void
{
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    $allowedOrigin = CORS_ORIGIN;

    if (APP_ENV === 'development' && $origin !== '' && preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#i', $origin)) {
        $allowedOrigin = $origin;
    }

    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, Idempotency-Key');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function json_input(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function ok(array $payload = []): void
{
    echo json_encode(array_merge(['success' => true], $payload));
    exit;
}

function fail(string $message, int $status = 400): void
{
    http_response_code($status);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

function bearer_token(): string
{
    $header = trim((string)($_SERVER['HTTP_AUTHORIZATION'] ?? ''));
    if ($header === '') {
        $header = trim((string)($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? ''));
    }
    if ($header === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        $header = trim((string)($headers['Authorization'] ?? $headers['authorization'] ?? ''));
    }

    if (preg_match('/Bearer\s+([a-zA-Z0-9]+)/', $header, $match)) {
        return $match[1];
    }

    return '';
}

function client_ip(): string
{
    $forwarded = trim((string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''));
    if ($forwarded !== '') {
        $parts = explode(',', $forwarded);
        $candidate = trim($parts[0]);
        if ($candidate !== '') {
            return $candidate;
        }
    }

    $remote = trim((string)($_SERVER['REMOTE_ADDR'] ?? ''));
    return $remote !== '' ? $remote : 'unknown';
}

function header_value(string $name): string
{
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return trim((string)($_SERVER[$key] ?? ''));
}
