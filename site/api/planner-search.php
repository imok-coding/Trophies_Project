<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/search.php';

header('Content-Type: application/json; charset=utf-8');

$q = trim((string)($_GET['q'] ?? ''));
$limit = max(1, min(50, (int)($_GET['limit'] ?? 25)));

if ($q === '') {
  echo json_encode(['ok' => true, 'results' => []]);
  exit;
}

$db = db_connect();
$like = '%' . $q . '%';
$normalizedLike = '%' . normalize_search_term($q) . '%';
$normalizedTitle = normalized_title_sql('g.title_name');
$normalizedNpwr = normalized_title_sql('g.npwr');
$stmt = $db->prepare("
  SELECT
    g.npwr,
    g.title_name,
    g.title_platform,
    g.icon_url,
    COUNT(t.trophy_id) AS trophy_count,
    SUM(t.trophy_type='platinum') AS platinum,
    SUM(t.trophy_type='gold') AS gold,
    SUM(t.trophy_type='silver') AS silver,
    SUM(t.trophy_type='bronze') AS bronze
  FROM games g
  LEFT JOIN trophies t ON t.npwr = g.npwr
  WHERE g.title_name LIKE ?
    OR g.npwr LIKE ?
    OR $normalizedTitle LIKE ?
    OR $normalizedNpwr LIKE ?
  GROUP BY g.npwr, g.title_name, g.title_platform, g.icon_url
  ORDER BY g.title_name
  LIMIT ?
");
$stmt->bind_param('ssssi', $like, $like, $normalizedLike, $normalizedLike, $limit);
$stmt->execute();
$res = $stmt->get_result();

$results = [];
while ($row = $res->fetch_assoc()) {
  $results[] = [
    'npwr' => $row['npwr'],
    'title' => $row['title_name'],
    'platform' => $row['title_platform'],
    'iconUrl' => $row['icon_url'],
    'counts' => [
      'platinum' => (int)$row['platinum'],
      'gold' => (int)$row['gold'],
      'silver' => (int)$row['silver'],
      'bronze' => (int)$row['bronze'],
      'total' => (int)$row['trophy_count']
    ]
  ];
}

echo json_encode(['ok' => true, 'results' => $results]);
