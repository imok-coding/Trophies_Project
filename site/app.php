<?php
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
header("Expires: 0");
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>Trophy Project App</title>
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/assets/favicon-32x32.png" type="image/png" />
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root { color-scheme: dark; }
    body {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at 18% 0%, rgba(34, 211, 238, 0.24), transparent 30rem),
        radial-gradient(circle at 82% 12%, rgba(99, 102, 241, 0.22), transparent 32rem),
        linear-gradient(180deg, #070a11 0%, #0d111a 48%, #070a11 100%);
      color: #f8fafc;
    }
    .glass {
      background: rgba(15, 23, 42, 0.72);
      border: 1px solid rgba(148, 163, 184, 0.16);
      box-shadow: 0 28px 90px rgba(0, 0, 0, 0.38);
    }
    .phone {
      width: min(22rem, 78vw);
      border-radius: 2.8rem;
      background: linear-gradient(160deg, #111827, #020617);
      border: 1px solid rgba(255,255,255,0.16);
      box-shadow: 0 36px 110px rgba(34, 211, 238, 0.18), inset 0 0 0 8px #050814;
      padding: 1rem;
    }
    .screen {
      min-height: 38rem;
      border-radius: 2rem;
      background:
        radial-gradient(circle at 30% -4%, rgba(34, 211, 238, 0.22), transparent 18rem),
        linear-gradient(180deg, #0f172a, #070a11);
      overflow: hidden;
    }
  </style>
</head>
<body class="min-h-screen antialiased">
  <header class="border-b border-white/10 bg-black/20 backdrop-blur-xl">
    <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
      <a href="/" class="flex items-center gap-3">
        <span class="grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-cyan-300/25 bg-slate-950">
          <img src="/assets/logo.webp" class="h-full w-full object-cover" alt="" />
        </span>
        <span class="font-semibold text-white">Trophy Project</span>
      </a>
      <a href="/games" class="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.10]">Browse Web</a>
    </div>
  </header>

  <main class="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1fr_24rem] lg:items-center">
    <section>
      <div class="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-100">iPhone App Preview</div>
      <h1 class="mt-5 max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">Trophy Project, rebuilt for iPhone.</h1>
      <p class="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
        A native SwiftUI companion for browsing trophy lists, drilling into Base Game and DLC packs, building trophy plans, and looking up PSN profiles with a clean mobile-first interface.
      </p>

      <div class="mt-8 grid gap-3 sm:grid-cols-2">
        <div class="glass rounded-lg p-4">
          <div class="text-xs font-bold uppercase tracking-wide text-cyan-200">Library</div>
          <div class="mt-2 text-2xl font-semibold">Live Game Search</div>
          <p class="mt-2 text-sm leading-6 text-slate-400">Search the full database, page through results, and open grouped trophy detail views.</p>
        </div>
        <div class="glass rounded-lg p-4">
          <div class="text-xs font-bold uppercase tracking-wide text-cyan-200">Planner</div>
          <div class="mt-2 text-2xl font-semibold">On-Device Plans</div>
          <p class="mt-2 text-sm leading-6 text-slate-400">Add lists, toggle planned trophies, and keep your roadmap saved locally.</p>
        </div>
        <div class="glass rounded-lg p-4">
          <div class="text-xs font-bold uppercase tracking-wide text-cyan-200">PSN</div>
          <div class="mt-2 text-2xl font-semibold">Profile Lookup</div>
          <p class="mt-2 text-sm leading-6 text-slate-400">Search exact online IDs and inspect earned trophy lists through the PSN API.</p>
        </div>
        <div class="glass rounded-lg p-4">
          <div class="text-xs font-bold uppercase tracking-wide text-cyan-200">Native</div>
          <div class="mt-2 text-2xl font-semibold">SwiftUI + Xcode</div>
          <p class="mt-2 text-sm leading-6 text-slate-400">The app lives in the repo as an Xcode project under <code>TrophyProject-iOS</code>.</p>
        </div>
      </div>

      <div class="mt-8 flex flex-wrap gap-3">
        <a href="https://github.com/imok-coding/Trophies_Project" class="rounded-lg bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">View Source</a>
        <a href="/games" class="rounded-lg border border-white/10 bg-white/[0.07] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/[0.11]">Try Web Library</a>
      </div>
    </section>

    <aside class="mx-auto">
      <div class="phone">
        <div class="screen p-4">
          <div class="mx-auto mb-4 h-1.5 w-20 rounded-full bg-white/20"></div>
          <div class="flex items-center gap-3">
            <img src="/assets/logo.webp" class="h-12 w-12 rounded-xl object-cover" alt="" />
            <div>
              <div class="text-lg font-bold">Trophy Project</div>
              <div class="text-xs text-slate-400">Library • Planner • PSN</div>
            </div>
          </div>
          <div class="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
            <div class="flex items-center gap-2 text-sm text-slate-400"><span>⌕</span><span>Search game title or NPWR</span></div>
          </div>
          <div class="mt-4 space-y-3">
            <?php
              $items = [
                ['Hydroneer: Journey to Volcalidus', 'PS5', '27 trophies'],
                ['Assassin\'s Creed Odyssey', 'PS4', '94 trophies'],
                ['THE EYE OF JUDGMENT™ Trophies', 'PS3', '47 trophies']
              ];
              foreach ($items as $item):
            ?>
              <div class="rounded-2xl border border-white/10 bg-white/[0.055] p-3">
                <div class="text-sm font-semibold"><?= htmlspecialchars($item[0]) ?></div>
                <div class="mt-1 flex gap-2 text-xs text-slate-400">
                  <span><?= htmlspecialchars($item[1]) ?></span>
                  <span><?= htmlspecialchars($item[2]) ?></span>
                </div>
                <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div class="h-full rounded-full bg-cyan-300" style="width: <?= $item[1] === 'PS4' ? '64' : '38' ?>%"></div>
                </div>
              </div>
            <?php endforeach; ?>
          </div>
          <div class="mt-5 rounded-2xl bg-[#35699f] px-3 py-2 text-xs font-bold uppercase tracking-wide">DLC Trophy Pack 1</div>
          <div class="rounded-b-2xl border border-t-0 border-white/10 bg-white/[0.045] p-3">
            <div class="text-sm font-semibold">Base Game and DLC stay separated</div>
            <div class="mt-1 text-xs text-slate-400">Native trophy groups, clean mobile rows.</div>
          </div>
        </div>
      </div>
    </aside>
  </main>
</body>
</html>
