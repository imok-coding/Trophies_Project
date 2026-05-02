const form = document.getElementById("psn-user-search-form");
const input = document.getElementById("psn-user-search");
const results = document.getElementById("psn-user-results");
const titlesPanel = document.getElementById("psn-user-titles");
const state = { user: null, titles: [] };

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

function renderMessage(target, message, error = false) {
  target.innerHTML = `<div class="rounded-lg border ${error ? "border-rose-300/20 bg-rose-400/10 text-rose-100" : "border-white/10 bg-white/[0.04] app-muted"} p-4 text-sm">${escapeHtml(message)}</div>`;
}

function trophyIcon(type, size = "h-5 w-5") {
  const icons = {
    platinum: ["470bd2.png", "P"],
    gold: ["7186c5.png", "G"],
    silver: ["f179ed.png", "S"],
    bronze: ["e61e35.png", "B"],
  };
  const [file, alt] = icons[type] || icons.bronze;
  return `<img src="/assets/trophy/${file}" alt="${alt}" class="inline-block ${size} align-[-4px]" loading="lazy" />`;
}

function trophyCount(value, type, size = "h-5 w-5") {
  return `<span class="inline-flex items-center gap-1 font-semibold text-white">${format(value)}${trophyIcon(type, size)}</span>`;
}

function aggregateTitles(titles) {
  const totals = {
    defined: { platinum: 0, gold: 0, silver: 0, bronze: 0, total: 0 },
    earned: { platinum: 0, gold: 0, silver: 0, bronze: 0, total: 0 },
  };

  for (const title of titles) {
    for (const type of ["platinum", "gold", "silver", "bronze", "total"]) {
      totals.defined[type] += Number(title.defined?.[type] || 0);
      totals.earned[type] += Number(title.earned?.[type] || 0);
    }
  }

  return totals;
}

function completionPercent(totals) {
  if (!totals.defined.total) return 0;
  return Math.round((totals.earned.total / totals.defined.total) * 10000) / 100;
}

function completedGames(titles) {
  return titles.filter((title) => Number(title.progress || 0) >= 100).length;
}

