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
  $user = psn_find_exact_user($q);
  if ($user === null) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'User does not exist']);
    exit;
  }

  echo json_encode(['ok' => true, 'user' => $user, 'results' => [$user]]);
} catch (Throwable $e) {
  http_response_code(503);
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
