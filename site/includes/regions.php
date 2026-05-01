<?php

function table_exists(mysqli $db, string $table): bool {
  $stmt = $db->prepare("
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = ?
    LIMIT 1
  ");
  $stmt->bind_param("s", $table);
  $stmt->execute();
  return $stmt->get_result()->num_rows > 0;
}

function region_badges_for_npwrs(mysqli $db, array $npwrs): array {
  $npwrs = array_values(array_unique(array_filter(array_map('strval', $npwrs))));
  if (count($npwrs) === 0 || !table_exists($db, "game_regions")) {
    return [];
  }

  $placeholders = implode(",", array_fill(0, count($npwrs), "?"));
  $types = str_repeat("s", count($npwrs));
  $stmt = $db->prepare("
    SELECT npwr, region_badge
    FROM game_regions
    WHERE available = 1
      AND npwr IN ($placeholders)
    ORDER BY FIELD(region_badge, 'NA', 'EU', 'JP', 'CN')
  ");
  $stmt->bind_param($types, ...$npwrs);
  $stmt->execute();

  $badges = [];
  $result = $stmt->get_result();
  while ($row = $result->fetch_assoc()) {
    $npwr = (string)$row["npwr"];
    $badge = (string)$row["region_badge"];
    $badges[$npwr] ??= [];
    if (!in_array($badge, $badges[$npwr], true)) {
      $badges[$npwr][] = $badge;
    }
  }

  foreach ($badges as $npwr => $values) {
    if (count($values) !== 1) {
      $badges[$npwr] = [];
    }
  }

  return $badges;
}

function render_region_badges(array $badges): void {
  foreach ($badges as $badge) {
    echo '<span class="rounded border border-cyan-200/20 bg-cyan-300/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-100">';
    echo htmlspecialchars((string)$badge);
    echo '</span>';
  }
}
