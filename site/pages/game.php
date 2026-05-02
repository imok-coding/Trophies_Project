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
  return $groupName !== "" ? $groupName : "Trophy Group";
}
?>

<?php while ($g = $gr->fetch_assoc()): ?>
  <section class="mb-5">
    <div class="mb-2 flex items-end justify-between px-1">
      <h2 class="min-w-0 truncate text-[13px] font-semibold uppercase tracking-wide app-faint">
        <?= htmlspecialchars($g["group_id"]) ?> &middot; <?= htmlspecialchars(trophy_group_label($g)) ?>
      </h2>
      <?php if ($g["defined_total"] !== null): ?>
        <span class="text-xs app-faint"><?= (int)$g["defined_total"] ?> trophies</span>
      <?php endif; ?>
    </div>

    <?php
      $t = $db->prepare("SELECT trophy_id, trophy_name, trophy_type, hidden, icon_url
                        FROM trophies WHERE npwr=? AND group_id=? ORDER BY trophy_id");
      $t->bind_param("ss", $npwr, $g["group_id"]);
      $t->execute();
      $tr = $t->get_result();
    ?>

    <div class="space-y-2">
    <?php while ($row = $tr->fetch_assoc()): ?>
      <div class="app-cell flex items-center gap-3 p-3">
        <div class="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-slate-800">
          <?php if (!empty($row["icon_url"])): ?>
            <img src="<?= htmlspecialchars($row["icon_url"]) ?>" class="h-full w-full object-cover" alt="" loading="lazy" />
          <?php endif; ?>
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-[15px] font-semibold text-white"><?= htmlspecialchars($row["trophy_name"]) ?></div>
          <div class="mt-0.5 text-xs app-muted">
            #<?= (int)$row["trophy_id"] ?> &middot; <?= htmlspecialchars($row["trophy_type"]) ?>
            <?= ((int)$row["hidden"] === 1) ? " &middot; Hidden" : "" ?>
          </div>
        </div>
      </div>
    <?php endwhile; ?>
    </div>
  </section>
<?php endwhile; ?>

<?php render_footer(); ?>
