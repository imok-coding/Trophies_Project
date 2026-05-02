<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/search.php';
require_once __DIR__ . '/../includes/regions.php';
require_once __DIR__ . '/../includes/trophy_counts.php';

if (parse_url($_SERVER["REQUEST_URI"] ?? "", PHP_URL_PATH) === "/pages/search.php") {
  $query = $_SERVER["QUERY_STRING"] ?? "";
  header("Location: /search" . ($query !== "" ? "?" . $query : ""), true, 301);
  exit;
}

$q = trim($_GET["q"] ?? "");
$db = db_connect();
$results = [];
$regionBadges = [];
$trophyCounts = [];

render_header("Search");
?>
<section class="mb-4 px-1">
  <h1 class="text-3xl font-semibold tracking-tight text-white">Search</h1>
  <p class="mt-1 text-[15px] app-muted">Find games by title or NPWR ID.</p>
</section>

<?php if ($q === ""): ?>
  <div class="app-panel p-5 text-[15px] app-muted">Type a game title or NPWR ID in the search field.</div>
<?php else: ?>
  <?php
    $like = "%" . $q . "%";
    $normalizedLike = "%" . normalize_search_term($q) . "%";
    $normalizedTitle = normalized_title_sql("title_name");
    $normalizedNpwr = normalized_title_sql("npwr");
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
        OR " . normalized_title_sql("g.title_name") . " LIKE ?
        OR " . normalized_title_sql("g.npwr") . " LIKE ?
      GROUP BY g.npwr, g.title_name, g.title_platform, g.icon_url
      ORDER BY g.title_name
      LIMIT 100
    ");
    $stmt->bind_param("ssss", $like, $like, $normalizedLike, $normalizedLike);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
      $results[] = $row;
    }
    $regionBadges = region_badges_for_npwrs($db, array_column($results, "npwr"));
    foreach ($results as $row) {
      $trophyCounts[$row["npwr"]] = trophy_count_from_row($row);
    }
  ?>
  <div class="mb-3 px-1 text-[13px] font-semibold uppercase tracking-wide app-faint">
    Results for "<?= htmlspecialchars($q) ?>"
  </div>

  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
  <?php foreach ($results as $row): ?>
    <a href="/game?npwr=<?= urlencode($row["npwr"]) ?>" class="app-cell flex gap-3 p-3 transition hover:-translate-y-0.5">
      <div class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-slate-800">
        <?php if (!empty($row["icon_url"])): ?>
          <img src="<?= htmlspecialchars($row["icon_url"]) ?>" class="h-full w-full object-cover" alt="" loading="lazy" />
        <?php endif; ?>
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-[15px] font-semibold text-white"><?= htmlspecialchars($row["title_name"]) ?></div>
        <div class="mt-1 text-xs app-muted">
          <?= htmlspecialchars($row["npwr"]) ?> &middot; <?= htmlspecialchars($row["title_platform"]) ?>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs app-muted">
          <?php render_region_badges($regionBadges[$row["npwr"]] ?? []); ?>
          <span><?= number_format((int)($trophyCounts[$row["npwr"]]["total"] ?? 0)) ?> trophies</span>
          <span class="font-semibold text-cyan-100"><?= trophy_count_html($trophyCounts[$row["npwr"]] ?? []) ?></span>
        </div>
      </div>
    </a>
  <?php endforeach; ?>
  </div>
<?php endif; ?>

<?php render_footer(); ?>
