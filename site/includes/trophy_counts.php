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

function trophy_icon_html(string $type): string {
  $icons = [
    "platinum" => ["file" => "470bd2.png", "alt" => "P"],
    "gold" => ["file" => "7186c5.png", "alt" => "G"],
    "silver" => ["file" => "f179ed.png", "alt" => "S"],
    "bronze" => ["file" => "e61e35.png", "alt" => "B"]
  ];
  $icon = $icons[$type] ?? $icons["bronze"];
  return '<img src="/assets/trophy/' . $icon["file"] . '" alt="' . $icon["alt"] . '" class="inline-block h-3.5 w-3.5 align-[-2px]" loading="lazy" />';
}

function trophy_count_html(array $counts): string {
  return '<span class="inline-flex items-center gap-1">' . number_format((int)($counts["platinum"] ?? 0)) . trophy_icon_html("platinum") . '</span> '
    . '<span class="inline-flex items-center gap-1">' . number_format((int)($counts["gold"] ?? 0)) . trophy_icon_html("gold") . '</span> '
    . '<span class="inline-flex items-center gap-1">' . number_format((int)($counts["silver"] ?? 0)) . trophy_icon_html("silver") . '</span> '
    . '<span class="inline-flex items-center gap-1">' . number_format((int)($counts["bronze"] ?? 0)) . trophy_icon_html("bronze") . '</span>';
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
