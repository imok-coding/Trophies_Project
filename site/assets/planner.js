const STORAGE_KEY = "trophyProjectPlanner.v1";
const state = {
  titles: new Map(),
  filter: "all",
  expanded: new Set(),
};

const els = {
  form: document.getElementById("planner-search-form"),
  search: document.getElementById("planner-search"),
  results: document.getElementById("planner-search-results"),
  list: document.getElementById("planner-list"),
  titleCount: document.getElementById("planner-title-count"),
  trophyCount: document.getElementById("planner-trophy-count"),
  points: document.getElementById("planner-points"),
  level: document.getElementById("planner-level"),
  breakdown: document.getElementById("planner-breakdown"),
  filter: document.getElementById("planner-filter"),
  exportButton: document.getElementById("planner-export"),
  importButton: document.getElementById("planner-import"),
  importFile: document.getElementById("planner-import-file"),
  clearButton: document.getElementById("planner-clear"),
};

const points = { platinum: 300, gold: 90, silver: 30, bronze: 15 };

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

function countText(counts = {}) {
  return `${countWithIcon(counts.platinum, "platinum")} ${countWithIcon(counts.gold, "gold")} ${countWithIcon(counts.silver, "silver")} ${countWithIcon(counts.bronze, "bronze")}`;
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

function countWithIcon(value, type) {
  return `<span class="inline-flex items-center gap-1 text-sm font-semibold">${format(value)}${trophyIcon(type)}</span>`;
}

function levelFromPoints(total) {
  let level = 1;
  let remaining = Math.max(0, Number(total) || 0);
  while (level < 999) {
    const required = level < 100 ? 60 : level < 200 ? 90 : level < 300 ? 450 : level < 400 ? 900 : level < 500 ? 1350 : level < 600 ? 1800 : level < 700 ? 2250 : level < 800 ? 2700 : level < 900 ? 3150 : 3600;
    if (remaining < required) return level;
    remaining -= required;
    level += 1;
  }
  return 999;
}

function selectedTrophies(title) {
  return title.trophies.filter((trophy) => title.selectedIds.includes(trophy.id));
}

function aggregate() {
  const counts = { platinum: 0, gold: 0, silver: 0, bronze: 0, total: 0 };
  for (const title of state.titles.values()) {
    for (const trophy of selectedTrophies(title)) {
      if (counts[trophy.type] !== undefined) counts[trophy.type] += 1;
      counts.total += 1;
    }
  }
  const totalPoints = counts.platinum * points.platinum + counts.gold * points.gold + counts.silver * points.silver + counts.bronze * points.bronze;
  return { counts, totalPoints };
}

function persist() {
  const payload = {
    titles: [...state.titles.values()].map((title) => ({
      npwr: title.npwr,
      title: title.title,
      platform: title.platform,
      iconUrl: title.iconUrl,
      counts: title.counts,
      trophies: title.trophies,
      selectedIds: title.selectedIds,
    })),
    expanded: [...state.expanded],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const payload = JSON.parse(raw);
    for (const title of payload.titles || []) {
      state.titles.set(title.npwr, { ...title, selectedIds: title.selectedIds || [] });
    }
    state.expanded = new Set(payload.expanded || []);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function renderSummary() {
  const totals = aggregate();
  els.titleCount.textContent = format(state.titles.size);
  els.trophyCount.textContent = format(totals.counts.total);
  els.points.textContent = format(totals.totalPoints);
  els.level.textContent = format(levelFromPoints(totals.totalPoints));
  els.breakdown.innerHTML = `${countWithIcon(totals.counts.platinum, "platinum")} &middot; ${countWithIcon(totals.counts.gold, "gold")} &middot; ${countWithIcon(totals.counts.silver, "silver")} &middot; ${countWithIcon(totals.counts.bronze, "bronze")}`;
}

function trophyVisible(title, trophy) {
  const selected = title.selectedIds.includes(trophy.id);
  if (state.filter === "selected") return selected;
  if (state.filter === "remaining") return !selected;
  return true;
}

function renderPlanner() {
  renderSummary();

  if (state.titles.size === 0) {
    els.list.innerHTML = `<div class="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm app-muted">Search for a game and add it to start planning.</div>`;
    return;
  }

  const titles = [...state.titles.values()].sort((left, right) =>
    String(left.title || "").localeCompare(String(right.title || ""), undefined, { sensitivity: "base" })
  );

  els.list.innerHTML = titles.map((title) => {
    const planned = selectedTrophies(title);
    const collapsed = !state.expanded.has(title.npwr);
    const trophyRows = title.trophies.filter((trophy) => trophyVisible(title, trophy)).map((trophy) => {
      const checked = title.selectedIds.includes(trophy.id);
      return `
        <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-2 transition hover:bg-white/[0.07]">
          <input class="h-4 w-4 accent-cyan-300" type="checkbox" data-toggle-trophy="${escapeHtml(title.npwr)}" data-trophy-id="${trophy.id}" ${checked ? "checked" : ""} />
          <span class="h-9 w-9 overflow-hidden rounded-md bg-slate-800">${trophy.iconUrl ? `<img src="${escapeHtml(trophy.iconUrl)}" class="h-full w-full object-cover" alt="" />` : ""}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold text-white">${escapeHtml(trophy.name || "Hidden Trophy")}</span>
            <span class="text-xs app-muted">${escapeHtml(trophy.type)}${trophy.hidden ? " &middot; Hidden" : ""}</span>
          </span>
        </label>
      `;
    }).join("");

    return `
      <article class="app-cell p-3">
        <div class="mb-3 flex items-center gap-3">
          <button class="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-lg font-semibold text-white" data-toggle-title="${escapeHtml(title.npwr)}" type="button" aria-label="${collapsed ? "Expand" : "Collapse"} ${escapeHtml(title.title)}">
            ${collapsed ? "+" : "-"}
          </button>
          <div class="h-14 w-14 overflow-hidden rounded-lg bg-slate-800">${title.iconUrl ? `<img src="${escapeHtml(title.iconUrl)}" class="h-full w-full object-cover" alt="" />` : ""}</div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-base font-semibold text-white">${escapeHtml(title.title)}</div>
            <div class="mt-1 text-xs app-muted">${escapeHtml(title.npwr)} &middot; ${escapeHtml(title.platform)} &middot; ${format(planned.length)}/${format(title.trophies.length)} planned &middot; ${format(title.counts.total)} trophies &middot; ${countText(title.counts)}</div>
          </div>
          <button class="rounded-lg border border-rose-300/20 bg-rose-400/10 px-2 py-1 text-xs font-semibold text-rose-100" data-remove-title="${escapeHtml(title.npwr)}" type="button">Remove</button>
        </div>
        ${collapsed ? "" : `<div class="grid gap-2">${trophyRows || `<div class="rounded-lg border border-dashed border-white/10 p-3 text-sm app-muted">No trophies match this filter.</div>`}</div>`}
      </article>
    `;
  }).join("");
}

function markSearchResultAdded(npwr) {
  const button = [...els.results.querySelectorAll("[data-add-title]")].find((item) => item.dataset.addTitle === npwr);
  if (!button) return;
  button.textContent = "Added";
  button.disabled = true;
  button.className = "cursor-not-allowed rounded-lg bg-slate-700 px-2 py-1 text-xs font-bold text-slate-400";
}

async function searchCatalog(query) {
  els.results.innerHTML = `<div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm app-muted">Searching...</div>`;
  const response = await fetch(`/api/planner-search.php?q=${encodeURIComponent(query)}&limit=25`);
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "Search failed");

  if (!payload.results.length) {
    els.results.innerHTML = `<div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm app-muted">No titles found.</div>`;
    return;
  }

  els.results.innerHTML = payload.results.map((item) => `
    <article class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-2">
      <div class="h-11 w-11 overflow-hidden rounded-md bg-slate-800">${item.iconUrl ? `<img src="${escapeHtml(item.iconUrl)}" class="h-full w-full object-cover" alt="" />` : ""}</div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold text-white">${escapeHtml(item.title)}</div>
        <div class="text-xs app-muted">${escapeHtml(item.npwr)} &middot; ${escapeHtml(item.platform)} &middot; ${format(item.counts.total)} trophies &middot; ${countText(item.counts)}</div>
      </div>
      <button
        class="rounded-lg px-2 py-1 text-xs font-bold ${state.titles.has(item.npwr) ? "cursor-not-allowed bg-slate-700 text-slate-400" : "bg-cyan-300 text-slate-950"}"
        data-add-title="${escapeHtml(item.npwr)}"
        type="button"
        ${state.titles.has(item.npwr) ? "disabled" : ""}
      >${state.titles.has(item.npwr) ? "Added" : "Add"}</button>
    </article>
  `).join("");
}

async function addTitle(npwr) {
  if (state.titles.has(npwr)) {
    markSearchResultAdded(npwr);
    renderPlanner();
    return;
  }

  const response = await fetch(`/api/planner-title.php?npwr=${encodeURIComponent(npwr)}`);
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "Title load failed");
  const title = payload.title;
  state.titles.set(title.npwr, {
    ...title,
    selectedIds: title.trophies.map((trophy) => trophy.id),
  });
  state.expanded.delete(title.npwr);
  persist();
  renderPlanner();
  markSearchResultAdded(title.npwr);
  const query = els.search.value.trim();
  if (query) searchCatalog(query).catch(() => {});
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = els.search.value.trim();
  if (query) searchCatalog(query).catch((error) => {
    els.results.innerHTML = `<div class="rounded-lg border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">${escapeHtml(error.message)}</div>`;
  });
});

