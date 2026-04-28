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
<section class="mb-6 overflow-hidden rounded-lg border border-blue-900/50 bg-[#0a1627] shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
  <div class="bg-[linear-gradient(135deg,#0b2a52_0%,#0a1b31_50%,#081321_100%)] px-5 py-6">
    <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div class="mb-2 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-200">
          Live NPWR Index
        </div>
        <h1 class="text-3xl font-semibold tracking-tight text-white">TrophyScanner</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          A fast, live-scanned PlayStation trophy index built from NPWR title data.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:min-w-[420px]">
        <div class="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div class="text-[11px] font-semibold uppercase tracking-wide text-blue-200">Games Tracked</div>
          <div class="mt-2 text-3xl font-semibold text-white"><?= number_format($gamesCount) ?></div>
        </div>
        <div class="rounded-lg border border-sky-400/30 bg-sky-400/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div class="text-[11px] font-semibold uppercase tracking-wide text-sky-200">Trophies Tracked</div>
          <div class="mt-2 text-3xl font-semibold text-white"><?= number_format($trophiesCount) ?></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="overflow-hidden rounded-lg border border-blue-900/50 bg-[#0a1627] shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
  <div class="flex items-center justify-between border-b border-blue-900/40 bg-[#0d1d33] px-4 py-3">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-100">Latest Scanned Games</h2>
    <span class="text-xs text-slate-500">Recently indexed</span>
  </div>

  <div class="divide-y divide-blue-950/70">
  <?php while ($row = $res->fetch_assoc()): ?>
    <a href="/pages/game.php?npwr=<?= urlencode($row["npwr"]) ?>"
       class="flex items-center gap-3 px-4 py-3 transition hover:bg-blue-950/35">
      <div class="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border border-blue-900/50 bg-[#10233d]">
        <?php if (!empty($row["icon_url"])): ?>
          <img src="<?= htmlspecialchars($row["icon_url"]) ?>" class="h-full w-full object-cover" />
        <?php endif; ?>
      </div>

      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold text-slate-100"><?= htmlspecialchars($row["title_name"]) ?></div>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span class="rounded border border-blue-800/60 bg-blue-950/50 px-1.5 py-0.5 font-mono text-[11px] text-blue-100"><?= htmlspecialchars($row["npwr"]) ?></span>
          <span><?= htmlspecialchars($row["title_platform"]) ?></span>
        </div>
      </div>

      <div class="hidden text-right text-xs text-slate-500 sm:block">
        <div>Last seen</div>
        <div class="mt-1 text-slate-400"><?= htmlspecialchars($row["last_seen_utc"]) ?> UTC</div>
      </div>
    </a>
  <?php endwhile; ?>
  </div>
</section>
<?php render_footer(); ?>
