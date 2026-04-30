<?php
require_once __DIR__ . '/../includes/psn.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$q = trim((string)($_GET['q'] ?? ''));
if ($q === '') {
  echo json_encode(['ok' => true, 'results' => []]);
  exit;
}

if (strlen($q) > 64) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Search is too long.']);
  exit;
}

try {
  echo json_encode(['ok' => true, 'results' => psn_search_users($q)]);
} catch (Throwable $e) {
  http_response_code(503);
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
