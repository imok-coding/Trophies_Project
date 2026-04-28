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
<body class="bg-zinc-950 text-zinc-100">
  <header class="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
    <div class="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
      <a href="/pages/index.php" class="font-semibold text-lg tracking-wide">TrophyScanner</a>
      <form action="/pages/search.php" method="get" class="flex-1 max-w-xl">
        <input name="q" placeholder="Search games..." class="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2 outline-none focus:border-blue-500" />
      </form>
      <nav class="flex items-center gap-3 text-sm text-zinc-300">
        <a href="/pages/scan-user.php" class="hover:text-white">Scan PSN</a>
      </nav>
    </div>
  </header>
  <main class="mx-auto max-w-6xl px-4 py-6">
<?php }

function render_footer() { ?>
  </main>
  <footer class="mx-auto max-w-6xl px-4 pb-10 text-xs text-zinc-500">
    Built with GitHub Actions + InfinityFree
  </footer>
</body>
</html>
<?php } ?>
