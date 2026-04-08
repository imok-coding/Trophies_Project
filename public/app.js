const REFRESH_INTERVAL_MS = 5000;

const catalogGridEl = document.getElementById("catalog-grid");
const titleFilterEl = document.getElementById("title-filter");
const regionFilterEl = document.getElementById("region-filter");
const playerImportFormEl = document.getElementById("player-import-form");
const playerImportInputEl = document.getElementById("player-import-input");
const playerImportButtonEl = document.getElementById("player-import-button");
const playerImportStatusEl = document.getElementById("player-import-status");
const selectedCardEl = document.getElementById("selected-card");
const trophyGroupsEl = document.getElementById("trophy-groups");
const trophyListingEl = document.getElementById("trophy-listing");
const savedCountEl = document.getElementById("saved-count");
const lastNpwrEl = document.getElementById("last-npwr");
const scanRangeEl = document.getElementById("scan-range");
const etaRemainingEl = document.getElementById("eta-remaining");
const scanStatusPillEl = document.getElementById("scan-status-pill");
const lastRefreshEl = document.getElementById("last-refresh");

let catalog = [];
let currentTitleId = "";
let activeQuery = "";
let activeRegion = "all";
let searchTimeout = null;
let isImportingPlayer = false;

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "Less than 1m";
  }

  const totalMinutes = Math.round(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || !parts.length) parts.push(`${minutes}m`);

  return parts.join(" ");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTrophyCountBadges(counts) {
  return `
    <span class="trophy-count trophy-count--platinum">P ${formatNumber(counts.platinum || 0)}</span>
    <span class="trophy-count trophy-count--gold">G ${formatNumber(counts.gold || 0)}</span>
    <span class="trophy-count trophy-count--silver">S ${formatNumber(counts.silver || 0)}</span>
    <span class="trophy-count trophy-count--bronze">B ${formatNumber(counts.bronze || 0)}</span>
  `;
}

function getPlatformCanvasClass(platform) {
  const normalized = String(platform || "").toUpperCase();

  if (normalized.includes("PS5")) {
    return "platform-canvas--ps5";
  }

  if (normalized.includes("PS4")) {
    return "platform-canvas--ps4";
  }

  return "platform-canvas--default";
}

function setScanSummary(progress, totalSaved) {
  savedCountEl.textContent = formatNumber(totalSaved);
  lastNpwrEl.textContent = progress?.lastScannedId || "None";

  let total = 0;
  let completed = 0;

  if (progress && Number.isFinite(progress.totalItems)) {
    total = Math.max(1, progress.totalItems);
    completed = Math.max(0, Math.min(total, progress.completedItems || 0));
  } else if (progress && Number.isFinite(progress.start) && Number.isFinite(progress.end)) {
    total = Math.max(1, progress.end - progress.start + 1);
    completed = Math.max(0, Math.min(total, (progress.nextIndex || progress.start) - progress.start));
  }

  if (total > 0) {
    const percent = Math.max(0, Math.min(100, (completed / total) * 100));
    scanRangeEl.textContent = `${percent.toFixed(2)}%`;

    const startedAt = progress.startedAt ? new Date(progress.startedAt).getTime() : NaN;
    const now = Date.now();
    const elapsed = Number.isFinite(startedAt) ? now - startedAt : NaN;
    const itemsPerMs =
      completed > 0 && Number.isFinite(elapsed) && elapsed > 0 ? completed / elapsed : 0;
    const remaining = Math.max(0, total - completed);

    if (itemsPerMs > 0 && remaining > 0) {
      etaRemainingEl.textContent = formatDuration(remaining / itemsPerMs);
    } else if (remaining === 0) {
      etaRemainingEl.textContent = "Complete";
    } else {
      etaRemainingEl.textContent = "Estimating...";
    }
  } else {
    scanRangeEl.textContent = "0%";
    etaRemainingEl.textContent = "Unknown";
  }

  if (!progress) {
    scanStatusPillEl.textContent = "Waiting For Scan Data";
    return;
  }

  scanStatusPillEl.textContent = `Valid ${formatNumber(totalSaved || progress.savedValidCount || 0)} | Invalid ${formatNumber(
    progress.invalidCount || 0
  )} | Errors ${formatNumber(progress.errorCount || 0)}`;
}

function setPlayerImportStatus(message, isError = false) {
  playerImportStatusEl.textContent = message;
  playerImportStatusEl.style.color = isError ? "#a23b2f" : "";
}

