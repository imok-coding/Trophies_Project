<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/layout.php';

$q = trim($_GET["q"] ?? "");
$db = db_connect();

render_header("Search");
?>
<h1 class="text-2xl font-semibold mb-4">Search</h1>

<?php if ($q === ""): ?>
  <div class="text-zinc-400">Type something in the search box.</div>
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
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  <?php while ($row = $res->fetch_assoc()): ?>
    <a href="/pages/game.php?npwr=<?= urlencode($row["npwr"]) ?>"
      class="rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 transition p-4 flex gap-3">
      <div class="w-14 h-14 rounded-xl bg-zinc-800 overflow-hidden flex-shrink-0">
        <?php if (!empty($row["icon_url"])): ?>
          <img src="<?= htmlspecialchars($row["icon_url"]) ?>" class="w-full h-full object-cover" />
        <?php endif; ?>
      </div>
      <div class="min-w-0">
        <div class="font-medium truncate"><?= htmlspecialchars($row["title_name"]) ?></div>
        <div class="text-xs text-zinc-400 mt-1"><?= htmlspecialchars($row["npwr"]) ?> • <?= htmlspecialchars($row["title_platform"]) ?></div>
      </div>
    </a>
  <?php endwhile; ?>
  </div>
<?php endif; ?>

<?php render_footer(); ?>