<?php
function render_header(string $title = "Trophy Project") { ?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title><?= htmlspecialchars($title) ?></title>
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/assets/favicon-32x32.png" type="image/png" />
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root { color-scheme: dark; }
    body {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at 20% -10%, rgba(14, 165, 233, 0.20), transparent 32rem),
        radial-gradient(circle at 88% 4%, rgba(168, 85, 247, 0.14), transparent 30rem),
        linear-gradient(180deg, #080b12 0%, #0d111a 44%, #080b12 100%);
      color: #f8fafc;
    }
    .app-glass {
      background: rgba(11, 15, 24, 0.78);
      backdrop-filter: blur(22px) saturate(150%);
      -webkit-backdrop-filter: blur(22px) saturate(150%);
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
    }
    .app-panel {
      background: linear-gradient(180deg, rgba(20, 26, 39, 0.92), rgba(12, 17, 27, 0.92));
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 8px;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.30);
    }
    .app-cell {
      background: rgba(17, 24, 39, 0.76);
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 8px;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
    }
    .app-cell:hover {
      background: rgba(30, 41, 59, 0.82);
      border-color: rgba(56, 189, 248, 0.24);
    }
    .app-muted { color: rgba(203, 213, 225, 0.68); }
    .app-faint { color: rgba(148, 163, 184, 0.62); }
    .app-scrollbar {
      scrollbar-width: thin;
      scrollbar-color: rgba(34, 211, 238, 0.45) rgba(15, 23, 42, 0.45);
    }
    .app-scrollbar::-webkit-scrollbar { width: 0.65rem; }
    .app-scrollbar::-webkit-scrollbar-track {
      background: rgba(15, 23, 42, 0.45);
      border-radius: 999px;
    }
    .app-scrollbar::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, rgba(34, 211, 238, 0.62), rgba(168, 85, 247, 0.42));
      border: 2px solid rgba(15, 23, 42, 0.80);
      border-radius: 999px;
    }
    .app-scrollbar::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(180deg, rgba(103, 232, 249, 0.78), rgba(192, 132, 252, 0.58));
    }
  </style>
</head>
<body class="min-h-screen antialiased">
  <header class="app-glass sticky top-0 z-50">
    <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
      <a href="/" class="flex min-w-0 items-center gap-3">
        <span class="grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-cyan-300/25 bg-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.24)]">
          <img src="/assets/logo.webp" class="h-full w-full object-cover" alt="" />
        </span>
        <span class="hidden text-[17px] font-semibold tracking-tight text-white sm:inline">Trophy Project</span>
      </a>

      <div class="min-w-0 flex-1"></div>
    </div>
  </header>

  <main class="mx-auto max-w-6xl px-4 py-5 sm:py-8">
<?php }

function render_footer() { ?>
  </main>
  <footer class="mx-auto max-w-6xl px-4 pb-8 text-center text-xs app-faint">
    Trophy Project
  </footer>
</body>
</html>
<?php } ?>
