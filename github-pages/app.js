const PAGE_SIZE = 100;
const state = {
  all: [],
  filtered: [],
  page: 1,
  query: "",
  generatedAt: ""
};

const els = {
  total: document.getElementById("total-games"),
  updated: document.getElementById("updated-at"),
  search: document.getElementById("search"),
  list: document.getElementById("games"),
  pagination: document.getElementById("pagination"),
  pageLabel: document.getElementById("page-label"),
  dialog: document.getElementById("detail-dialog"),
  detail: document.getElementById("detail-content"),
  close: document.getElementById("close-detail")
};

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

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

function trophyIcon(file, label) {
  return `<img src="./assets/trophy/${file}" alt="${label}" />`;
}

function countLine(counts = {}) {
  return `
    <span>${trophyIcon("470bd2.png", "Platinum")}${format(counts.platinum)}</span>
    <span>${trophyIcon("7186c5.png", "Gold")}${format(counts.gold)}</span>
    <span>${trophyIcon("f179ed.png", "Silver")}${format(counts.silver)}</span>
    <span>${trophyIcon("e61e35.png", "Bronze")}${format(counts.bronze)}</span>
  `;
}

function scoreGame(game, normalized) {
  const title = normalize(game.title);
  const npwr = normalize(game.npwr);
  if (npwr === normalized) return 0;
  if (title === normalized) return 1;
  if (npwr.startsWith(normalized)) return 2;
  if (title.startsWith(normalized)) return 3;
  return 4;
}

function applyFilter() {
  const raw = state.query.trim();
  const normalized = normalize(raw);
  if (!normalized) {
    state.filtered = [...state.all];
  } else {
    state.filtered = state.all
      .filter((game) => normalize(game.title).includes(normalized) || normalize(game.npwr).includes(normalized))
      .sort((left, right) =>
        scoreGame(left, normalized) - scoreGame(right, normalized)
        || left.title.localeCompare(right.title, undefined, { sensitivity: "base" })
        || left.npwr.localeCompare(right.npwr)
      );
  }
  state.page = 1;
  render();
}

function render() {
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * PAGE_SIZE;
  const pageGames = state.filtered.slice(start, start + PAGE_SIZE);

  els.total.textContent = format(state.all.length);
  els.updated.textContent = state.generatedAt ? new Date(state.generatedAt).toLocaleDateString() : "Unknown";
  els.pageLabel.textContent = `${format(state.filtered.length)} results - Page ${format(state.page)} of ${format(totalPages)}`;

  if (!pageGames.length) {
    els.list.innerHTML = `<div class="empty">No games found.</div>`;
  } else {
    els.list.innerHTML = pageGames.map((game) => `
      <button class="game" type="button" data-npwr="${escapeHtml(game.npwr)}">
        <span class="icon">${game.iconUrl ? `<img src="${escapeHtml(game.iconUrl)}" alt="" loading="lazy" />` : "TP"}</span>
        <span class="game-body">
          <span class="title">${escapeHtml(game.title)}</span>
          <span class="meta">
            <span class="npwr">${escapeHtml(game.npwr)}</span>
            <span>${escapeHtml(game.platform || game.platformRaw || "")}</span>
            <span>${format(game.counts?.total || 0)} trophies</span>
          </span>
          <span class="counts">${countLine(game.counts)}</span>
        </span>
      </button>
    `).join("");
  }

  renderPagination(totalPages);
}

function pageWindow(current, total) {
  const pages = new Set([1, total]);
  for (let page = current - 2; page <= current + 2; page += 1) {
    if (page >= 1 && page <= total) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}

function renderPagination(totalPages) {
  if (totalPages <= 1) {
    els.pagination.innerHTML = "";
    return;
  }

  const parts = [
    pageButton("Prev", Math.max(1, state.page - 1), state.page <= 1)
  ];
  let previous = 0;
  for (const page of pageWindow(state.page, totalPages)) {
    if (previous && page - previous > 1) parts.push(`<span class="muted">...</span>`);
    parts.push(pageButton(String(page), page, false, page === state.page));
    previous = page;
  }
  parts.push(pageButton("Next", Math.min(totalPages, state.page + 1), state.page >= totalPages));
  els.pagination.innerHTML = parts.join("");
}

function pageButton(label, page, disabled = false, active = false) {
  return `<button type="button" data-page="${page}" class="${active ? "active" : ""}" ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
}

function openGame(npwr) {
  const game = state.all.find((item) => item.npwr === npwr);
  if (!game) return;
  els.detail.innerHTML = `
    <div class="detail-head">
      <span class="icon">${game.iconUrl ? `<img src="${escapeHtml(game.iconUrl)}" alt="" />` : "TP"}</span>
      <div>
        <h2>${escapeHtml(game.title)}</h2>
        <div class="meta">
          <span class="npwr">${escapeHtml(game.npwr)}</span>
          <span>${escapeHtml(game.platform || game.platformRaw || "")}</span>
        </div>
        <div class="counts">${countLine(game.counts)}</div>
      </div>
    </div>
    <div class="detail-body">
      <p>This GitHub Pages mirror stores the searchable games database statically. Trophy group detail can be added later as a larger static export.</p>
    </div>
  `;
  els.dialog.showModal();
}

async function init() {
  const response = await fetch("./data/games.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load static database.");
  const payload = await response.json();
  state.all = payload.games || [];
  state.filtered = [...state.all];
  state.generatedAt = payload.generatedAt || "";
  render();
}

els.search.addEventListener("input", () => {
  state.query = els.search.value;
  applyFilter();
});

els.pagination.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (!button || button.disabled) return;
  state.page = Number(button.dataset.page);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

els.list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-npwr]");
  if (!button) return;
  openGame(button.dataset.npwr);
});

els.close.addEventListener("click", () => els.dialog.close());

init().catch((error) => {
  els.list.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
});
