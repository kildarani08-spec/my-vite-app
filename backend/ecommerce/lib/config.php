<?php

declare(strict_types=1);

function env_value(string $name, string $default): string
{
    $value = getenv($name);
    if ($value === false) {
        return $default;
    } else {
        return $value;
    }
}

define('DB_HOST', env_value('DB_HOST', 'localhost'));
define('DB_PORT', (int) env_value('DB_PORT', '3306'));
define('DB_NAME', env_value('DB_NAME', 'ecommerce_db'));
define('DB_USER', env_value('DB_USER', 'root'));
define('DB_PASS', env_value('DB_PASS', ''));

const TOKEN_TTL_HOURS = 72;
const CORS_ORIGIN = 'https://my-vite-app-ltkt.onrender.com';
const APP_ENV = 'production';
