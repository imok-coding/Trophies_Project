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
<section class="mb-6 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
  <div class="border-b border-zinc-800 bg-gradient-to-r from-blue-950 via-zinc-900 to-zinc-900 px-5 py-5">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-white">TrophyScanner</h1>
        <p class="mt-1 text-sm text-zinc-300">PlayStation trophy sets indexed by NPWR scans.</p>
      </div>
      <div class="grid grid-cols-2 gap-3 sm:min-w-96">
        <div class="rounded-md border border-blue-800/70 bg-blue-950/60 px-4 py-3">
          <div class="text-[11px] font-semibold uppercase tracking-wide text-blue-200">Games Tracked</div>
          <div class="mt-1 text-2xl font-semibold text-white"><?= number_format($gamesCount) ?></div>
        </div>
        <div class="rounded-md border border-cyan-800/70 bg-cyan-950/40 px-4 py-3">
          <div class="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">Trophies Tracked</div>
          <div class="mt-1 text-2xl font-semibold text-white"><?= number_format($trophiesCount) ?></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
  <div class="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-200">Latest Scanned Games</h2>
    <span class="text-xs text-zinc-500">Recently indexed</span>
  </div>

  <div class="divide-y divide-zinc-800">
  <?php while ($row = $res->fetch_assoc()): ?>
    <a href="/pages/game.php?npwr=<?= urlencode($row["npwr"]) ?>"
       class="flex items-center gap-3 px-4 py-3 transition hover:bg-zinc-800/70">
      <div class="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border border-zinc-700 bg-zinc-800">
        <?php if (!empty($row["icon_url"])): ?>
          <img src="<?= htmlspecialchars($row["icon_url"]) ?>" class="h-full w-full object-cover" />
        <?php endif; ?>
      </div>

      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold text-zinc-100"><?= htmlspecialchars($row["title_name"]) ?></div>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300"><?= htmlspecialchars($row["npwr"]) ?></span>
          <span><?= htmlspecialchars($row["title_platform"]) ?></span>
        </div>
      </div>

      <div class="hidden text-right text-xs text-zinc-500 sm:block">
        <div>Last seen</div>
        <div class="mt-1 text-zinc-400"><?= htmlspecialchars($row["last_seen_utc"]) ?> UTC</div>
      </div>
    </a>
  <?php endwhile; ?>
  </div>
</section>
<?php render_footer(); ?>
