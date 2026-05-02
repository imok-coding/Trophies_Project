<?php
require_once __DIR__ . '/../includes/psn.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$accountId = trim((string)($_GET['accountId'] ?? ''));
$limit = max(1, min(800, (int)($_GET['limit'] ?? 800)));

if ($accountId === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Missing account ID.']);
  exit;
}

try {
  echo json_encode(['ok' => true, 'titles' => psn_user_trophy_titles($accountId, $limit)]);
} catch (Throwable $e) {
  http_response_code(503);
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