function renderRegionOptions(regions, selectedRegion) {
  const uniqueRegions = ["all", ...regions.filter((region) => region && region !== "all")];
  regionFilterEl.innerHTML = uniqueRegions
    .map((region) => {
      const label = region === "all" ? "All Regions" : region;
      const isSelected = String(region) === String(selectedRegion || "all");
      return `<option value="${escapeHtml(region)}"${isSelected ? " selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function renderCatalog(items) {
  if (!items.length) {
    catalogGridEl.innerHTML = `
      <div class="empty-state">
        No saved trophy lists yet. As soon as the scanner writes JSON files into
        <code>data/npwr/titles</code>, they will appear here automatically.
      </div>
    `;
    return;
  }

  catalogGridEl.innerHTML = items
    .map(
      (item) => `
        <button class="catalog-card ${getPlatformCanvasClass(item.titlePlatform)}${
          item.npCommunicationId === currentTitleId ? " is-selected" : ""
        }" data-title-id="${escapeHtml(
          item.npCommunicationId
        )}">
          <div class="catalog-card__media">
            ${
              item.titleIconUrl
                ? `<div class="catalog-media-frame"><img src="${escapeHtml(item.titleIconUrl)}" alt="${escapeHtml(
                    item.titleName
                  )}" loading="lazy" /></div>`
                : `<div class="catalog-card__placeholder catalog-media-frame">${escapeHtml(item.npCommunicationId)}</div>`
            }
          </div>
          <div class="catalog-card__body">
            <div class="catalog-card__topline">
              <span class="catalog-card__platform">${escapeHtml(item.titlePlatform)}</span>
              <span class="catalog-card__time">${escapeHtml(formatDate(item.updatedAt))}</span>
            </div>
            <h2>${escapeHtml(item.titleName)}</h2>
            <p class="catalog-card__id">${escapeHtml(item.npCommunicationId)}</p>
            <p class="catalog-card__region">Region: ${escapeHtml(item.region || "Unknown")}</p>
            <div class="catalog-card__counts">${renderTrophyCountBadges(item.definedTrophies)}</div>
            <p class="catalog-card__footer">
              ${formatNumber(item.totalTrophyCount)} trophies • ${formatNumber(item.trophyGroupCount)} group${
                item.trophyGroupCount === 1 ? "" : "s"
              }
            </p>
          </div>
        </button>
      `
    )
    .join("");
}

function renderSelectedTitle(title) {
  selectedCardEl.classList.remove("empty-state");
  const canvasClass = getPlatformCanvasClass(title.titlePlatform);
  selectedCardEl.innerHTML = `
    <div class="selected-card__header ${canvasClass}">
      ${
        title.titleIconUrl
          ? `<div class="selected-media-frame"><img src="${escapeHtml(title.titleIconUrl)}" alt="${escapeHtml(
              title.titleName
            )}" /></div>`
          : `<div class="selected-card__placeholder selected-media-frame">${escapeHtml(title.npCommunicationId)}</div>`
      }
      <div>
        <h2>${escapeHtml(title.titleName)}</h2>
        <p class="selected-card__meta">${escapeHtml(title.npCommunicationId)} • ${escapeHtml(
          title.titlePlatform
        )} • ${escapeHtml(title.npServiceName)}</p>
        <p class="selected-card__meta">Region: ${escapeHtml(title.region || "Unknown")}</p>
        <p class="selected-card__meta">Saved ${escapeHtml(
          formatDate(title.updatedAt || title.scannedAt)
        )}</p>
      </div>
    </div>
    ${title.titleDetail ? `<p class="selected-card__detail">${escapeHtml(title.titleDetail)}</p>` : ""}
    <div class="selected-card__stats">
      <span>${formatNumber(title.totalTrophyCount)} total trophies</span>
      ${renderTrophyCountBadges(title.definedTrophies)}
    </div>
  `;
}

function renderTrophyGroups(groups) {
  trophyGroupsEl.innerHTML = "";
}

function renderGroupedTrophyRows(groupTrophies) {
  return groupTrophies
    .map(
      (trophy) => `
        <article class="trophy-row">
          ${
            trophy.trophyIconUrl
              ? `<img src="${escapeHtml(trophy.trophyIconUrl)}" alt="${escapeHtml(
                  trophy.trophyName
                )}" loading="lazy" />`
              : `<div class="trophy-row__placeholder">${escapeHtml(trophy.trophyType || "")}</div>`
          }
          <div class="trophy-row__body">
            <div class="trophy-row__topline">
              <strong>${escapeHtml(trophy.trophyName || `Trophy ${trophy.trophyId}`)}</strong>
              <span class="trophy-type trophy-type--${escapeHtml(
                String(trophy.trophyType || "unknown").toLowerCase()
              )}">${escapeHtml(trophy.trophyType || "Unknown")}</span>
            </div>
            <p>${escapeHtml(trophy.trophyDetail || "No description available.")}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function renderTrophies(trophies, groups = []) {
  if (!trophies?.length) {
    trophyListingEl.innerHTML = '<div class="empty-state">No trophies were saved for this title.</div>';
    return;
  }

  const displayGroups = groups.length
    ? groups
    : [{ trophyGroupId: "default", trophyGroupName: "Base Game" }];

  const groupedSections = displayGroups
    .map((group) => {
      const groupId = group.trophyGroupId || "default";
      const groupName =
        groupId === "default" ? "Base Game" : group.trophyGroupName || groupId;
      const groupTrophies = trophies.filter(
        (trophy) => (trophy.trophyGroupId || "default") === groupId
      );

      if (!groupTrophies.length) {
        return "";
      }

      return `
        <section class="trophy-section">
          <header class="trophy-section__header">
            <h3>${escapeHtml(groupName)}</h3>
            <span>${formatNumber(groupTrophies.length)} trophies</span>
          </header>
          ${renderGroupedTrophyRows(groupTrophies)}
        </section>
      `;
    })
    .filter(Boolean);

  trophyListingEl.innerHTML = groupedSections.join("");
}

