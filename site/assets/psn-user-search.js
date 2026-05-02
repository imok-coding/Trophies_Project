const form = document.getElementById("psn-user-search-form");
const input = document.getElementById("psn-user-search");
const results = document.getElementById("psn-user-results");
const titlesPanel = document.getElementById("psn-user-titles");

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

function titleTrophyText(title) {
  const earned = title.earned?.total ?? 0;
  const total = title.defined?.total ?? 0;
  return `${format(earned)}/${format(total)} trophies`;
}

function trophyLetter(type) {
  const classes = {
    platinum: "text-sky-200",
    gold: "text-amber-300",
    silver: "text-slate-200",
    bronze: "text-orange-300",
  };
  return `<span class="font-bold ${classes[type] || "text-slate-200"}">${type[0].toUpperCase()}</span>`;
}

function renderTitles(user, titles) {
  if (!titles.length) {
    renderMessage(titlesPanel, `${user.onlineId} has no visible trophy titles.`);
    return;
  }

  titlesPanel.innerHTML = `
    <section class="app-panel overflow-hidden">
      <div class="flex items-center justify-between border-b border-white/10 bg-cyan-300/10 px-4 py-3">
        <h2 class="text-sm font-bold uppercase tracking-wide text-cyan-100">${escapeHtml(user.onlineId)} Trophy List</h2>
        <span class="text-xs app-faint">${format(titles.length)} shown</span>
      </div>
      <div class="divide-y divide-white/10">
        ${titles.map((title) => `
          <article class="flex gap-3 p-3">
            <div class="grid h-16 w-16 flex-shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-900 p-1 ring-1 ring-white/10">
              ${title.iconUrl ? `<img src="${escapeHtml(title.iconUrl)}" class="max-h-full max-w-full object-contain" alt="" loading="lazy" />` : ""}
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[15px] font-semibold text-white">${escapeHtml(title.title || title.npwr)}</div>
              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs app-muted">
                <span class="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]">${escapeHtml(title.npwr)}</span>
                ${title.platform ? `<span>${escapeHtml(title.platform)}</span>` : ""}
                <span>${titleTrophyText(title)}</span>
                <span>${format(title.progress)}%</span>
              </div>
              <div class="mt-2 flex flex-wrap gap-2 text-[11px] app-faint">
                <span>${trophyLetter("platinum")} ${format(title.earned?.platinum || 0)}/${format(title.defined?.platinum || 0)}</span>
                <span>${trophyLetter("gold")} ${format(title.earned?.gold || 0)}/${format(title.defined?.gold || 0)}</span>
                <span>${trophyLetter("silver")} ${format(title.earned?.silver || 0)}/${format(title.defined?.silver || 0)}</span>
                <span>${trophyLetter("bronze")} ${format(title.earned?.bronze || 0)}/${format(title.defined?.bronze || 0)}</span>
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

async function loadTitles(user) {
  renderMessage(titlesPanel, `Loading ${user.onlineId}'s trophy list...`);
  const response = await fetch(`/api/psn-user-titles.php?accountId=${encodeURIComponent(user.accountId)}&limit=100`);
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "Could not load trophy list.");
  renderTitles(user, payload.titles || []);
}

function renderUsers(users) {
  titlesPanel.innerHTML = "";
  if (!users.length) {
    renderMessage(results, "User does not exist", true);
    return;
  }

  results.innerHTML = users.map((user) => `
    <article class="app-cell flex items-center gap-3 p-3">
      <div class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-slate-800">
        ${user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" class="h-full w-full object-cover" alt="" loading="lazy" />` : ""}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-2">
          <div class="truncate text-[15px] font-semibold text-white">${escapeHtml(user.onlineId)}</div>
          ${user.isPsPlus ? `<span class="rounded border border-amber-200/20 bg-amber-300/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-100">PS+</span>` : ""}
          ${user.isVerified ? `<span class="rounded border border-cyan-200/20 bg-cyan-300/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-100">Verified</span>` : ""}
        </div>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-xs app-muted">
          <span class="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]">${escapeHtml(user.accountId)}</span>
          ${user.country ? `<span>${escapeHtml(user.country)}</span>` : ""}
          ${user.verifiedUserName ? `<span>${escapeHtml(user.verifiedUserName)}</span>` : ""}
        </div>
      </div>
      <button
        class="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-200"
        data-view-titles="${escapeHtml(user.accountId)}"
        type="button"
      >Trophies</button>
    </article>
  `).join("");

  for (const button of results.querySelectorAll("[data-view-titles]")) {
    button.addEventListener("click", () => {
      const user = users.find((item) => item.accountId === button.dataset.viewTitles);
      if (!user) return;
      loadTitles(user).catch((error) => renderMessage(titlesPanel, error.message || "Could not load trophy list.", true));
    });
  }

  if (users[0]) loadTitles(users[0]).catch((error) => renderMessage(titlesPanel, error.message || "Could not load trophy list.", true));
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
    if (!payload.ok) throw new Error(payload.error || "PSN search failed.");
    renderUsers(payload.results || []);
  } catch (error) {
    renderMessage(results, error.message || "PSN search failed.", true);
  }
});
