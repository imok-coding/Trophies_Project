<?php
require_once __DIR__ . '/../includes/layout.php';

if (parse_url($_SERVER["REQUEST_URI"] ?? "", PHP_URL_PATH) === "/pages/psn-user.php") {
  header("Location: /psn-user", true, 301);
  exit;
}

render_header('PSN User Search');
?>
<section class="mb-5 app-panel overflow-hidden p-5 sm:p-6">
  <div class="text-[13px] font-semibold uppercase tracking-wide text-cyan-300">PSN API</div>
  <h1 class="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">PSN profile lookup</h1>
  <p class="mt-2 max-w-3xl text-[15px] leading-6 app-muted">
    Search an exact online ID to view earned trophies and trophy lists from PSN.
  </p>

  <form id="psn-user-search-form" class="mt-5 flex max-w-2xl gap-2">
    <input
      id="psn-user-search"
      class="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.08] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.11] focus:ring-4 focus:ring-cyan-400/10"
      placeholder="Enter a PSN online ID"
      autocomplete="off"
    />
    <button class="rounded-lg bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200" type="submit">Search</button>
  </form>
</section>

<section class="space-y-5">
  <div id="psn-user-results">
    <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm app-muted">Search for a PSN user to load their profile.</div>
  </div>
  <div id="psn-user-titles"></div>
</section>

<script src="/assets/psn-user-search.js?v=20260502-grouped-dlc"></script>
<?php render_footer(); ?>
