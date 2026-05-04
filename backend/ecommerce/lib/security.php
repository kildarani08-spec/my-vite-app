<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/http.php';

function rate_limit_or_fail(string $namespace, string $identifier, int $maxHits, int $windowSeconds): void
{
    $identifier = trim($identifier);
    if ($identifier === '' || $maxHits <= 0 || $windowSeconds <= 0) {
        return;
    }

    $rateKey = hash('sha256', $namespace . '|' . strtolower($identifier));
    $pdo = db();
    $now = new DateTimeImmutable();

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT hit_count, window_expires_at FROM rate_limits WHERE rate_key = ? FOR UPDATE');
        $stmt->execute([$rateKey]);
        $row = $stmt->fetch();

        if (!$row) {
            $expires = $now->modify('+' . $windowSeconds . ' seconds')->format('Y-m-d H:i:s');
            $ins = $pdo->prepare('INSERT INTO rate_limits (rate_key, hit_count, window_expires_at) VALUES (?, 1, ?)');
            $ins->execute([$rateKey, $expires]);
            $pdo->commit();
            return;
        }

        $windowExpiresAt = new DateTimeImmutable((string)$row['window_expires_at']);
        $hits = (int)$row['hit_count'];

        if ($windowExpiresAt <= $now) {
            $newExpires = $now->modify('+' . $windowSeconds . ' seconds')->format('Y-m-d H:i:s');
            $reset = $pdo->prepare('UPDATE rate_limits SET hit_count = 1, window_expires_at = ? WHERE rate_key = ?');
            $reset->execute([$newExpires, $rateKey]);
            $pdo->commit();
            return;
        }

        if ($hits >= $maxHits) {
            $pdo->commit();
            fail('Too many requests. Please wait and try again.', 429);
        }

        $upd = $pdo->prepare('UPDATE rate_limits SET hit_count = hit_count + 1 WHERE rate_key = ?');
        $upd->execute([$rateKey]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        fail('Rate limiter failed', 500);
    }
}
