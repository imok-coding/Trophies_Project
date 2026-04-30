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
  <div class="ios-panel overflow-hidden p-5 sm:p-6">
    <div class="flex items-start gap-4">
      <div class="grid h-16 w-16 flex-shrink-0 place-items-center rounded-lg bg-[#007aff] text-3xl font-semibold text-white shadow-[0_18px_36px_rgba(0,122,255,0.25)]">T</div>
      <div class="min-w-0">
        <div class="text-[13px] font-semibold uppercase tracking-wide text-[#007aff]">Live trophy index</div>
        <h1 class="mt-1 text-3xl font-semibold tracking-tight text-[#111827] sm:text-4xl">Trophy Project</h1>
        <p class="mt-2 max-w-2xl text-[15px] leading-6 ios-muted">
          A searchable PlayStation NPWR trophy library, refreshed by automated shard scans.
        </p>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div class="ios-panel p-4">
      <div class="text-xs font-semibold uppercase tracking-wide ios-muted">Games</div>
      <div class="mt-2 text-3xl font-semibold tracking-tight"><?= number_format($gamesCount) ?></div>
    </div>
    <div class="ios-panel p-4">
      <div class="text-xs font-semibold uppercase tracking-wide ios-muted">Trophies</div>
      <div class="mt-2 text-3xl font-semibold tracking-tight"><?= number_format($trophiesCount) ?></div>
    </div>
  </div>
</section>

<section>
  <div class="mb-3 flex items-end justify-between px-1">
    <h2 class="text-[13px] font-semibold uppercase tracking-wide ios-muted">Recently scanned</h2>
    <span class="text-xs ios-muted">Latest updates</span>
  </div>

  <div class="space-y-2">
  <?php while ($row = $res->fetch_assoc()): ?>
    <a href="/pages/game.php?npwr=<?= urlencode($row["npwr"]) ?>" class="ios-cell flex items-center gap-3 p-3 transition hover:-translate-y-0.5 hover:bg-white">
      <div class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-[#e5e7eb]">
        <?php if (!empty($row["icon_url"])): ?>
          <img src="<?= htmlspecialchars($row["icon_url"]) ?>" class="h-full w-full object-cover" alt="" loading="lazy" />
        <?php endif; ?>
      </div>

      <div class="min-w-0 flex-1">
        <div class="truncate text-[15px] font-semibold text-[#111827]"><?= htmlspecialchars($row["title_name"]) ?></div>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-xs ios-muted">
          <span class="rounded-full bg-[#eef2ff] px-2 py-0.5 font-mono text-[11px] text-[#3151a3]"><?= htmlspecialchars($row["npwr"]) ?></span>
          <span><?= htmlspecialchars($row["title_platform"]) ?></span>
        </div>
      </div>

      <div class="hidden text-right text-xs ios-muted sm:block">
        <div>Updated</div>
        <div><?= htmlspecialchars($row["last_seen_utc"]) ?> UTC</div>
      </div>
      <div class="text-xl ios-muted">›</div>
    </a>
  <?php endwhile; ?>
  </div>
</section>
<?php render_footer(); ?>
