<?php
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json; charset=utf-8');

$npwr = strtoupper(trim((string)($_GET['npwr'] ?? '')));
if (!preg_match('/^NPWR\d{5}_00$/', $npwr)) {
  echo json_encode(['ok' => false, 'error' => 'Invalid NPWR.']);
  exit;
}

$db = db_connect();
$stmt = $db->prepare('SELECT npwr, title_name, title_platform, icon_url FROM games WHERE npwr=? LIMIT 1');
$stmt->bind_param('s', $npwr);
$stmt->execute();
$game = $stmt->get_result()->fetch_assoc();
if (!$game) {
  echo json_encode(['ok' => false, 'error' => 'Game not found.']);
  exit;
}

$groupsStmt = $db->prepare("
  SELECT group_id, group_name, detail, icon_url, defined_total
  FROM trophy_groups
  WHERE npwr=?
  ORDER BY
    CASE WHEN LOWER(group_id) = 'default' OR LOWER(group_name) IN ('default trophy set', 'base game') THEN 0 ELSE 1 END,
    group_id
");
$groupsStmt->bind_param('s', $npwr);
$groupsStmt->execute();
$groupsResult = $groupsStmt->get_result();

$trophyStmt = $db->prepare("
  SELECT trophy_id, trophy_name, trophy_detail, trophy_type, hidden, icon_url
  FROM trophies
  WHERE npwr=? AND group_id=?
  ORDER BY trophy_id
");

$groups = [];
$totalCounts = ['platinum' => 0, 'gold' => 0, 'silver' => 0, 'bronze' => 0, 'total' => 0];
while ($group = $groupsResult->fetch_assoc()) {
  $groupId = (string)$group['group_id'];
  $trophyStmt->bind_param('ss', $npwr, $groupId);
  $trophyStmt->execute();
  $trophiesResult = $trophyStmt->get_result();

  $trophies = [];
  $counts = ['platinum' => 0, 'gold' => 0, 'silver' => 0, 'bronze' => 0, 'total' => 0];
  while ($row = $trophiesResult->fetch_assoc()) {
    $type = strtolower((string)$row['trophy_type']);
    if (isset($counts[$type])) {
      $counts[$type]++;
      $totalCounts[$type]++;
    }
    $counts['total']++;
    $totalCounts['total']++;
    $trophies[] = [
      'id' => (int)$row['trophy_id'],
      'name' => (string)$row['trophy_name'],
      'detail' => (string)$row['trophy_detail'],
      'type' => $type,
      'hidden' => (bool)$row['hidden'],
      'iconUrl' => (string)$row['icon_url']
    ];
  }

  $name = trim((string)$group['group_name']);
  $isBase = strtolower($groupId) === 'default' || strcasecmp($name, 'Default Trophy Set') === 0 || strcasecmp($name, 'Base Game') === 0;
  $groups[] = [
    'id' => $groupId,
    'name' => $isBase ? 'Base Game' : ($name !== '' ? $name : 'DLC ' . $groupId),
    'kind' => $isBase ? 'base' : 'dlc',
    'detail' => (string)$group['detail'],
    'iconUrl' => (string)($group['icon_url'] ?: $game['icon_url']),
    'counts' => $counts,
    'trophies' => $trophies
  ];
}

echo json_encode([
  'ok' => true,
  'game' => [
    'npwr' => (string)$game['npwr'],
    'title' => (string)$game['title_name'],
    'platform' => (string)$game['title_platform'],
    'iconUrl' => (string)$game['icon_url'],
    'counts' => $totalCounts,
    'groups' => $groups
  ]
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
