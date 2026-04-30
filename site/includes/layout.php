<?php
function render_header(string $title = "Trophy Project") { ?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title><?= htmlspecialchars($title) ?></title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root { color-scheme: light; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at 20% 0%, rgba(0, 122, 255, 0.12), transparent 30rem),
        radial-gradient(circle at 90% 10%, rgba(52, 199, 89, 0.10), transparent 26rem),
        #f4f5f8;
    }
    .ios-glass {
      background: rgba(250, 250, 252, 0.82);
      backdrop-filter: blur(22px) saturate(180%);
      -webkit-backdrop-filter: blur(22px) saturate(180%);
    }
    .ios-panel {
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid rgba(60, 60, 67, 0.12);
      border-radius: 8px;
      box-shadow: 0 18px 48px rgba(30, 42, 70, 0.10);
    }
    .ios-cell {
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(60, 60, 67, 0.10);
      border-radius: 8px;
      box-shadow: 0 10px 26px rgba(30, 42, 70, 0.07);
    }
    .ios-muted { color: rgba(60, 60, 67, 0.66); }
    .ios-hairline { border-color: rgba(60, 60, 67, 0.12); }
  </style>
</head>
<body class="min-h-screen text-[#111827] antialiased">
  <header class="ios-glass sticky top-0 z-50 border-b ios-hairline">
    <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
      <a href="/pages/index.php" class="flex min-w-0 items-center gap-3">
        <span class="grid h-9 w-9 place-items-center rounded-lg bg-[#007aff] text-base font-semibold text-white shadow-[0_10px_24px_rgba(0,122,255,0.28)]">T</span>
        <span class="hidden text-[17px] font-semibold tracking-tight text-[#111827] sm:inline">Trophy Project</span>
      </a>

      <form action="/pages/search.php" method="get" class="min-w-0 flex-1">
        <label class="relative block">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm ios-muted">Search</span>
          <input
            name="q"
            value="<?= htmlspecialchars($_GET["q"] ?? "") ?>"
            aria-label="Search games"
            class="h-10 w-full rounded-full border border-transparent bg-[#e9ebf0] pl-[4.3rem] pr-4 text-[15px] text-[#111827] outline-none transition focus:border-[#007aff]/30 focus:bg-white focus:ring-4 focus:ring-[#007aff]/10"
          />
        </label>
      </form>

      <a href="/pages/scan-user.php" class="rounded-full bg-[#111827] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2b3445]">
        Scan
      </a>
    </div>
  </header>

  <main class="mx-auto max-w-6xl px-4 py-5 sm:py-8">
<?php }

function render_footer() { ?>
  </main>
  <footer class="mx-auto max-w-6xl px-4 pb-8 text-center text-xs ios-muted">
    Trophy Project
  </footer>
</body>
</html>
<?php } ?>
