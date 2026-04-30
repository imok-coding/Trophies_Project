<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/layout.php';

$q = trim($_GET["q"] ?? "");
$db = db_connect();

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
    $stmt = $db->prepare("SELECT npwr, title_name, title_platform, icon_url
                          FROM games
                          WHERE title_name LIKE ? OR npwr LIKE ?
                          ORDER BY last_seen_utc DESC LIMIT 100");
    $stmt->bind_param("ss", $like, $like);
    $stmt->execute();
    $res = $stmt->get_result();
  ?>
  <div class="mb-3 px-1 text-[13px] font-semibold uppercase tracking-wide app-faint">
    Results for "<?= htmlspecialchars($q) ?>"
  </div>

  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
  <?php while ($row = $res->fetch_assoc()): ?>
    <a href="/pages/game.php?npwr=<?= urlencode($row["npwr"]) ?>" class="app-cell flex gap-3 p-3 transition hover:-translate-y-0.5">
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
      </div>
    </a>
  <?php endwhile; ?>
  </div>
<?php endif; ?>

<?php render_footer(); ?>
