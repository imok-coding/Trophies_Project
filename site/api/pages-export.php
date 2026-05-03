<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/security.php';

header('Content-Type: application/json; charset=utf-8');

$raw = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $raw = file_get_contents('php://input') ?: '';
  if (!verify_hmac($raw)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Bad signature']);
    exit;
  }
} else {
  $secret = $_SERVER['HTTP_X_INGEST_SECRET'] ?? '';
  if (!hash_equals(INGEST_SECRET, $secret)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
  }
}

function export_primary_platform(string $platforms): string {
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

function counts_from_trophies(array $rows): array {
  $counts = ['platinum' => 0, 'gold' => 0, 'silver' => 0, 'bronze' => 0, 'total' => 0];
  foreach ($rows as $row) {
    $type = strtolower((string)($row['trophy_type'] ?? $row['type'] ?? 'bronze'));
    if (isset($counts[$type])) $counts[$type]++;
    $counts['total']++;
  }
  return $counts;
}

$mode = (string)($_GET['mode'] ?? 'index');
$db = db_connect();

if ($mode === 'detail') {
  $npwr = strtoupper(trim((string)($_GET['npwr'] ?? '')));
  if (!preg_match('/^NPWR\d{5}_00$/', $npwr)) {
    echo json_encode(['ok' => false, 'error' => 'Invalid NPWR']);
    exit;
  }

  ob_start();
  $_GET['npwr'] = $npwr;
  require __DIR__ . '/game-detail.php';
  $body = ob_get_clean();
  echo $body;
  exit;
}

$stmt = $db->query("
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
  GROUP BY g.npwr, g.title_name, g.title_platform, g.icon_url
  ORDER BY g.title_name ASC, g.npwr ASC
");

$games = [];
while ($row = $stmt->fetch_assoc()) {
  $games[] = [
    'npwr' => (string)$row['npwr'],
    'title' => (string)$row['title_name'],
    'platform' => export_primary_platform((string)$row['title_platform']) ?: (string)$row['title_platform'],
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
  'generatedAt' => gmdate('c'),
  'total' => count($games),
  'games' => $games
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
