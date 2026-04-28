<?php
require_once __DIR__ . '/../includes/db.php';
$db = db_connect();

header('Content-Type: application/json');

function table_count(mysqli $db, string $table): int {
  $allowed = ['games', 'trophy_groups', 'trophies', 'scan_state'];
  if (!in_array($table, $allowed, true)) {
    throw new InvalidArgumentException('Unexpected table');
  }

  $result = $db->query("SELECT COUNT(*) AS total FROM {$table}");
  if (!$result) {
    throw new RuntimeException($db->error);
  }

  $row = $result->fetch_assoc();
  return (int)$row['total'];
}

echo json_encode([
  'ok' => true,
  'database' => [
    'games' => table_count($db, 'games'),
    'trophy_groups' => table_count($db, 'trophy_groups'),
    'trophies' => table_count($db, 'trophies'),
    'scan_state' => table_count($db, 'scan_state')
  ]
]);
