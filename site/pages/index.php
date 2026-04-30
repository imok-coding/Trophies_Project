<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/layout.php';

$db = db_connect();
$gamesCount = (int)$db->query("SELECT COUNT(*) AS total FROM games")->fetch_assoc()["total"];
$trophiesCount = (int)$db->query("SELECT COUNT(*) AS total FROM trophies")->fetch_assoc()["total"];
$res = $db->query("SELECT npwr, title_name, title_platform, icon_url, last_seen_utc
                  FROM games ORDER BY last_seen_utc DESC LIMIT 60");

render_header("Trophy Project");
?>
<section class="mb-5 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
  <div class="app-panel overflow-hidden p-5 sm:p-6">
    <div class="flex items-start gap-4">
      <div class="grid h-16 w-16 flex-shrink-0 place-items-center rounded-lg bg-cyan-400 text-3xl font-black text-slate-950 shadow-[0_0_42px_rgba(34,211,238,0.24)]">T</div>
      <div class="min-w-0">
        <div class="text-[13px] font-semibold uppercase tracking-wide text-cyan-300">Live trophy index</div>
        <h1 class="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Trophy Project</h1>
        <p class="mt-2 max-w-2xl text-[15px] leading-6 app-muted">
          A searchable PlayStation NPWR trophy library, refreshed by automated shard scans.
        </p>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div class="app-panel p-4">
      <div class="text-xs font-semibold uppercase tracking-wide app-faint">Games</div>
      <div class="mt-2 text-3xl font-semibold tracking-tight text-white"><?= number_format($gamesCount) ?></div>
    </div>
    <div class="app-panel p-4">
      <div class="text-xs font-semibold uppercase tracking-wide app-faint">Trophies</div>
      <div class="mt-2 text-3xl font-semibold tracking-tight text-white"><?= number_format($trophiesCount) ?></div>
    </div>
  </div>
</section>

<section>
  <div class="mb-3 flex items-end justify-between px-1">
    <h2 class="text-[13px] font-semibold uppercase tracking-wide app-faint">Recently scanned</h2>
    <span class="text-xs app-faint">Latest updates</span>
  </div>

  <div class="space-y-2">
  <?php while ($row = $res->fetch_assoc()): ?>
    <a href="/pages/game.php?npwr=<?= urlencode($row["npwr"]) ?>" class="app-cell flex items-center gap-3 p-3 transition hover:-translate-y-0.5">
      <div class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-slate-800">
        <?php if (!empty($row["icon_url"])): ?>
          <img src="<?= htmlspecialchars($row["icon_url"]) ?>" class="h-full w-full object-cover" alt="" loading="lazy" />
        <?php endif; ?>
      </div>

      <div class="min-w-0 flex-1">
        <div class="truncate text-[15px] font-semibold text-white"><?= htmlspecialchars($row["title_name"]) ?></div>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-xs app-muted">
          <span class="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 font-mono text-[11px] text-cyan-100"><?= htmlspecialchars($row["npwr"]) ?></span>
          <span><?= htmlspecialchars($row["title_platform"]) ?></span>
        </div>
      </div>

      <div class="hidden text-right text-xs app-faint sm:block">
        <div>Updated</div>
        <div><?= htmlspecialchars($row["last_seen_utc"]) ?> UTC</div>
      </div>
      <div class="text-xl app-faint">&rsaquo;</div>
    </a>
  <?php endwhile; ?>
  </div>
</section>
<?php render_footer(); ?>