async function loadTitle(npCommunicationId) {
  const response = await fetch(`/api/title?id=${encodeURIComponent(npCommunicationId)}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.detail || payload.error || "Failed to load title details");
  }

  currentTitleId = payload.npCommunicationId;
  renderSelectedTitle(payload);
  renderTrophyGroups(payload.trophyGroups || []);
  renderTrophies(payload.trophies || [], payload.trophyGroups || []);
  applyFilter();
}

function applyFilter() {
  renderCatalog(catalog);
}

async function refreshCatalog({ preserveSelection = true } = {}) {
  const params = new URLSearchParams({ limit: activeQuery ? "500" : "100" });
  if (activeQuery) {
    params.set("q", activeQuery);
  }
  if (activeRegion && activeRegion !== "all") {
    params.set("region", activeRegion);
  }

  const response = await fetch(`/api/catalog?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.detail || payload.error || "Failed to load catalog");
  }

  catalog = payload.titles || [];
  activeRegion = payload.selectedRegion || "all";
  renderRegionOptions(payload.availableRegions || [], activeRegion);
  setScanSummary(payload.progress, payload.totalSaved || catalog.length);
  lastRefreshEl.textContent = `Last refresh ${formatDate(new Date().toISOString())}`;
  applyFilter();

  const shouldSelectFirst = !preserveSelection || !currentTitleId;
  const stillExists =
    preserveSelection &&
    currentTitleId &&
    catalog.some((item) => item.npCommunicationId === currentTitleId);
  const targetId =
    stillExists
      ? currentTitleId
      : shouldSelectFirst && catalog[0]
        ? catalog[0].npCommunicationId
        : null;

  if (targetId) {
    await loadTitle(targetId);
  } else if (!catalog.length) {
    currentTitleId = "";
    selectedCardEl.className = "selected-card empty-state";
    selectedCardEl.textContent =
      "Choose a trophy list from the left to inspect its saved trophies.";
    trophyGroupsEl.innerHTML = "";
    trophyListingEl.innerHTML = "";
  }
}

async function importPlayer(username) {
  const response = await fetch(`/api/import-player?username=${encodeURIComponent(username)}`, {
    method: "POST",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.detail || payload.error || "Failed to import player titles");
  }

  return payload;
}

catalogGridEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-title-id]");
  if (!button) {
    return;
  }

  try {
    await loadTitle(button.dataset.titleId);
  } catch (error) {
    selectedCardEl.className = "selected-card empty-state";
    selectedCardEl.textContent = error.message;
  }
});

titleFilterEl.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    activeQuery = titleFilterEl.value.trim();
    refreshCatalog({ preserveSelection: true }).catch((error) => {
      scanStatusPillEl.textContent = "Search Failed";
      lastRefreshEl.textContent = error.message;
    });
  }, 250);
});

regionFilterEl.addEventListener("change", () => {
  activeRegion = regionFilterEl.value || "all";
  refreshCatalog({ preserveSelection: true }).catch((error) => {
    scanStatusPillEl.textContent = "Search Failed";
    lastRefreshEl.textContent = error.message;
  });
});

playerImportFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = playerImportInputEl.value.trim();
  if (!username || isImportingPlayer) {
    return;
  }

  isImportingPlayer = true;
  playerImportButtonEl.disabled = true;
  setPlayerImportStatus(`Importing trophy lists from ${username}...`);

  try {
    const result = await importPlayer(username);
    const summary = [
      `Imported ${formatNumber(result.imported)} new list${result.imported === 1 ? "" : "s"} from ${result.resolvedUser}.`,
      `Skipped ${formatNumber(result.skippedExisting)} existing.`,
      `Unavailable ${formatNumber(result.unavailable)}.`,
      `Failed ${formatNumber(result.failed)}.`,
    ].join(" ");

    setPlayerImportStatus(summary);
    await refreshCatalog({ preserveSelection: false });
  } catch (error) {
    setPlayerImportStatus(error.message, true);
  } finally {
    isImportingPlayer = false;
    playerImportButtonEl.disabled = false;
  }
});

refreshCatalog({ preserveSelection: false }).catch((error) => {
  scanStatusPillEl.textContent = "Catalog Load Failed";
  selectedCardEl.className = "selected-card empty-state";
  selectedCardEl.textContent = error.message;
});

setInterval(() => {
  refreshCatalog().catch((error) => {
    scanStatusPillEl.textContent = "Refresh Failed";
    lastRefreshEl.textContent = error.message;
  });
}, REFRESH_INTERVAL_MS);
