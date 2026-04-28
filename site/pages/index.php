<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/layout.php';

$db = db_connect();
$gamesCount = (int)$db->query("SELECT COUNT(*) AS total FROM games")->fetch_assoc()["total"];
$trophiesCount = (int)$db->query("SELECT COUNT(*) AS total FROM trophies")->fetch_assoc()["total"];
$res = $db->query("SELECT npwr, title_name, title_platform, icon_url, last_seen_utc
                  FROM games ORDER BY last_seen_utc DESC LIMIT 60");

render_header("TrophyScanner");
?>
<section class="mb-8">
  <div class="flex flex-col gap-6 border-b border-zinc-800 pb-6 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <h1 class="text-3xl font-semibold tracking-tight">TrophyScanner</h1>
      <p class="mt-2 max-w-2xl text-sm text-zinc-400">
        Live PlayStation trophy data indexed from NPWR title scans.
      </p>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:min-w-96">
      <div class="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
        <div class="text-xs font-medium uppercase tracking-wide text-zinc-500">Games Tracked</div>
        <div class="mt-2 text-3xl font-semibold"><?= number_format($gamesCount) ?></div>
      </div>
      <div class="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
        <div class="text-xs font-medium uppercase tracking-wide text-zinc-500">Trophies Tracked</div>
        <div class="mt-2 text-3xl font-semibold"><?= number_format($trophiesCount) ?></div>
      </div>
    </div>
  </div>
</section>

<div class="mb-4 flex items-center justify-between gap-4">
  <h2 class="text-xl font-semibold">Latest scanned games</h2>
</div>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
<?php while ($row = $res->fetch_assoc()): ?>
  <a href="/pages/game.php?npwr=<?= urlencode($row["npwr"]) ?>"
     class="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 flex gap-3 transition hover:border-zinc-700 hover:bg-zinc-900">
    <div class="w-14 h-14 rounded-md bg-zinc-800 overflow-hidden flex-shrink-0">
      <?php if (!empty($row["icon_url"])): ?>
        <img src="<?= htmlspecialchars($row["icon_url"]) ?>" class="w-full h-full object-cover" />
      <?php endif; ?>
    </div>
    <div class="min-w-0">
      <div class="font-medium truncate"><?= htmlspecialchars($row["title_name"]) ?></div>
      <div class="text-xs text-zinc-400 mt-1"><?= htmlspecialchars($row["npwr"]) ?> / <?= htmlspecialchars($row["title_platform"]) ?></div>
      <div class="text-xs text-zinc-500 mt-1">Seen: <?= htmlspecialchars($row["last_seen_utc"]) ?> UTC</div>
    </div>
  </a>
<?php endwhile; ?>
</div>
<?php render_footer(); ?>
