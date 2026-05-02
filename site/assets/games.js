const searchInput = document.getElementById("games-search");
const list = document.getElementById("games-list");
const pagination = document.getElementById("games-pagination");
const countLabel = document.getElementById("games-count");
const pageLabel = document.getElementById("games-page-label");

let state = { q: "", page: 1, totalPages: 1, abort: null };
let searchTimer = 0;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function format(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function trophyIcon(type) {
  const icons = {
    platinum: ["470bd2.png", "P"],
    gold: ["7186c5.png", "G"],
    silver: ["f179ed.png", "S"],
    bronze: ["e61e35.png", "B"],
  };
  const [file, alt] = icons[type] || icons.bronze;
  return `<img src="/assets/trophy/${file}" alt="${alt}" class="inline-block h-5 w-5 align-[-4px]" loading="lazy" />`;
}

function countHtml(counts = {}) {
  return `
    <span class="inline-flex items-center gap-1 text-sm font-semibold">${format(counts.platinum)}${trophyIcon("platinum")}</span>
    <span class="inline-flex items-center gap-1 text-sm font-semibold">${format(counts.gold)}${trophyIcon("gold")}</span>
    <span class="inline-flex items-center gap-1 text-sm font-semibold">${format(counts.silver)}${trophyIcon("silver")}</span>
    <span class="inline-flex items-center gap-1 text-sm font-semibold">${format(counts.bronze)}${trophyIcon("bronze")}</span>
  `;
}

function renderGames(games) {
  if (!games.length) {
    list.innerHTML = `<div class="p-4 text-sm app-muted">No games found.</div>`;
    return;
  }

  list.innerHTML = games.map((game) => `
    <a href="/game?npwr=${encodeURIComponent(game.npwr)}" class="flex gap-3 p-3 transition hover:bg-white/[0.04]">
      <div class="grid h-16 w-16 flex-shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-900 p-1 ring-1 ring-white/10">
        ${game.iconUrl ? `<img src="${escapeHtml(game.iconUrl)}" class="max-h-full max-w-full object-contain" alt="" loading="lazy" />` : ""}
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-[15px] font-semibold text-white">${escapeHtml(game.title)}</div>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-xs app-muted">
          <span class="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]">${escapeHtml(game.npwr)}</span>
          <span>${escapeHtml(game.platform || game.platformRaw || "")}</span>
          <span>${format(game.counts?.total || 0)} trophies</span>
        </div>
        <div class="mt-2 flex flex-wrap gap-2 text-[11px] app-faint">${countHtml(game.counts || {})}</div>
      </div>
    </a>
  `).join("");
}

function pageWindow(current, total) {
  const pages = new Set([1, total]);
  for (let page = current - 2; page <= current + 2; page += 1) {
    if (page >= 1 && page <= total) pages.add(page);
  }
  return [...pages].sort((left, right) => left - right);
}

function pageButton(label, page, disabled = false, active = false) {
  return `<button
    class="min-h-9 min-w-9 rounded-lg border px-3 py-2 text-sm font-semibold transition ${active ? "border-cyan-300/40 bg-cyan-300 text-slate-950" : "border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.10]"} ${disabled ? "cursor-not-allowed opacity-45" : ""}"
    type="button"
    data-page="${page}"
    ${disabled ? "disabled" : ""}
  >${escapeHtml(label)}</button>`;
}

function renderPagination(page, totalPages) {
  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  const parts = [pageButton("Prev", Math.max(1, page - 1), page <= 1)];
  let previous = 0;
  for (const item of pageWindow(page, totalPages)) {
    if (previous && item - previous > 1) {
      parts.push(`<span class="px-1 text-sm app-faint">...</span>`);
    }
    parts.push(pageButton(String(item), item, false, item === page));
    previous = item;
  }
  parts.push(pageButton("Next", Math.min(totalPages, page + 1), page >= totalPages));
  pagination.innerHTML = parts.join("");
}

async function loadGames(page = 1) {
  if (state.abort) state.abort.abort();
  state.abort = new AbortController();
  state.page = page;

  list.innerHTML = `<div class="p-4 text-sm app-muted">Loading games...</div>`;
  const params = new URLSearchParams({ page: String(page), q: state.q });
  const response = await fetch(`/api/games.php?${params}`, { signal: state.abort.signal });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "Could not load games.");

  state.page = payload.page;
  state.totalPages = payload.totalPages;
  countLabel.textContent = `${format(payload.total)} games`;
  pageLabel.textContent = `Page ${format(payload.page)} of ${format(payload.totalPages)}`;
  renderGames(payload.games || []);
  renderPagination(payload.page, payload.totalPages);
}

searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    state.q = searchInput.value.trim();
    loadGames(1).catch((error) => {
      if (error.name === "AbortError") return;
      list.innerHTML = `<div class="p-4 text-sm text-rose-100">${escapeHtml(error.message)}</div>`;
    });
  }, 180);
});

pagination.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (!button || button.disabled) return;
  loadGames(Number(button.dataset.page)).catch((error) => {
    if (error.name === "AbortError") return;
    list.innerHTML = `<div class="p-4 text-sm text-rose-100">${escapeHtml(error.message)}</div>`;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
});

loadGames(1).catch((error) => {
  if (error.name === "AbortError") return;
  list.innerHTML = `<div class="p-4 text-sm text-rose-100">${escapeHtml(error.message)}</div>`;
});
