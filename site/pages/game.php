<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/regions.php';
require_once __DIR__ . '/../includes/trophy_counts.php';

if (parse_url($_SERVER["REQUEST_URI"] ?? "", PHP_URL_PATH) === "/pages/game.php") {
  $query = $_SERVER["QUERY_STRING"] ?? "";
  header("Location: /game" . ($query !== "" ? "?" . $query : ""), true, 301);
  exit;
}

$npwr = $_GET["npwr"] ?? "";
$db = db_connect();

$stmt = $db->prepare("SELECT * FROM games WHERE npwr=?");
$stmt->bind_param("s", $npwr);
$stmt->execute();
$game = $stmt->get_result()->fetch_assoc();
if (!$game) { http_response_code(404); exit("Not found"); }
$regionBadges = region_badges_for_npwrs($db, [$npwr]);
$trophyCounts = trophy_counts_for_npwrs($db, [$npwr]);
$gameCounts = $trophyCounts[$npwr] ?? ["platinum" => 0, "gold" => 0, "silver" => 0, "bronze" => 0, "total" => 0];

render_header($game["title_name"]);
?>
<section class="app-panel mb-5 overflow-hidden p-5">
  <div class="flex items-start gap-4">
    <div class="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-slate-800 shadow-sm">
      <?php if (!empty($game["icon_url"])): ?>
        <img src="<?= htmlspecialchars($game["icon_url"]) ?>" class="h-full w-full object-cover" alt="" />
      <?php endif; ?>
    </div>
    <div class="min-w-0 flex-1">
      <div class="mb-2 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 font-mono text-xs font-semibold text-cyan-100">
        <?= htmlspecialchars($game["npwr"]) ?>
      </div>
      <h1 class="text-2xl font-semibold tracking-tight text-white sm:text-3xl"><?= htmlspecialchars($game["title_name"]) ?></h1>
      <div class="mt-1 flex flex-wrap items-center gap-2 text-[15px] app-muted">
        <span><?= htmlspecialchars($game["title_platform"]) ?></span>
        <?php render_region_badges($regionBadges[$npwr] ?? []); ?>
        <span><?= number_format((int)$gameCounts["total"]) ?> trophies</span>
        <span class="font-semibold text-cyan-100"><?= trophy_count_html($gameCounts) ?></span>
      </div>

      <?php if (!empty($game["igdb_name"])): ?>
        <div class="mt-3 text-sm app-muted">
          IGDB: <?= htmlspecialchars($game["igdb_name"]) ?>
          <?php if (!empty($game["first_release"])): ?>
            &middot; Release: <?= htmlspecialchars($game["first_release"]) ?>
          <?php endif; ?>
        </div>
      <?php endif; ?>
    </div>
  </div>
</section>

