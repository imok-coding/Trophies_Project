<?php
require_once __DIR__ . '/../includes/security.php';
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json');

$secret = $_SERVER['HTTP_X_INGEST_SECRET'] ?? '';
if (!hash_equals(INGEST_SECRET, $secret)) {
  http_response_code(401);
  echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
  exit;
}

$shard_index = isset($_GET['shard_index']) ? (int)$_GET['shard_index'] : null;
if ($shard_index === null || $shard_index < 0) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid shard_index']);
  exit;
}

try {
  $db = db_connect();
  $stmt = $db->prepare('SELECT scan_cursor FROM scan_state WHERE shard_index=?');
  $stmt->bind_param('i', $shard_index);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();

  echo json_encode([
    'ok' => true,
    'cursor' => $row ? (int)$row['scan_cursor'] : null
  ]);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
