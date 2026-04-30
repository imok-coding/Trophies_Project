<?php
require_once __DIR__ . '/../includes/security.php';
require_once __DIR__ . '/../includes/db.php';

$raw = file_get_contents('php://input');
if (!$raw) { http_response_code(400); exit("No body"); }

if (!verify_hmac($raw)) {
  http_response_code(401);
  exit("Bad signature");
}

$data = json_decode($raw, true);
if (!$data) { http_response_code(400); exit("Bad JSON"); }

$db = db_connect();
$db->begin_transaction();

try {
  $results = [];

  // Removed/delisted games. The delisted table intentionally allows repeat NPWR entries.
  $stmtExistingGame = $db->prepare("SELECT 1 FROM games WHERE npwr=? LIMIT 1");
  $stmtDelisted = $db->prepare("
    INSERT INTO delisted_npwrs (npwr, reason, removed_utc)
    VALUES (?, ?, UTC_TIMESTAMP())
  ");
  $stmtDeleteGame = $db->prepare("DELETE FROM games WHERE npwr=?");

  foreach (($data["removed"] ?? []) as $r) {
    $npwr = (string)($r["npwr"] ?? "");
    if ($npwr === "") {
      continue;
    }

    $reason = (string)($r["reason"] ?? "No longer found by PSN trophy lookup");
    $stmtExistingGame->bind_param("s", $npwr);
    $stmtExistingGame->execute();
    $exists = $stmtExistingGame->get_result()->num_rows > 0;

    if ($exists) {
      $stmtDelisted->bind_param("ss", $npwr, $reason);
      $stmtDelisted->execute();

      $stmtDeleteGame->bind_param("s", $npwr);
      $stmtDeleteGame->execute();
      $results[$npwr] = "removed";
    } else {
      $results[$npwr] = "invalid";
    }
  }

  // Games upsert
  $stmtGame = $db->prepare("
    INSERT INTO games (npwr, title_name, title_platform, trophy_set_ver, has_groups, icon_url,
      igdb_id, igdb_name, first_release, first_seen_utc, last_seen_utc, last_scan_utc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())
    ON DUPLICATE KEY UPDATE
      title_name=VALUES(title_name),
      title_platform=VALUES(title_platform),
      trophy_set_ver=VALUES(trophy_set_ver),
      has_groups=VALUES(has_groups),
      icon_url=VALUES(icon_url),
      igdb_id=COALESCE(VALUES(igdb_id), igdb_id),
      igdb_name=COALESCE(VALUES(igdb_name), igdb_name),
      first_release=COALESCE(VALUES(first_release), first_release),
      last_seen_utc=UTC_TIMESTAMP(),
      last_scan_utc=UTC_TIMESTAMP()
  ");

  foreach (($data["games"] ?? []) as $g) {
    $npwr = (string)($g["npwr"] ?? "");
    $title_name = (string)($g["title_name"] ?? "");
    $title_platform = (string)($g["title_platform"] ?? "");
    $trophy_set_ver = (string)($g["trophy_set_ver"] ?? "");
    $has_groups = (int)($g["has_groups"] ?? 0);
    $icon_url = (string)($g["icon_url"] ?? "");
    $igdb_id = isset($g["igdb_id"]) ? (string)$g["igdb_id"] : null;
    $igdb_name = isset($g["igdb_name"]) ? (string)$g["igdb_name"] : null;
    $first_release = isset($g["first_release"]) ? (string)$g["first_release"] : null;

    $stmtExistingGame->bind_param("s", $npwr);
    $stmtExistingGame->execute();
    $exists = $stmtExistingGame->get_result()->num_rows > 0;

    $stmtGame->bind_param(
      "ssssissss",
      $npwr, $title_name, $title_platform, $trophy_set_ver,
      $has_groups, $icon_url,
      $igdb_id, $igdb_name, $first_release
    );
    $stmtGame->execute();
    if ($npwr !== "") {
      $results[$npwr] = $exists ? "updated" : "inserted";
    }
  }

  // Trophy groups upsert
  $stmtGroup = $db->prepare("
    INSERT INTO trophy_groups (npwr, group_id, group_name, detail, icon_url, defined_total)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      group_name=VALUES(group_name),
      detail=VALUES(detail),
      icon_url=VALUES(icon_url),
      defined_total=VALUES(defined_total)
  ");

  foreach (($data["groups"] ?? []) as $gr) {
    $npwr = (string)$gr["npwr"];
    $group_id = (string)$gr["group_id"];
    $group_name = (string)($gr["group_name"] ?? "");
    if (strtolower($group_id) === "default" || strcasecmp($group_name, "Default Trophy Set") === 0) {
      $group_name = "Base Game";
    }
    $detail = (string)($gr["detail"] ?? "");
    $icon_url = (string)($gr["icon_url"] ?? "");
    $defined_total = isset($gr["defined_total"]) ? (int)$gr["defined_total"] : null;

    $stmtGroup->bind_param("sssssi", $npwr, $group_id, $group_name, $detail, $icon_url, $defined_total);
    $stmtGroup->execute();
  }

  // Trophies reference trophy_groups, so make sure any incoming fallback group exists.
  $seenGroups = [];
  foreach (($data["groups"] ?? []) as $gr) {
    $seenGroups[(string)$gr["npwr"] . "\n" . (string)$gr["group_id"]] = true;
  }

  foreach (($data["trophies"] ?? []) as $t) {
    $npwr = (string)($t["npwr"] ?? "");
    $group_id = (string)($t["group_id"] ?? "default");
    $key = $npwr . "\n" . $group_id;
    if ($npwr === "" || isset($seenGroups[$key])) {
      continue;
    }

    $group_name = $group_id === "default" ? "Base Game" : "Trophy Group";
    $detail = "";
    $icon_url = "";
    $defined_total = null;
    $stmtGroup->bind_param("sssssi", $npwr, $group_id, $group_name, $detail, $icon_url, $defined_total);
    $stmtGroup->execute();
    $seenGroups[$key] = true;
  }

  // Trophies upsert
  $stmtTrophy = $db->prepare("
    INSERT INTO trophies (npwr, group_id, trophy_id, trophy_name, trophy_detail, trophy_type, hidden, icon_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      trophy_name=VALUES(trophy_name),
      trophy_detail=VALUES(trophy_detail),
      trophy_type=VALUES(trophy_type),
      hidden=VALUES(hidden),
      icon_url=VALUES(icon_url)
  ");

  foreach (($data["trophies"] ?? []) as $t) {
    $npwr = (string)$t["npwr"];
    $group_id = (string)$t["group_id"];
    $trophy_id = (int)$t["trophy_id"];
    $trophy_name = (string)($t["trophy_name"] ?? "");
    $trophy_detail = (string)($t["trophy_detail"] ?? "");
    $trophy_type = (string)($t["trophy_type"] ?? "bronze");
    $hidden = (int)($t["hidden"] ?? 0);
    $icon_url = (string)($t["icon_url"] ?? "");

    $stmtTrophy->bind_param("ssisssis", $npwr, $group_id, $trophy_id, $trophy_name, $trophy_detail, $trophy_type, $hidden, $icon_url);
    $stmtTrophy->execute();
  }

  // Save shard scan cursor (optional)
  if (isset($data["scan_state"])) {
    $s = $data["scan_state"];
    $stmtState = $db->prepare("
      INSERT INTO scan_state (shard_index, scan_cursor, updated_utc)
      VALUES (?, ?, UTC_TIMESTAMP())
      ON DUPLICATE KEY UPDATE scan_cursor=VALUES(scan_cursor), updated_utc=UTC_TIMESTAMP()
    ");
    $shard_index = (int)$s["shard_index"];
    $cursor = (int)$s["cursor"];
    $stmtState->bind_param("ii", $shard_index, $cursor);
    $stmtState->execute();
  }

  $db->commit();
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['ok' => true, 'results' => $results]);
} catch (Throwable $e) {
  $db->rollback();
  http_response_code(500);
  echo "ERR";
}