<?php
$groups = $db->prepare("
  SELECT *
  FROM trophy_groups
  WHERE npwr=?
  ORDER BY
    CASE
      WHEN LOWER(group_id) = 'default' OR LOWER(group_name) IN ('default trophy set', 'base game') THEN 0
      ELSE 1
    END,
    group_id
");
$groups->bind_param("s", $npwr);
$groups->execute();
$gr = $groups->get_result();

function trophy_group_label(array $group): string {
  $groupId = strtolower((string)$group["group_id"]);
  $groupName = trim((string)($group["group_name"] ?? ""));
  if ($groupId === "default" || strcasecmp($groupName, "Default Trophy Set") === 0) {
    return "Base Game";
  }
  return $groupName !== "" ? $groupName : "DLC " . (string)$group["group_id"];
}

function trophy_group_kind(array $group): string {
  $groupId = strtolower((string)$group["group_id"]);
  $groupName = trim((string)($group["group_name"] ?? ""));
  return ($groupId === "default" || strcasecmp($groupName, "Default Trophy Set") === 0 || strcasecmp($groupName, "Base Game") === 0)
    ? "Base Game"
    : "DLC";
}

function local_trophy_icon(string $type): string {
  $icons = [
    "platinum" => ["470bd2.png", "P"],
    "gold" => ["7186c5.png", "G"],
    "silver" => ["f179ed.png", "S"],
    "bronze" => ["e61e35.png", "B"],
  ];
  $key = strtolower($type);
  $icon = $icons[$key] ?? $icons["bronze"];
  return '<img src="/assets/trophy/' . htmlspecialchars($icon[0]) . '" alt="' . htmlspecialchars($icon[1]) . '" class="inline-block h-6 w-6 align-[-5px]" loading="lazy" />';
}

function trophy_breakdown_html(array $counts): string {
  return '<span class="inline-flex items-center gap-1 font-semibold text-white">' . number_format((int)($counts["platinum"] ?? 0)) . local_trophy_icon("platinum") . '</span>'
    . '<span class="inline-flex items-center gap-1 font-semibold text-white">' . number_format((int)($counts["gold"] ?? 0)) . local_trophy_icon("gold") . '</span>'
    . '<span class="inline-flex items-center gap-1 font-semibold text-white">' . number_format((int)($counts["silver"] ?? 0)) . local_trophy_icon("silver") . '</span>'
    . '<span class="inline-flex items-center gap-1 font-semibold text-white">' . number_format((int)($counts["bronze"] ?? 0)) . local_trophy_icon("bronze") . '</span>';
}
?>

<?php $dlcPackNumber = 0; ?>
<?php while ($g = $gr->fetch_assoc()): ?>
  <?php
    $t = $db->prepare("
      SELECT trophy_id, trophy_name, trophy_detail, trophy_type, hidden, icon_url
      FROM trophies
      WHERE npwr=? AND group_id=?
      ORDER BY trophy_id
    ");
    $t->bind_param("ss", $npwr, $g["group_id"]);
    $t->execute();
    $tr = $t->get_result();
    $rows = [];
    $groupCounts = ["platinum" => 0, "gold" => 0, "silver" => 0, "bronze" => 0, "total" => 0];
    while ($row = $tr->fetch_assoc()) {
      $rows[] = $row;
      $type = strtolower((string)$row["trophy_type"]);
      if (isset($groupCounts[$type])) $groupCounts[$type]++;
      $groupCounts["total"]++;
    }
    $groupIcon = !empty($g["icon_url"]) ? $g["icon_url"] : $game["icon_url"];
    $groupKind = trophy_group_kind($g);
    if ($groupKind === "DLC") $dlcPackNumber++;
  ?>

  <section class="mb-5 overflow-hidden rounded-lg border border-white/10">
    <?php if ($groupKind === "DLC"): ?>
      <div class="bg-[#35699f] px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">
        DLC Trophy Pack <?= number_format($dlcPackNumber) ?>
      </div>
    <?php endif; ?>

    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3">
      <div class="flex min-w-0 items-center gap-3">
        <div class="grid h-14 w-14 flex-shrink-0 place-items-center overflow-hidden rounded bg-slate-950 p-1">
          <?php if (!empty($groupIcon)): ?>
            <img src="<?= htmlspecialchars($groupIcon) ?>" class="max-h-full max-w-full object-contain" alt="" loading="lazy" />
          <?php endif; ?>
        </div>
        <div class="min-w-0">
          <div class="text-[10px] font-bold uppercase tracking-wide <?= $groupKind === "Base Game" ? "text-cyan-100" : "text-violet-100" ?>">
            <?= htmlspecialchars($groupKind) ?>
          </div>
          <h2 class="truncate font-semibold text-white"><?= htmlspecialchars(trophy_group_label($g)) ?></h2>
          <div class="mt-0.5 flex flex-wrap items-center gap-2 text-sm app-muted">
            <span class="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]"><?= htmlspecialchars($g["group_id"]) ?></span>
            <span><?= number_format((int)$groupCounts["total"]) ?> trophies</span>
          </div>
        </div>
      </div>
      <div class="flex flex-wrap gap-3 text-sm app-muted"><?= trophy_breakdown_html($groupCounts) ?></div>
    </div>

    <div>
      <?php foreach ($rows as $row): ?>
        <article class="grid gap-3 border-b border-white/10 p-3 transition hover:bg-white/[0.04] sm:grid-cols-[4rem_1fr_auto] sm:items-center">
          <div class="grid h-14 w-14 place-items-center overflow-hidden rounded-lg bg-slate-950 p-1 ring-1 ring-white/10">
            <?php if (!empty($row["icon_url"])): ?>
              <img src="<?= htmlspecialchars($row["icon_url"]) ?>" class="max-h-full max-w-full object-contain" alt="" loading="lazy" />
            <?php endif; ?>
          </div>
          <div class="min-w-0">
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <span class="truncate text-[15px] font-semibold text-white"><?= htmlspecialchars($row["trophy_name"]) ?></span>
              <?php if ((int)$row["hidden"] === 1): ?>
                <span class="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold uppercase app-muted">Secret</span>
              <?php endif; ?>
            </div>
            <?php if (!empty($row["trophy_detail"])): ?>
              <div class="mt-1 text-sm app-muted"><?= htmlspecialchars($row["trophy_detail"]) ?></div>
            <?php endif; ?>
            <div class="mt-1 text-xs app-faint">#<?= (int)$row["trophy_id"] ?></div>
          </div>
          <div class="flex items-center gap-3 sm:justify-end">
            <?= local_trophy_icon((string)$row["trophy_type"]) ?>
          </div>
        </article>
      <?php endforeach; ?>
    </div>
  </section>
<?php endwhile; ?>

<?php render_footer(); ?>
