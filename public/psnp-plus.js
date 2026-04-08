const versionEl = document.getElementById("psnp-version");
const totalEl = document.getElementById("psnp-total");
const visibleEl = document.getElementById("psnp-visible");
const lastUpdateEl = document.getElementById("psnp-last-update");
const searchEl = document.getElementById("psnp-search");
const platformEl = document.getElementById("psnp-platform");
const listEl = document.getElementById("psnp-list");

let entries = [];

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function populatePlatforms(items) {
  const platforms = new Set();
  for (const item of items) {
    for (const platform of item.platforms) {
      platforms.add(platform);
    }
  }

  platformEl.innerHTML = '<option value="">All Platforms</option>';

  Array.from(platforms)
    .sort()
    .forEach((platform) => {
      const option = document.createElement("option");
      option.value = platform;
      option.textContent = platform;
      platformEl.appendChild(option);
    });
}

function render(entriesToRender) {
  visibleEl.textContent = formatNumber(entriesToRender.length);

  if (!entriesToRender.length) {
    listEl.innerHTML = '<div class="empty-state">No games matched those filters.</div>';
    return;
  }

  listEl.innerHTML = entriesToRender
    .map(
      (entry) => `
        <article class="psnp-card">
          <div class="psnp-card__topline">
            <span class="psnp-card__id">#${escapeHtml(entry.id)}</span>
            <span class="psnp-card__timestamp">${escapeHtml(formatDate(entry.timestamp))}</span>
          </div>
          <h2>${escapeHtml(entry.title)}</h2>
          <div class="psnp-card__meta">
            ${entry.platforms
              .map((platform) => `<span class="platform-pill">${escapeHtml(platform)}</span>`)
              .join("")}
            <span class="psnp-chip">Trophies ${formatNumber(entry.trophies.length)}</span>
            <span class="psnp-chip">Submitter ${escapeHtml(entry.submitter || "Unknown")}</span>
            <span class="psnp-chip">Region ${escapeHtml(entry.region || "Unknown")}</span>
          </div>
          <p class="psnp-card__note">${escapeHtml(entry.note || "No note provided.")}</p>
          <div class="psnp-card__footer">
            <span>Flagged trophy indexes: ${entry.trophies.map((value) => escapeHtml(value)).join(", ")}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function applyFilters() {
  const query = searchEl.value.trim().toLowerCase();
  const platform = platformEl.value;

  const filtered = entries.filter((entry) => {
    const queryMatch =
      !query ||
      entry.title.toLowerCase().includes(query) ||
      entry.note.toLowerCase().includes(query) ||
      entry.submitter.toLowerCase().includes(query) ||
      entry.region.toLowerCase().includes(query);

    const platformMatch = !platform || entry.platforms.includes(platform);
    return queryMatch && platformMatch;
  });

  render(filtered);
}

async function loadDataset() {
  versionEl.textContent = "Loading Dataset";

  const response = await fetch("/api/psnp-plus");
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.detail || payload.error || "Failed to load PSNP+ dataset");
  }

  entries = Object.entries(payload.list || {})
    .map(([id, value]) => ({
      id,
      title: value.title || `Entry ${id}`,
      platforms: value.platforms || [],
      submitter: value.submitter || "Unknown",
      note: value.note || "",
      trophies: value.trophies || [],
      region: value.region || "Unknown",
      timestamp: value.timestamp || null,
    }))
    .sort((left, right) => {
      const leftTime = left.timestamp || 0;
      const rightTime = right.timestamp || 0;
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return left.title.localeCompare(right.title);
    });

  totalEl.textContent = formatNumber(entries.length);
  lastUpdateEl.textContent = entries[0]?.timestamp ? formatDate(entries[0].timestamp) : "Unknown";
  versionEl.textContent = `Dataset v${payload.version || "?"}`;

  populatePlatforms(entries);
  applyFilters();
}

searchEl.addEventListener("input", applyFilters);
platformEl.addEventListener("change", applyFilters);

loadDataset().catch((error) => {
  versionEl.textContent = "Load Failed";
  listEl.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
