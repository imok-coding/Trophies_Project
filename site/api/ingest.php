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

  $db->query("
    CREATE TABLE IF NOT EXISTS game_store_links (
      npwr VARCHAR(16) NOT NULL,
      source_type VARCHAR(16) NOT NULL,
      source_id VARCHAR(128) NOT NULL,
      title VARCHAR(255) NULL,
      checked_utc DATETIME NOT NULL,
      PRIMARY KEY (npwr, source_type, source_id),
      INDEX idx_game_store_links_source (source_type, source_id),
      INDEX idx_game_store_links_npwr (npwr)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ");

  $db->query("
    CREATE TABLE IF NOT EXISTS game_region_evidence (
      npwr VARCHAR(16) NOT NULL,
      region_badge ENUM('NA','EU','JP','CN') NOT NULL,
      source_type VARCHAR(32) NOT NULL,
      source_id VARCHAR(128) NOT NULL,
      title_id VARCHAR(32) NULL,
      product_id VARCHAR(64) NULL,
      confidence TINYINT UNSIGNED NOT NULL DEFAULT 0,
      evidence_json TEXT NULL,
      checked_utc DATETIME NOT NULL,
      PRIMARY KEY (npwr, source_type, source_id),
      INDEX idx_game_region_evidence_npwr (npwr),
      INDEX idx_game_region_evidence_badge (region_badge, confidence)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ");

  $db->query("
    CREATE TABLE IF NOT EXISTS game_regions (
      npwr VARCHAR(16) NOT NULL,
      region_badge ENUM('NA','EU','JP','CN') NOT NULL,
      locale VARCHAR(24) NOT NULL,
      available TINYINT(1) NOT NULL DEFAULT 0,
      title VARCHAR(255) NULL,
      product_ids TEXT NULL,
      error_message VARCHAR(512) NULL,
      checked_utc DATETIME NOT NULL,
      PRIMARY KEY (npwr, region_badge),
      INDEX idx_game_regions_badge (region_badge, available),
      INDEX idx_game_regions_npwr (npwr)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ");

  // Removed/delisted games. The delisted table intentionally allows repeat NPWR entries.
  $stmtExistingGame = $db->prepare("SELECT 1 FROM games WHERE npwr=? LIMIT 1");
  $stmtDelisted = $db->prepare("
    INSERT INTO delisted_npwrs (npwr, reason, removed_utc)
    VALUES (?, ?, UTC_TIMESTAMP())
  ");
  $stmtDeleteGame = $db->prepare("DELETE FROM games WHERE npwr=?");
  $stmtDeleteRegions = $db->prepare("DELETE FROM game_regions WHERE npwr=?");
  $stmtDeleteStoreLinks = $db->prepare("DELETE FROM game_store_links WHERE npwr=?");

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
      $stmtDeleteRegions->bind_param("s", $npwr);
      $stmtDeleteRegions->execute();
      $stmtDeleteStoreLinks->bind_param("s", $npwr);
      $stmtDeleteStoreLinks->execute();
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

  // Exact region evidence. A badge is displayed only when the scanner verifies one region for an NPWR.
  $stmtClearRegions = $db->prepare("DELETE FROM game_regions WHERE npwr=?");
  $stmtClearEvidence = $db->prepare("DELETE FROM game_region_evidence WHERE npwr=?");
  foreach (($data["region_checked"] ?? []) as $npwrToClear) {
    $npwr = (string)$npwrToClear;
    if ($npwr === "") {
      continue;
    }

    $stmtClearRegions->bind_param("s", $npwr);
    $stmtClearRegions->execute();
    $stmtClearEvidence->bind_param("s", $npwr);
    $stmtClearEvidence->execute();
  }

  $stmtEvidence = $db->prepare("
    INSERT INTO game_region_evidence
      (npwr, region_badge, source_type, source_id, title_id, product_id, confidence, evidence_json, checked_utc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
    ON DUPLICATE KEY UPDATE
      region_badge=VALUES(region_badge),
      title_id=VALUES(title_id),
      product_id=VALUES(product_id),
      confidence=VALUES(confidence),
      evidence_json=VALUES(evidence_json),
      checked_utc=UTC_TIMESTAMP()
  ");

  foreach (($data["region_evidence"] ?? []) as $evidence) {
    $npwr = (string)($evidence["npwr"] ?? "");
    $region_badge = (string)($evidence["region_badge"] ?? "");
    if ($npwr === "" || !in_array($region_badge, ["NA", "EU", "JP", "CN"], true)) {
      continue;
    }
    $source_type = substr((string)($evidence["source_type"] ?? ""), 0, 32);
    $source_id = substr((string)($evidence["source_id"] ?? ""), 0, 128);
    $title_id = isset($evidence["title_id"]) ? substr((string)$evidence["title_id"], 0, 32) : null;
    $product_id = isset($evidence["product_id"]) ? substr((string)$evidence["product_id"], 0, 64) : null;
    $confidence = max(0, min(100, (int)($evidence["confidence"] ?? 0)));
    $evidence_json = json_encode($evidence["evidence"] ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($source_type === "" || $source_id === "") {
      continue;
    }

    $stmtEvidence->bind_param("ssssssis", $npwr, $region_badge, $source_type, $source_id, $title_id, $product_id, $confidence, $evidence_json);
    $stmtEvidence->execute();
  }

  $stmtRegion = $db->prepare("
    INSERT INTO game_regions (npwr, region_badge, locale, available, title, product_ids, error_message, checked_utc)
    VALUES (?, ?, ?, ?, ?, ?, NULL, UTC_TIMESTAMP())
    ON DUPLICATE KEY UPDATE
      locale=VALUES(locale),
      available=VALUES(available),
      title=VALUES(title),
      product_ids=VALUES(product_ids),
      error_message=NULL,
      checked_utc=UTC_TIMESTAMP()
  ");

  foreach (($data["regions"] ?? []) as $region) {
    $npwr = (string)($region["npwr"] ?? "");
    $region_badge = (string)($region["region_badge"] ?? "");
    if ($npwr === "" || !in_array($region_badge, ["NA", "EU", "JP", "CN"], true)) {
      continue;
    }
    $locale = (string)($region["locale"] ?? "verified");
    $available = !empty($region["available"]) ? 1 : 0;
    $title = isset($region["title"]) ? (string)$region["title"] : null;
    $product_ids = json_encode(array_values($region["product_ids"] ?? []), JSON_UNESCAPED_SLASHES);

    $stmtRegion->bind_param("sssiss", $npwr, $region_badge, $locale, $available, $title, $product_ids);
    $stmtRegion->execute();
    $results[$npwr] = "updated";
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
