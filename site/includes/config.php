<?php
$localConfig = __DIR__ . '/config.local.php';
if (is_file($localConfig)) {
  require_once $localConfig;
}

function config_value(string $name): string {
  if (defined($name)) {
    return constant($name);
  }

  $value = getenv($name);
  if ($value === false || $value === '') {
    http_response_code(500);
    exit("Missing config {$name}");
  }

  return $value;
}

function define_config(string $name): void {
  if (!defined($name)) {
    define($name, config_value($name));
  }
}

define_config('DB_HOST');
define_config('DB_NAME');
define_config('DB_USER');
define_config('DB_PASS');

// Must match the GitHub Actions secret named INGEST_SECRET.
define_config('INGEST_SECRET');
