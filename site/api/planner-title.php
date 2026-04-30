<?php
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json; charset=utf-8');

$npwr = trim((string)($_GET['npwr'] ?? ''));
if (!preg_match('/^NPWR\d{5}_00$/', $npwr)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid NPWR']);
  exit;
}

$db = db_connect();
$stmt = $db->prepare("SELECT npwr, title_name, title_platform, icon_url FROM games WHERE npwr=?");
$stmt->bind_param('s', $npwr);
$stmt->execute();
$game = $stmt->get_result()->fetch_assoc();
if (!$game) {
  http_response_code(404);
  echo json_encode(['ok' => false, 'error' => 'Title not found']);
  exit;
}

$stmt = $db->prepare("
  SELECT trophy_id, group_id, trophy_name, trophy_detail, trophy_type, hidden, icon_url
  FROM trophies
  WHERE npwr=?
  ORDER BY group_id, trophy_id
");
$stmt->bind_param('s', $npwr);
$stmt->execute();
$res = $stmt->get_result();

$trophies = [];
$counts = ['platinum' => 0, 'gold' => 0, 'silver' => 0, 'bronze' => 0, 'total' => 0];
while ($row = $res->fetch_assoc()) {
  $type = (string)$row['trophy_type'];
  if (isset($counts[$type])) {
    $counts[$type]++;
  }
  $counts['total']++;
  $trophies[] = [
    'id' => (int)$row['trophy_id'],
    'groupId' => $row['group_id'],
    'name' => $row['trophy_name'],
    'detail' => $row['trophy_detail'],
    'type' => $type,
    'hidden' => (int)$row['hidden'] === 1,
    'iconUrl' => $row['icon_url']
  ];
}

echo json_encode([
  'ok' => true,
  'title' => [
    'npwr' => $game['npwr'],
    'title' => $game['title_name'],
    'platform' => $game['title_platform'],
    'iconUrl' => $game['icon_url'],
    'counts' => $counts,
    'trophies' => $trophies
  ]
]);
