<?php
require_once __DIR__ . '/config.php';

function db_connect(): mysqli {
  mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

  try {
    $db = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    $db->set_charset("utf8mb4");
    return $db;
  } catch (mysqli_sql_exception $e) {
    http_response_code(500);
    throw new RuntimeException("DB connection failed: " . $e->getMessage(), 0, $e);
  }
}
