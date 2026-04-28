<?php
require_once __DIR__ . '/config.php';

function verify_hmac(string $raw): bool {
  $sig = $_SERVER['HTTP_X_SIGNATURE'] ?? '';
  $calc = 'sha256=' . hash_hmac('sha256', $raw, INGEST_SECRET);
  return hash_equals($calc, $sig);
}