function latestActivity(titles) {
  const latest = titles.find((title) => title.lastUpdatedDateTime);
  if (!latest) return "No trophy activity";
  const date = new Date(latest.lastUpdatedDateTime);
  if (Number.isNaN(date.getTime())) return "Recent trophy activity";
  return `${escapeHtml(latest.title || latest.npwr)} - ${date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
}

function platformBadge(platform) {
  if (!platform) return "";
  return `<span class="rounded border border-cyan-200/20 bg-cyan-300/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-100">${escapeHtml(platform)}</span>`;
}

function titleTrophyText(title) {
  const earned = title.earned?.total ?? 0;
  const total = title.defined?.total ?? 0;
  return `${format(earned)}/${format(total)} trophies`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function titleBreakdown(counts = {}) {
  return `
    ${trophyCount(counts.platinum || 0, "platinum")}
    ${trophyCount(counts.gold || 0, "gold")}
    ${trophyCount(counts.silver || 0, "silver")}
    ${trophyCount(counts.bronze || 0, "bronze")}
  `;
}

function titleCard(title, detail) {
  return `
    <aside class="app-panel overflow-hidden self-start">
      <div class="grid h-44 place-items-center overflow-hidden bg-slate-950 p-4">
        ${title.iconUrl ? `<img src="${escapeHtml(title.iconUrl)}" class="max-h-full max-w-full object-contain" alt="" loading="lazy" />` : ""}
      </div>
      <div class="border-t border-white/10 p-4">
        <h3 class="text-lg font-semibold text-white">${escapeHtml(title.title || title.npwr)}</h3>
        <div class="mt-2 flex flex-wrap items-center gap-2 text-xs app-muted">
          ${platformBadge(title.platform)}
          <span>${escapeHtml(title.npwr)}</span>
          <span>${format(detail.progress)}%</span>
        </div>
        <div class="mt-3 flex flex-wrap gap-3 text-sm app-muted">${titleBreakdown(detail.defined)}</div>
      </div>
      <div class="divide-y divide-white/10 border-t border-white/10 text-sm">
        <div class="flex items-center justify-between gap-3 px-4 py-3"><span class="app-muted">Earned trophies</span><span class="font-semibold text-white">${format(detail.earned.total)}/${format(detail.defined.total)}</span></div>
        <div class="flex items-center justify-between gap-3 px-4 py-3"><span class="app-muted">Service</span><span class="font-semibold text-white">${escapeHtml(detail.service)}</span></div>
        <div class="flex items-center justify-between gap-3 px-4 py-3"><span class="app-muted">Last updated</span><span class="font-semibold text-white">${formatDateTime(title.lastUpdatedDateTime) || "Unknown"}</span></div>
      </div>
    </aside>
  `;
}

function trophyRow(trophy) {
  const earnedDate = formatDateTime(trophy.earnedDateTime);
  return `
    <article class="grid gap-3 border-b border-white/10 p-3 transition ${trophy.earned ? "bg-emerald-400/[0.08] hover:bg-emerald-400/[0.12]" : "hover:bg-white/[0.04]"} sm:grid-cols-[4rem_1fr_auto] sm:items-center">
      <div class="grid h-14 w-14 place-items-center overflow-hidden rounded-lg bg-slate-950 p-1 ring-1 ${trophy.earned ? "ring-emerald-300/40" : "ring-white/10"}">
        ${trophy.iconUrl ? `<img src="${escapeHtml(trophy.iconUrl)}" class="max-h-full max-w-full object-contain" alt="" loading="lazy" />` : ""}
      </div>
      <div class="min-w-0">
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <span class="truncate text-[15px] font-semibold ${trophy.earned ? "text-emerald-100" : "text-white"}">${escapeHtml(trophy.name || "Hidden Trophy")}</span>
          ${trophy.hidden ? `<span class="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold uppercase app-muted">Secret</span>` : ""}
        </div>
        <div class="mt-1 text-sm app-muted">${escapeHtml(trophy.detail || "")}</div>
        ${earnedDate ? `<div class="mt-1 text-xs text-emerald-300">Earned ${earnedDate}</div>` : ""}
      </div>
      <div class="flex items-center gap-3 sm:justify-end">
        ${trophy.earned ? `<span class="text-xl text-emerald-300">✓</span>` : `<span class="text-xl app-faint">—</span>`}
        ${trophyIcon(trophy.type, "h-7 w-7")}
      </div>
    </article>
  `;
}

function trophyGroupSections(detail, title) {
  const trophiesByGroup = new Map();
  for (const trophy of detail.trophies || []) {
    const groupId = trophy.groupId || "default";
    if (!trophiesByGroup.has(groupId)) trophiesByGroup.set(groupId, []);
    trophiesByGroup.get(groupId).push(trophy);
  }

  const groups = detail.groups?.length
    ? detail.groups
    : Array.from(trophiesByGroup.keys()).map((groupId) => ({
        id: groupId,
        name: groupId === "default" ? "Base Game" : `DLC ${groupId}`,
        iconUrl: "",
        defined: {},
        earned: {},
      }));

  return groups
    .filter((group) => trophiesByGroup.has(group.id))
    .map((group) => {
      const trophies = trophiesByGroup.get(group.id) || [];
      const earnedCount = trophies.filter((trophy) => trophy.earned).length;
      const groupIcon = group.iconUrl || (group.id === "default" ? title.iconUrl : "");
      const groupLabel = group.id === "default" ? "Base Game" : "DLC";

      return `
        <section class="overflow-hidden rounded-lg border border-white/10">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3">
            <div class="flex min-w-0 items-center gap-3">
              <div class="grid h-14 w-14 flex-shrink-0 place-items-center overflow-hidden rounded bg-slate-950 p-1">
                ${groupIcon ? `<img src="${escapeHtml(groupIcon)}" class="max-h-full max-w-full object-contain" alt="" loading="lazy" />` : ""}
              </div>
              <div class="min-w-0">
                <div class="text-[10px] font-bold uppercase tracking-wide ${group.id === "default" ? "text-cyan-100" : "text-violet-100"}">${groupLabel}</div>
                <div class="truncate font-semibold text-white">${escapeHtml(group.name || (group.id === "default" ? "Base Game" : `DLC ${group.id}`))}</div>
                <div class="text-sm app-muted">${format(earnedCount)} of ${format(trophies.length)} trophies</div>
              </div>
            </div>
            <div class="flex flex-wrap gap-3 text-sm app-muted">${titleBreakdown(group.earned || {})}</div>
          </div>
          <div>${trophies.map(trophyRow).join("")}</div>
        </section>
      `;
    })
    .join("");
}

function renderTitleDetail(user, title, detail) {
  const baseTrophies = detail.trophies.filter((trophy) => trophy.groupId === "default");
  const dlcTrophies = detail.trophies.filter((trophy) => trophy.groupId !== "default");
  const earnedBase = baseTrophies.filter((trophy) => trophy.earned).length;

  titlesPanel.innerHTML = `
    <section class="space-y-4">
      <div class="app-panel overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-cyan-300/10 px-4 py-3">
          <div class="min-w-0">
            <div class="text-xs font-semibold uppercase tracking-wide app-faint">
              <button class="text-cyan-200 hover:text-cyan-100" data-back-to-titles type="button">${escapeHtml(user.onlineId)}</button>
              <span class="mx-2">›</span>
              <span class="text-white">${escapeHtml(title.title || title.npwr)}</span>
            </div>
          </div>
          <button class="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/[0.10]" data-back-to-titles type="button">Back to lists</button>
        </div>
        <div class="grid gap-4 p-4 lg:grid-cols-[1fr_20rem]">
          <div>
            <div class="mb-3 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div class="h-14 w-14 overflow-hidden rounded-lg bg-slate-900">${user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" class="h-full w-full object-cover" alt="" loading="lazy" />` : ""}</div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-semibold text-white">${escapeHtml(user.onlineId)}</div>
                <div class="mt-1 text-xs app-muted">${format(detail.earned.total)} of ${format(detail.defined.total)} trophies earned</div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-semibold text-white">${format(detail.progress)}%</div>
                <div class="text-[10px] font-bold uppercase tracking-wide app-faint">Complete</div>
              </div>
            </div>

            <div class="overflow-hidden rounded-lg border border-white/10">
              <div class="border-b border-white/10 bg-cyan-300/10 px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-cyan-100">
                ${escapeHtml(title.title || title.npwr)} Trophies
              </div>
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3">
                <div class="flex items-center gap-3">
                  <div class="grid h-14 w-14 place-items-center overflow-hidden rounded bg-slate-950 p-1">
                    ${title.iconUrl ? `<img src="${escapeHtml(title.iconUrl)}" class="max-h-full max-w-full object-contain" alt="" loading="lazy" />` : ""}
                  </div>
                  <div>
                    <div class="font-semibold text-white">Base Game</div>
                    <div class="text-sm app-muted">${format(earnedBase)} of ${format(baseTrophies.length)} trophies</div>
                  </div>
                </div>
                <div class="flex flex-wrap gap-3 text-sm app-muted">${titleBreakdown(detail.earned)}</div>
              </div>
              <div class="space-y-4 p-3">${trophyGroupSections(detail, title)}</div>
              ${dlcTrophies.length ? `<div class="border-t border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-bold uppercase tracking-wide app-faint">${format(dlcTrophies.length)} DLC trophies separated below Base Game</div>` : ""}
            </div>
          </div>
          ${titleCard(title, detail)}
        </div>
      </div>
    </section>
  `;

  for (const button of titlesPanel.querySelectorAll("[data-back-to-titles]")) {
    button.addEventListener("click", () => renderTitles(state.user, state.titles));
  }
  titlesPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadTitleDetail(title) {
  if (!state.user) return;
  titlesPanel.innerHTML = `<div class="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm app-muted">Loading ${escapeHtml(title.title || title.npwr)} trophies...</div>`;
  const response = await fetch(`/api/psn-user-title.php?accountId=${encodeURIComponent(state.user.accountId)}&npwr=${encodeURIComponent(title.npwr)}&service=${encodeURIComponent(title.service || "trophy2")}`);
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "Could not load trophy list.");
  renderTitleDetail(state.user, title, payload.title);
}

