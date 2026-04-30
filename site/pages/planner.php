<?php
require_once __DIR__ . '/../includes/layout.php';

render_header('Trophy Planner');
?>
<section class="mb-5 app-panel overflow-hidden p-5 sm:p-6">
  <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <div class="text-[13px] font-semibold uppercase tracking-wide text-cyan-300">Trophy Planner</div>
      <h1 class="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Build a trophy roadmap</h1>
      <p class="mt-2 max-w-3xl text-[15px] leading-6 app-muted">
        Add trophy lists from the local database, choose the trophies you plan to earn, and estimate trophy points and level movement.
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <button id="planner-export" class="rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.11]" type="button">Export</button>
      <button id="planner-import" class="rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.11]" type="button">Import</button>
      <button id="planner-clear" class="rounded-lg border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15" type="button">Clear</button>
      <input id="planner-import-file" type="file" accept="application/json,.json" hidden />
    </div>
  </div>
</section>

<section class="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <article class="app-panel p-4">
    <div class="text-xs font-semibold uppercase tracking-wide app-faint">Planned Titles</div>
    <div id="planner-title-count" class="mt-2 text-3xl font-semibold tracking-tight text-white">0</div>
  </article>
  <article class="app-panel p-4">
    <div class="text-xs font-semibold uppercase tracking-wide app-faint">Selected Trophies</div>
    <div id="planner-trophy-count" class="mt-2 text-3xl font-semibold tracking-tight text-white">0</div>
  </article>
  <article class="app-panel p-4">
    <div class="text-xs font-semibold uppercase tracking-wide app-faint">Projected Points</div>
    <div id="planner-points" class="mt-2 text-3xl font-semibold tracking-tight text-white">0</div>
  </article>
  <article class="app-panel p-4">
    <div class="text-xs font-semibold uppercase tracking-wide app-faint">Estimated Level</div>
    <div id="planner-level" class="mt-2 text-3xl font-semibold tracking-tight text-white">1</div>
  </article>
</section>

<section class="grid gap-5 lg:grid-cols-[1fr_22rem]">
  <main class="space-y-5">
    <section class="app-panel p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-white">Planned Games</h2>
          <p id="planner-breakdown" class="mt-1 text-sm app-muted">P 0 &middot; G 0 &middot; S 0 &middot; B 0</p>
        </div>
        <select id="planner-filter" class="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40">
          <option value="all">All trophies</option>
          <option value="selected">Selected only</option>
          <option value="remaining">Unselected only</option>
        </select>
      </div>
      <div id="planner-list" class="space-y-3">
        <div class="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm app-muted">Search for a game and add it to start planning.</div>
      </div>
    </section>
  </main>

  <aside class="space-y-5">
    <section class="app-panel p-4">
      <h2 class="text-lg font-semibold text-white">Add Trophy List</h2>
      <form id="planner-search-form" class="mt-3 flex gap-2">
        <input id="planner-search" class="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40" placeholder="Search title or NPWR" autocomplete="off" />
        <button class="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200" type="submit">Find</button>
      </form>
      <div id="planner-search-results" class="app-scrollbar mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm app-muted">Try searching for a title or NPWR ID.</div>
      </div>
    </section>

    <section class="app-panel p-4">
      <h2 class="text-lg font-semibold text-white">Point Values</h2>
      <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div class="rounded-lg bg-white/[0.05] p-3"><span class="app-faint">Platinum</span><div class="font-semibold text-white">300</div></div>
        <div class="rounded-lg bg-white/[0.05] p-3"><span class="app-faint">Gold</span><div class="font-semibold text-white">90</div></div>
        <div class="rounded-lg bg-white/[0.05] p-3"><span class="app-faint">Silver</span><div class="font-semibold text-white">30</div></div>
        <div class="rounded-lg bg-white/[0.05] p-3"><span class="app-faint">Bronze</span><div class="font-semibold text-white">15</div></div>
      </div>
    </section>
  </aside>
</section>

<script src="/assets/planner.js"></script>
<?php render_footer(); ?>
