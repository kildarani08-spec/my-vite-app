<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

$body = json_input();
$firstName = trim((string)($body['first_name'] ?? ''));
$lastName = trim((string)($body['last_name'] ?? ''));
$email = strtolower(trim((string)($body['email'] ?? '')));
$password = (string)($body['password'] ?? '');
$phone = trim((string)($body['phone_number'] ?? ''));

rate_limit_or_fail('register', client_ip() . '|' . $email, 5, 1800);

if ($firstName === '' || $lastName === '' || $email === '' || $password === '') {
    fail('Missing required fields');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('Invalid email');
}

if (strlen($password) < 8) {
    fail('Password must be at least 8 characters');
}

if (!preg_match('/\d/', $password) || !preg_match('/[^a-zA-Z0-9]/', $password)) {
    fail('Password must include at least one number and one symbol');
}

$name = trim($firstName . ' ' . $lastName);
$hash = password_hash($password, PASSWORD_DEFAULT);

try {
    $stmt = db()->prepare('INSERT INTO users (name, email, password_hash, role, status, phone) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([$name, $email, $hash, 'customer', 'active', $phone ?: null]);
} catch (Throwable $e) {
    fail('Email already exists');
}

ok(['message' => 'Registration successful']);
