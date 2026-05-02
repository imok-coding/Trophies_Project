<?php
require_once __DIR__ . '/../includes/psn.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$accountId = trim((string)($_GET['accountId'] ?? ''));
$npwr = strtoupper(trim((string)($_GET['npwr'] ?? '')));
$service = trim((string)($_GET['service'] ?? 'trophy2'));

if ($accountId === '' || $npwr === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Missing account ID or NPWR.']);
  exit;
}

try {
  echo json_encode(['ok' => true, 'title' => psn_user_title_trophies($accountId, $npwr, $service)]);
} catch (Throwable $e) {
  http_response_code(503);
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