function renderProfile(user, titles) {
  const totals = aggregateTitles(titles);
  const completion = completionPercent(totals);
  const completed = completedGames(titles);

  results.innerHTML = `
    <section class="relative overflow-hidden rounded-lg border border-cyan-300/15 bg-slate-950 shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_78%_8%,rgba(56,189,248,0.14),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))]"></div>
      <div class="relative p-4 sm:p-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div class="flex min-w-0 items-center gap-4">
            <div class="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-900 ring-1 ring-white/15">
              ${user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" class="h-full w-full object-cover" alt="" loading="lazy" />` : ""}
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                ${user.country ? `<span class="rounded border border-white/10 bg-white/[0.08] px-2 py-1 text-xs font-bold uppercase text-white">${escapeHtml(user.country)}</span>` : ""}
                ${user.isPsPlus ? `<span class="rounded border border-amber-200/20 bg-amber-300/10 px-2 py-1 text-xs font-bold uppercase text-amber-100">PS+</span>` : ""}
                ${user.isVerified ? `<span class="rounded border border-cyan-200/20 bg-cyan-300/10 px-2 py-1 text-xs font-bold uppercase text-cyan-100">Verified</span>` : ""}
              </div>
              <h2 class="mt-2 truncate text-3xl font-semibold tracking-tight text-white sm:text-4xl">${escapeHtml(user.onlineId)}</h2>
              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs app-muted">
                <span class="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]">${escapeHtml(user.accountId)}</span>
                ${user.verifiedUserName ? `<span>${escapeHtml(user.verifiedUserName)}</span>` : ""}
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 md:min-w-[31rem]">
            <div class="rounded-lg border border-white/10 bg-black/25 p-3">
              <div class="text-[10px] font-bold uppercase tracking-wide app-faint">Games Played</div>
              <div class="mt-1 text-2xl font-semibold text-white">${format(titles.length)}</div>
            </div>
            <div class="rounded-lg border border-white/10 bg-black/25 p-3">
              <div class="text-[10px] font-bold uppercase tracking-wide app-faint">Completed</div>
              <div class="mt-1 text-2xl font-semibold text-white">${format(completed)}</div>
            </div>
            <div class="rounded-lg border border-white/10 bg-black/25 p-3">
              <div class="text-[10px] font-bold uppercase tracking-wide app-faint">Completion</div>
              <div class="mt-1 text-2xl font-semibold text-white">${format(completion)}%</div>
            </div>
            <div class="rounded-lg border border-white/10 bg-black/25 p-3">
              <div class="text-[10px] font-bold uppercase tracking-wide app-faint">Earned</div>
              <div class="mt-1 text-2xl font-semibold text-white">${format(totals.earned.total)}</div>
            </div>
          </div>
        </div>

        <div class="mt-5 border-y border-white/10 bg-black/20 px-3 py-3">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div class="text-[11px] font-bold uppercase tracking-wide app-faint">All Earned Trophies</div>
              <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-lg">
                ${trophyCount(totals.earned.platinum, "platinum", "h-6 w-6")}
                ${trophyCount(totals.earned.gold, "gold", "h-6 w-6")}
                ${trophyCount(totals.earned.silver, "silver", "h-6 w-6")}
                ${trophyCount(totals.earned.bronze, "bronze", "h-6 w-6")}
              </div>
            </div>
            <div class="text-sm app-muted lg:text-right">
              <div class="font-semibold text-white">Latest activity</div>
              <div class="mt-1">${latestActivity(titles)}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderTitles(user, titles) {
  if (!titles.length) {
    renderMessage(titlesPanel, `${user.onlineId} has no visible trophy titles.`);
    return;
  }

  titlesPanel.innerHTML = `
    <section class="grid gap-5 xl:grid-cols-[1fr_22rem]">
      <div class="app-panel overflow-hidden">
        <div class="flex items-center justify-between border-b border-white/10 bg-cyan-300/10 px-4 py-3">
          <h2 class="text-sm font-bold uppercase tracking-wide text-cyan-100">Trophy Lists</h2>
          <span class="text-xs app-faint">${format(titles.length)} shown</span>
        </div>
        <div class="divide-y divide-white/10">
          ${titles.map((title) => `
            <article class="flex cursor-pointer gap-3 p-3 transition hover:bg-white/[0.04]" data-title-detail="${escapeHtml(title.npwr)}" role="button" tabindex="0" aria-label="View ${escapeHtml(title.title || title.npwr)} trophies">
              <div class="grid h-20 w-20 flex-shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-900 p-1 ring-1 ring-white/10">
                ${title.iconUrl ? `<img src="${escapeHtml(title.iconUrl)}" class="max-h-full max-w-full object-contain" alt="" loading="lazy" />` : ""}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                  <div class="min-w-0 flex-1 truncate text-[15px] font-semibold text-white">${escapeHtml(title.title || title.npwr)}</div>
                  ${platformBadge(title.platform)}
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-2 text-xs app-muted">
                  <span class="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]">${escapeHtml(title.npwr)}</span>
                  <span>${titleTrophyText(title)}</span>
                  <span>${format(title.progress)}%</span>
                </div>
                <div class="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                  <div class="h-full rounded-full bg-cyan-300" style="width: ${Math.max(0, Math.min(100, Number(title.progress || 0)))}%"></div>
                </div>
                <div class="mt-2 flex flex-wrap gap-3 text-[11px] app-faint">
                  <span class="inline-flex items-center gap-1 text-sm font-semibold">${format(title.earned?.platinum || 0)}/${format(title.defined?.platinum || 0)}${trophyIcon("platinum")}</span>
                  <span class="inline-flex items-center gap-1 text-sm font-semibold">${format(title.earned?.gold || 0)}/${format(title.defined?.gold || 0)}${trophyIcon("gold")}</span>
                  <span class="inline-flex items-center gap-1 text-sm font-semibold">${format(title.earned?.silver || 0)}/${format(title.defined?.silver || 0)}${trophyIcon("silver")}</span>
                  <span class="inline-flex items-center gap-1 text-sm font-semibold">${format(title.earned?.bronze || 0)}/${format(title.defined?.bronze || 0)}${trophyIcon("bronze")}</span>
                </div>
                <button class="mt-3 rounded-lg border border-cyan-200/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/20" type="button" data-title-detail-button="${escapeHtml(title.npwr)}">View trophies</button>
              </div>
            </article>
          `).join("")}
        </div>
      </div>

      <aside class="app-panel overflow-hidden self-start">
        <div class="border-b border-white/10 bg-cyan-300/10 px-4 py-3">
          <h2 class="text-sm font-bold uppercase tracking-wide text-cyan-100">Profile Totals</h2>
        </div>
        <div class="space-y-3 p-4 text-sm">
          <div class="flex items-center justify-between gap-3"><span class="app-muted">Earned trophies</span><span class="font-semibold text-white">${format(aggregateTitles(titles).earned.total)}</span></div>
          <div class="flex items-center justify-between gap-3"><span class="app-muted">Available trophies</span><span class="font-semibold text-white">${format(aggregateTitles(titles).defined.total)}</span></div>
          <div class="flex items-center justify-between gap-3"><span class="app-muted">Completed lists</span><span class="font-semibold text-white">${format(completedGames(titles))}</span></div>
          <div class="flex items-center justify-between gap-3"><span class="app-muted">Average completion</span><span class="font-semibold text-white">${format(completionPercent(aggregateTitles(titles)))}%</span></div>
        </div>
      </aside>
    </section>
  `;

  for (const item of titlesPanel.querySelectorAll("[data-title-detail]")) {
    const open = () => {
      const title = titles.find((candidate) => candidate.npwr === item.dataset.titleDetail);
      if (!title) return;
      loadTitleDetail(title).catch((error) => renderMessage(titlesPanel, error.message || "Could not load trophy list.", true));
    };
    item.addEventListener("click", open);
    item.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    });
  }
}

async function loadProfile(user) {
  renderMessage(results, `Loading ${user.onlineId}'s trophy profile...`);
  titlesPanel.innerHTML = "";
  const response = await fetch(`/api/psn-user-titles.php?accountId=${encodeURIComponent(user.accountId)}&limit=800`);
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "Could not load trophy list.");
  const titles = payload.titles || [];
  state.user = user;
  state.titles = titles;
  renderProfile(user, titles);
  renderTitles(user, titles);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) return;

  renderMessage(results, "Looking up PSN user...");
  titlesPanel.innerHTML = "";
  try {
    const response = await fetch(`/api/psn-user-search.php?q=${encodeURIComponent(query)}`);
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || "User does not exist");
    const user = payload.user || (payload.results || [])[0];
    if (!user) throw new Error("User does not exist");
    await loadProfile(user);
  } catch (error) {
    renderMessage(results, error.message || "PSN search failed.", true);
  }
});
