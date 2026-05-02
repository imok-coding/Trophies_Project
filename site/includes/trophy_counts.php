<?php

function trophy_counts_for_npwrs(mysqli $db, array $npwrs): array {
  $npwrs = array_values(array_unique(array_filter(array_map('strval', $npwrs))));
  if (count($npwrs) === 0) {
    return [];
  }

  $placeholders = implode(",", array_fill(0, count($npwrs), "?"));
  $types = str_repeat("s", count($npwrs));
  $stmt = $db->prepare("
    SELECT
      npwr,
      SUM(trophy_type='platinum') AS platinum,
      SUM(trophy_type='gold') AS gold,
      SUM(trophy_type='silver') AS silver,
      SUM(trophy_type='bronze') AS bronze,
      COUNT(trophy_id) AS total
    FROM trophies
    WHERE npwr IN ($placeholders)
    GROUP BY npwr
  ");
  $stmt->bind_param($types, ...$npwrs);
  $stmt->execute();

  $counts = [];
  $res = $stmt->get_result();
  while ($row = $res->fetch_assoc()) {
    $counts[(string)$row["npwr"]] = [
      "platinum" => (int)($row["platinum"] ?? 0),
      "gold" => (int)($row["gold"] ?? 0),
      "silver" => (int)($row["silver"] ?? 0),
      "bronze" => (int)($row["bronze"] ?? 0),
      "total" => (int)($row["total"] ?? 0)
    ];
  }

  return $counts;
}

function trophy_count_text(array $counts): string {
  return number_format((int)($counts["platinum"] ?? 0)) . "P "
    . number_format((int)($counts["gold"] ?? 0)) . "G "
    . number_format((int)($counts["silver"] ?? 0)) . "S "
    . number_format((int)($counts["bronze"] ?? 0)) . "B";
}

function trophy_count_from_row(array $row): array {
  return [
    "platinum" => (int)($row["platinum"] ?? 0),
    "gold" => (int)($row["gold"] ?? 0),
    "silver" => (int)($row["silver"] ?? 0),
    "bronze" => (int)($row["bronze"] ?? 0),
    "total" => (int)($row["trophy_count"] ?? $row["total"] ?? 0)
  ];
}
