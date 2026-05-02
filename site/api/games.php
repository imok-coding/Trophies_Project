<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/search.php';

header('Content-Type: application/json; charset=utf-8');

function game_primary_platform(string $platforms): string {
  $tokens = preg_split('/[,\s\/]+/', strtoupper($platforms)) ?: [];
  $tokens = array_values(array_filter(array_map('trim', $tokens)));
  $precedence = ['PS5', 'PS4', 'PS3', 'PSVITA', 'VITA', 'PC'];

  foreach ($precedence as $platform) {
    if (in_array($platform, $tokens, true)) {
      return $platform === 'VITA' ? 'PSVITA' : $platform;
    }
  }

  return $tokens[0] ?? '';
}

function bind_if_needed(mysqli_stmt $stmt, string $types, array $values): void {
  if ($types !== '') {
    $stmt->bind_param($types, ...$values);
  }
}

$q = trim((string)($_GET['q'] ?? ''));
$page = max(1, (int)($_GET['page'] ?? 1));
$limit = 100;
$offset = ($page - 1) * $limit;
$db = db_connect();

$countWhere = '';
$dataWhere = '';
$types = '';
$values = [];
if ($q !== '') {
  $like = '%' . $q . '%';
  $normalizedLike = '%' . normalize_search_term($q) . '%';
  $normalizedTitle = normalized_title_sql('title_name');
  $normalizedNpwr = normalized_title_sql('npwr');
  $countWhere = "WHERE title_name LIKE ? OR npwr LIKE ? OR $normalizedTitle LIKE ? OR $normalizedNpwr LIKE ?";
  $dataWhere = "WHERE g.title_name LIKE ? OR g.npwr LIKE ? OR " . normalized_title_sql('g.title_name') . " LIKE ? OR " . normalized_title_sql('g.npwr') . " LIKE ?";
  $types = 'ssss';
  $values = [$like, $like, $normalizedLike, $normalizedLike];
}

$countStmt = $db->prepare("SELECT COUNT(*) AS total FROM games $countWhere");
bind_if_needed($countStmt, $types, $values);
$countStmt->execute();
$total = (int)$countStmt->get_result()->fetch_assoc()['total'];
$totalPages = max(1, (int)ceil($total / $limit));
if ($page > $totalPages) {
  $page = $totalPages;
  $offset = ($page - 1) * $limit;
}

$order = 'g.title_name ASC, g.npwr ASC';
if ($q !== '') {
  $normalizedTitle = normalized_title_sql('g.title_name');
  $normalizedNpwr = normalized_title_sql('g.npwr');
  $order = "
    CASE
      WHEN g.npwr = ? THEN 0
      WHEN g.title_name = ? THEN 1
      WHEN g.npwr LIKE ? THEN 2
      WHEN g.title_name LIKE ? THEN 3
      WHEN $normalizedNpwr LIKE ? THEN 4
      WHEN $normalizedTitle LIKE ? THEN 5
      ELSE 6
    END,
    g.title_name ASC,
    g.npwr ASC
  ";
}

$dataTypes = '';
$dataValues = [];
if ($q !== '') {
  $prefixLike = $q . '%';
  $normalizedPrefixLike = normalize_search_term($q) . '%';
  $dataTypes .= $types . 'ssssss';
  $dataValues = array_merge($values, [$q, $q, $prefixLike, $prefixLike, $normalizedPrefixLike, $normalizedPrefixLike]);
} else {
  $dataTypes .= $types;
  $dataValues = $values;
}
$dataTypes .= 'ii';
$dataValues = array_merge($dataValues, [$limit, $offset]);

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
  $dataWhere
  GROUP BY g.npwr, g.title_name, g.title_platform, g.icon_url
  ORDER BY $order
  LIMIT ? OFFSET ?
");
bind_if_needed($stmt, $dataTypes, $dataValues);
$stmt->execute();
$res = $stmt->get_result();

$games = [];
while ($row = $res->fetch_assoc()) {
  $games[] = [
    'npwr' => (string)$row['npwr'],
    'title' => (string)$row['title_name'],
    'platform' => game_primary_platform((string)$row['title_platform']) ?: (string)$row['title_platform'],
    'platformRaw' => (string)$row['title_platform'],
    'iconUrl' => (string)$row['icon_url'],
    'counts' => [
      'platinum' => (int)$row['platinum'],
      'gold' => (int)$row['gold'],
      'silver' => (int)$row['silver'],
      'bronze' => (int)$row['bronze'],
      'total' => (int)$row['trophy_count']
    ]
  ];
}

echo json_encode([
  'ok' => true,
  'page' => $page,
  'perPage' => $limit,
  'total' => $total,
  'totalPages' => $totalPages,
  'games' => $games
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
