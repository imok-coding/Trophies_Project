const form = document.getElementById("psn-user-search-form");
const input = document.getElementById("psn-user-search");
const results = document.getElementById("psn-user-results");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMessage(message, error = false) {
  results.innerHTML = `<div class="rounded-lg border ${error ? "border-rose-300/20 bg-rose-400/10 text-rose-100" : "border-white/10 bg-white/[0.04] app-muted"} p-4 text-sm">${escapeHtml(message)}</div>`;
}

function renderUsers(users) {
  if (!users.length) {
    renderMessage("No PSN users found.");
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
    </article>
  `).join("");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) return;

  renderMessage("Searching PSN...");
  try {
    const response = await fetch(`/api/psn-user-search.php?q=${encodeURIComponent(query)}`);
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || "PSN search failed.");
    renderUsers(payload.results || []);
  } catch (error) {
    renderMessage(error.message || "PSN search failed.", true);
  }
});