els.results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add-title]");
  if (!button) return;
  button.textContent = "Adding...";
  button.disabled = true;
  button.className = "cursor-wait rounded-lg bg-slate-700 px-2 py-1 text-xs font-bold text-slate-300";
  addTitle(button.dataset.addTitle).catch((error) => alert(error.message));
});

els.list.addEventListener("change", (event) => {
  const input = event.target.closest("[data-toggle-trophy]");
  if (!input) return;
  const title = state.titles.get(input.dataset.toggleTrophy);
  if (!title) return;
  const trophyId = Number(input.dataset.trophyId);
  title.selectedIds = input.checked
    ? [...new Set([...title.selectedIds, trophyId])]
    : title.selectedIds.filter((id) => id !== trophyId);
  persist();
  renderPlanner();
});

els.list.addEventListener("click", (event) => {
  const toggleButton = event.target.closest("[data-toggle-title]");
  if (toggleButton) {
    const npwr = toggleButton.dataset.toggleTitle;
    if (state.expanded.has(npwr)) {
      state.expanded.delete(npwr);
    } else {
      state.expanded.add(npwr);
    }
    persist();
    renderPlanner();
    return;
  }

  const button = event.target.closest("[data-remove-title]");
  if (!button) return;
  state.titles.delete(button.dataset.removeTitle);
  state.expanded.delete(button.dataset.removeTitle);
  persist();
  renderPlanner();
  const query = els.search.value.trim();
  if (query) searchCatalog(query).catch(() => {});
});

els.filter.addEventListener("change", () => {
  state.filter = els.filter.value;
  renderPlanner();
});

els.clearButton.addEventListener("click", () => {
  if (!confirm("Clear the current trophy plan?")) return;
  state.titles.clear();
  state.expanded.clear();
  persist();
  renderPlanner();
});

els.exportButton.addEventListener("click", () => {
  const blob = new Blob([localStorage.getItem(STORAGE_KEY) || "{}"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "trophy-plan.json";
  link.click();
  URL.revokeObjectURL(url);
});

els.importButton.addEventListener("click", () => els.importFile.click());
els.importFile.addEventListener("change", async () => {
  const file = els.importFile.files?.[0];
  if (!file) return;
  const payload = JSON.parse(await file.text());
  state.titles.clear();
  state.expanded = new Set(payload.expanded || []);
  for (const title of payload.titles || []) state.titles.set(title.npwr, title);
  persist();
  renderPlanner();
  els.importFile.value = "";
});

restore();
renderPlanner();
