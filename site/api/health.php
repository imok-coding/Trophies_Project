<?php
header('Content-Type: application/json');

function table_count(mysqli $db, string $table): int {
  $allowed = ['games', 'trophy_groups', 'trophies', 'scan_state', 'game_regions', 'game_region_evidence', 'game_store_links'];
  if (!in_array($table, $allowed, true)) {
    throw new InvalidArgumentException('Unexpected table');
  }

  $result = $db->query("SELECT COUNT(*) AS total FROM {$table}");
  if (!$result) {
    if ($db->errno === 1146) {
      return 0;
    }
    throw new RuntimeException($db->error);
  }

  $row = $result->fetch_assoc();
  return (int)$row['total'];
}

try {
  require_once __DIR__ . '/../includes/db.php';
  $db = db_connect();

  echo json_encode([
    'ok' => true,
    'database' => [
      'games' => table_count($db, 'games'),
      'trophy_groups' => table_count($db, 'trophy_groups'),
      'trophies' => table_count($db, 'trophies'),
      'scan_state' => table_count($db, 'scan_state'),
      'game_regions' => table_count($db, 'game_regions'),
      'game_region_evidence' => table_count($db, 'game_region_evidence'),
      'game_store_links' => table_count($db, 'game_store_links')
    ]
  ]);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode([
    'ok' => false,
    'error' => $e->getMessage()
  ]);
}
