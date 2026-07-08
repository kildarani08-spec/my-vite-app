<?php
declare(strict_types=1);

$host = 'thomas.proxy.rlwy.net';
$port = 58414;
$user = 'root';
$pass = 'haPdKJBusYwqHcbzEocfGKHGDJEbJhup';

try {
    $pdo = new PDO("mysql:host=$host;port=$port;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);

   $sql = file_get_contents(__DIR__ . '/database/schema.sql');
    if ($sql === false) {
        throw new Exception('Could not read schema.sql');
    }

    $statements = array_filter(array_map('trim', explode(";\n", $sql)));

    $count = 0;
    foreach ($statements as $stmt) {
        if ($stmt === '' || str_starts_with($stmt, '--')) continue;
        $pdo->exec($stmt);
        $count++;
    }

    echo "Success! Ran $count statements.";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
