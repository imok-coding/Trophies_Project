<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/regions.php';

if (parse_url($_SERVER["REQUEST_URI"] ?? "", PHP_URL_PATH) === "/pages/index.php") {
  header("Location: /", true, 301);
  exit;
}

header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
header("Expires: 0");

function primary_platform(string $platforms): string {
  $tokens = preg_split('/[,\s\/]+/', strtoupper($platforms)) ?: [];
  $tokens = array_values(array_filter(array_map('trim', $tokens)));
  $precedence = ["PS5", "PS4", "PS3", "PSVITA", "VITA", "PC"];

  foreach ($precedence as $platform) {
    if (in_array($platform, $tokens, true)) {
      return $platform === "VITA" ? "PSVITA" : $platform;
    }
  }

  return $tokens[0] ?? "";
}

$db = db_connect();
$gamesCount = (int)$db->query("SELECT COUNT(*) AS total FROM games")->fetch_assoc()["total"];
$trophiesCount = (int)$db->query("SELECT COUNT(*) AS total FROM trophies")->fetch_assoc()["total"];
$groupsCount = (int)$db->query("SELECT COUNT(*) AS total FROM trophy_groups WHERE LOWER(group_id) <> 'default'")->fetch_assoc()["total"];

$recentRes = $db->query("
  SELECT
    g.npwr,
    g.title_name,
    g.title_platform,
    g.icon_url,
    g.first_seen_utc,
    COUNT(t.trophy_id) AS trophy_count,
    SUM(t.trophy_type='platinum') AS platinum,
    SUM(t.trophy_type='gold') AS gold,
    SUM(t.trophy_type='silver') AS silver,
    SUM(t.trophy_type='bronze') AS bronze
  FROM (
    SELECT npwr, title_name, title_platform, icon_url, first_seen_utc
    FROM games
    ORDER BY first_seen_utc DESC
    LIMIT 12
  ) g
  LEFT JOIN trophies t ON t.npwr = g.npwr
  GROUP BY g.npwr, g.title_name, g.title_platform, g.icon_url, g.first_seen_utc
  ORDER BY g.first_seen_utc DESC
");

$recent = [];
while ($row = $recentRes->fetch_assoc()) {
  $recent[] = $row;
}
$recentBadges = region_badges_for_npwrs($db, array_column($recent, "npwr"));

$dlcRes = $db->query("
  SELECT
    tg.npwr,
    tg.group_id,
    tg.group_name,
    tg.icon_url AS group_icon_url,
    tg.defined_total,
    g.title_name,
    g.title_platform,
    g.icon_url AS game_icon_url,
    g.first_seen_utc,
    COUNT(t.trophy_id) AS trophy_count
  FROM trophy_groups tg
  INNER JOIN games g ON g.npwr = tg.npwr
  LEFT JOIN trophies t ON t.npwr = tg.npwr AND t.group_id = tg.group_id
  WHERE LOWER(tg.group_id) <> 'default'
  GROUP BY tg.npwr, tg.group_id, tg.group_name, tg.icon_url, tg.defined_total, g.title_name, g.title_platform, g.icon_url, g.first_seen_utc
  ORDER BY g.first_seen_utc DESC, tg.group_id DESC
  LIMIT 12
");

$dlc = [];
while ($row = $dlcRes->fetch_assoc()) {
  $dlc[] = $row;
}
$dlcBadges = region_badges_for_npwrs($db, array_column($dlc, "npwr"));

$platformRes = $db->query("
  SELECT title_platform
  FROM games
  WHERE title_platform <> ''
");

$platformCounts = [];
while ($row = $platformRes->fetch_assoc()) {
  $platform = primary_platform((string)$row["title_platform"]);
  if ($platform === "") continue;
  $platformCounts[$platform] = ($platformCounts[$platform] ?? 0) + 1;
}
arsort($platformCounts);
$platforms = array_slice($platformCounts, 0, 6, true);
$platformCount = count($platformCounts);

$heroIcon = "";
foreach ($recent as $row) {
  if (!empty($row["icon_url"])) {
    $heroIcon = $row["icon_url"];
    break;
  }
}

function trophy_stat($row, string $key): int {
  return (int)($row[$key] ?? 0);
}

render_header("Trophy Project");
?>
<section class="relative mb-5 overflow-hidden rounded-lg border border-cyan-300/15 bg-slate-950 shadow-[0_24px_80px_rgba(0,0,0,0.36)]">
  <?php if ($heroIcon !== ""): ?>
    <img src="<?= htmlspecialchars($heroIcon) ?>" class="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl" alt="" />
  <?php endif; ?>
  <div class="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.22),transparent_28rem),linear-gradient(90deg,rgba(8,11,18,0.96),rgba(8,11,18,0.78),rgba(8,11,18,0.94))]"></div>

  <div class="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
    <div>
      <div class="mb-5 flex items-center gap-4">
        <img src="/assets/logo.webp" class="h-20 w-20 rounded-lg border border-cyan-300/25 object-cover shadow-[0_0_46px_rgba(34,211,238,0.24)]" alt="" />
        <div>
          <div class="text-[13px] font-semibold uppercase tracking-wide text-cyan-300">PlayStation Trophy Index</div>
          <h1 class="mt-1 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">Trophy Project</h1>
        </div>
      </div>
      <p class="mt-3 max-w-2xl text-[15px] leading-6 app-muted">
        Browse scanned NPWR trophy lists, inspect groups, and build a clean trophy roadmap from the local database.
      </p>
      <form action="/pages/search.php" method="get" class="mt-5 flex max-w-2xl gap-2">
        <input
          name="q"
          class="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.08] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.11] focus:ring-4 focus:ring-cyan-400/10"
          placeholder="Search by game title or NPWR"
          autocomplete="off"
        />
        <button class="rounded-lg bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200" type="submit">Search</button>
      </form>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <a href="/pages/planner.php" class="app-cell p-4 transition hover:-translate-y-0.5">
        <div class="text-xs font-semibold uppercase tracking-wide text-cyan-200">Planner</div>
        <div class="mt-2 text-2xl font-semibold text-white">Roadmap</div>
        <div class="mt-1 text-xs app-muted">Build trophy plans</div>
      </a>
      <a href="/pages/psn-user.php" class="app-cell p-4 transition hover:-translate-y-0.5">
        <div class="text-xs font-semibold uppercase tracking-wide text-cyan-200">PSN API</div>
        <div class="mt-2 text-2xl font-semibold text-white">Users</div>
        <div class="mt-1 text-xs app-muted">Search online IDs</div>
      </a>
      <a href="/pages/search.php" class="app-cell p-4 transition hover:-translate-y-0.5">
        <div class="text-xs font-semibold uppercase tracking-wide text-cyan-200">Library</div>
        <div class="mt-2 text-2xl font-semibold text-white">Browse</div>
        <div class="mt-1 text-xs app-muted">Find NPWR lists</div>
      </a>
    </div>
  </div>
</section>

<section class="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <article class="app-panel p-4">
    <div class="text-xs font-semibold uppercase tracking-wide app-faint">Games Tracked</div>
    <div class="mt-2 text-3xl font-semibold tracking-tight text-white"><?= number_format($gamesCount) ?></div>
  </article>
  <article class="app-panel p-4">
    <div class="text-xs font-semibold uppercase tracking-wide app-faint">Trophies Indexed</div>
    <div class="mt-2 text-3xl font-semibold tracking-tight text-white"><?= number_format($trophiesCount) ?></div>
  </article>
  <article class="app-panel p-4">
    <div class="text-xs font-semibold uppercase tracking-wide app-faint">DLC</div>
    <div class="mt-2 text-3xl font-semibold tracking-tight text-white"><?= number_format($groupsCount) ?></div>
  </article>
  <article class="app-panel p-4">
    <div class="text-xs font-semibold uppercase tracking-wide app-faint">Platforms</div>
    <div class="mt-2 text-3xl font-semibold tracking-tight text-white"><?= number_format($platformCount) ?></div>
  </article>
</section>

<section class="space-y-5">
  <div class="grid gap-5 xl:grid-cols-2">
  <section class="app-panel overflow-hidden">
    <div class="flex items-center justify-between border-b border-white/10 bg-cyan-300/10 px-4 py-3">
      <h2 class="text-sm font-bold uppercase tracking-wide text-cyan-100">Newest Trophy Lists</h2>
      <span class="text-xs app-faint">Latest scans</span>
    </div>
    <div class="divide-y divide-white/10">
      <?php foreach ($recent as $row): ?>
        <a href="/pages/game.php?npwr=<?= urlencode($row["npwr"]) ?>" class="flex gap-3 p-3 transition hover:bg-white/[0.04]">
          <div class="grid h-16 w-16 flex-shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-900 p-1 ring-1 ring-white/10">
            <?php if (!empty($row["icon_url"])): ?>
              <img src="<?= htmlspecialchars($row["icon_url"]) ?>" class="max-h-full max-w-full object-contain" alt="" loading="lazy" />
            <?php endif; ?>
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-[15px] font-semibold text-white"><?= htmlspecialchars($row["title_name"]) ?></div>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs app-muted">
              <span class="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]"><?= htmlspecialchars($row["npwr"]) ?></span>
              <?php render_region_badges($recentBadges[$row["npwr"]] ?? []); ?>
              <span><?= htmlspecialchars(primary_platform((string)$row["title_platform"]) ?: $row["title_platform"]) ?></span>
              <span><?= number_format((int)$row["trophy_count"]) ?> trophies</span>
            </div>
            <div class="mt-2 flex flex-wrap gap-2 text-[11px] app-faint">
              <span>P <?= number_format(trophy_stat($row, "platinum")) ?></span>
              <span>G <?= number_format(trophy_stat($row, "gold")) ?></span>
              <span>S <?= number_format(trophy_stat($row, "silver")) ?></span>
              <span>B <?= number_format(trophy_stat($row, "bronze")) ?></span>
            </div>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  </section>

  <section class="app-panel overflow-hidden">
    <div class="flex items-center justify-between border-b border-white/10 bg-cyan-300/10 px-4 py-3">
      <h2 class="text-sm font-bold uppercase tracking-wide text-cyan-100">Newest DLC</h2>
      <span class="text-xs app-faint">Latest groups</span>
    </div>
    <div class="divide-y divide-white/10">
      <?php foreach ($dlc as $row): ?>
        <?php $icon = $row["group_icon_url"] ?: $row["game_icon_url"]; ?>
        <a href="/pages/game.php?npwr=<?= urlencode($row["npwr"]) ?>" class="flex gap-3 p-3 transition hover:bg-white/[0.04]">
          <div class="grid h-16 w-16 flex-shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-900 p-1 ring-1 ring-white/10">
            <?php if (!empty($icon)): ?>
              <img src="<?= htmlspecialchars($icon) ?>" class="max-h-full max-w-full object-contain" alt="" loading="lazy" />
            <?php endif; ?>
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-[15px] font-semibold text-white"><?= htmlspecialchars($row["group_name"] ?: "DLC") ?></div>
            <div class="mt-1 truncate text-sm app-muted"><?= htmlspecialchars($row["title_name"]) ?></div>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs app-muted">
              <span class="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]"><?= htmlspecialchars($row["group_id"]) ?></span>
              <?php render_region_badges($dlcBadges[$row["npwr"]] ?? []); ?>
              <span><?= htmlspecialchars(primary_platform((string)$row["title_platform"]) ?: $row["title_platform"]) ?></span>
              <span><?= number_format((int)($row["trophy_count"] ?: $row["defined_total"])) ?> trophies</span>
            </div>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  </section>
  </div>

  <aside>
    <section class="app-panel overflow-hidden">
      <div class="border-b border-white/10 bg-cyan-300/10 px-4 py-3">
        <h2 class="text-sm font-bold uppercase tracking-wide text-cyan-100">Platform Coverage</h2>
      </div>
      <div class="space-y-3 p-4">
        <?php foreach ($platforms as $platform => $total): ?>
          <?php $percent = $gamesCount > 0 ? max(4, min(100, ((int)$total / $gamesCount) * 100)) : 0; ?>
          <div>
            <div class="mb-1 flex items-center justify-between gap-3 text-sm">
              <span class="font-semibold text-white"><?= htmlspecialchars($platform) ?></span>
              <span class="text-xs app-muted"><?= number_format((int)$total) ?></span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-white/[0.07]">
              <div class="h-full rounded-full bg-cyan-300" style="width: <?= $percent ?>%"></div>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    </section>
  </aside>
</section>
<?php render_footer(); ?>
