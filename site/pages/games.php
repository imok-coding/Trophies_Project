<?php
require_once __DIR__ . '/../includes/layout.php';

if (parse_url($_SERVER["REQUEST_URI"] ?? "", PHP_URL_PATH) === "/pages/games.php") {
  $query = $_SERVER["QUERY_STRING"] ?? "";
  header("Location: /games" . ($query !== "" ? "?" . $query : ""), true, 301);
  exit;
}

render_header('All Games');
?>
<section class="mb-5 app-panel overflow-hidden p-5 sm:p-6">
  <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <div class="text-[13px] font-semibold uppercase tracking-wide text-cyan-300">Library</div>
      <h1 class="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">All Games</h1>
      <p class="mt-2 max-w-3xl text-[15px] leading-6 app-muted">
        Browse every trophy list in the database. Search updates as you type.
      </p>
    </div>
    <div id="games-count" class="rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white">
      Loading...
    </div>
  </div>

  <div class="mt-5">
    <input
      id="games-search"
      class="w-full rounded-lg border border-white/10 bg-white/[0.08] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.11] focus:ring-4 focus:ring-cyan-400/10"
      placeholder="Search by game title or NPWR"
      autocomplete="off"
    />
  </div>
</section>

<section class="app-panel overflow-hidden">
  <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-cyan-300/10 px-4 py-3">
    <h2 class="text-sm font-bold uppercase tracking-wide text-cyan-100">Games</h2>
    <span id="games-page-label" class="text-xs app-faint">Page 1</span>
  </div>

  <div id="games-list" class="divide-y divide-white/10">
    <div class="p-4 text-sm app-muted">Loading games...</div>
  </div>

  <div class="border-t border-white/10 p-3">
    <div id="games-pagination" class="flex flex-wrap items-center justify-center gap-2"></div>
  </div>
</section>

<script src="/assets/games.js?v=20260502-live-games"></script>
<?php render_footer(); ?>
