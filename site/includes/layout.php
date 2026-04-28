<?php
function render_header(string $title = "Trophy Scanner") { ?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title><?= htmlspecialchars($title) ?></title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-[#07111f] text-slate-100">
  <header class="sticky top-0 z-50 border-b border-blue-900/50 bg-[#08172a]/95 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
      <a href="/pages/index.php" class="flex items-center gap-2 font-semibold tracking-wide text-white">
        <span class="grid h-8 w-8 place-items-center rounded-md bg-blue-600 text-sm font-bold shadow-[0_0_28px_rgba(37,99,235,0.45)]">T</span>
        <span>TrophyScanner</span>
      </a>
      <form action="/pages/search.php" method="get" class="hidden flex-1 sm:block sm:max-w-xl">
        <input name="q" placeholder="Search games..." class="w-full rounded-md border border-blue-900/60 bg-[#0d1d33] px-4 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
      </form>
      <nav class="flex items-center gap-2 text-sm">
        <a href="/pages/scan-user.php" class="rounded-md border border-blue-800/70 bg-blue-600/15 px-3 py-2 font-medium text-blue-100 transition hover:border-blue-500 hover:bg-blue-600/25">Scan PSN</a>
      </nav>
    </div>
  </header>
  <main class="mx-auto max-w-6xl px-4 py-6">
<?php }

function render_footer() { ?>
  </main>
  <footer class="mx-auto max-w-6xl px-4 pb-10 pt-2 text-xs text-slate-500">
    Built with GitHub Actions + InfinityFree
  </footer>
</body>
</html>
<?php } ?>
