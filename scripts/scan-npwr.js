const fs = require("fs");
const path = require("path");
const {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getTitleTrophies,
  getTitleTrophyGroups,
} = require("psn-api");

const ROOT_DIR = path.join(__dirname, "..");
const INFO_FILE = path.join(ROOT_DIR, "info.js");
const DATA_DIR = path.join(ROOT_DIR, "data", "npwr");
const TITLES_DIR = path.join(DATA_DIR, "titles");
const INDEX_DIR = path.join(DATA_DIR, "index");
const PROGRESS_FILE = path.join(DATA_DIR, "progress.json");
const VALID_FILE = path.join(INDEX_DIR, "valid.jsonl");
const INVALID_FILE = path.join(INDEX_DIR, "invalid.jsonl");
const ERROR_FILE = path.join(INDEX_DIR, "errors.jsonl");
const ALERT_STATE_FILE = path.join(INDEX_DIR, "alerts.json");
const AUTH_STATE_FILE = path.join(DATA_DIR, "auth.json");

let authCache = null;
let authPromise = null;
let notificationConfig = null;
let notificationWarningShown = false;
let nextScheduledRefreshAt = null;
const NOTIFICATIONS_ENABLED = false;

function parseArgs(argv) {
  const options = {
    start: 0,
    end: 99999,
    delayMs: 1200,
    retries: 3,
    force: false,
    retryFailed: false,
    reverse: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--start" && next) {
      options.start = Number(next);
      index += 1;
    } else if (arg === "--end" && next) {
      options.end = Number(next);
      index += 1;
    } else if (arg === "--delay-ms" && next) {
      options.delayMs = Number(next);
      index += 1;
    } else if (arg === "--retries" && next) {
      options.retries = Number(next);
      index += 1;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--retry-failed") {
      options.retryFailed = true;
    } else if (arg === "--reverse") {
      options.reverse = true;
    }
  }

  if (!Number.isInteger(options.start) || !Number.isInteger(options.end)) {
    throw new Error("Start and end must be integers.");
  }

  if (
    !options.retryFailed &&
    (options.start < 0 ||
      options.start > 99999 ||
      options.end < 0 ||
      options.end > 99999 ||
      (!options.reverse && options.end < options.start) ||
      (options.reverse && options.start < options.end))
  ) {
    throw new Error(
      options.reverse
        ? "Use a range between 0 and 99999, with start >= end for reverse scans."
        : "Use a range between 0 and 99999, with end >= start."
    );
  }

  if (!Number.isFinite(options.delayMs) || options.delayMs < 0) {
    throw new Error("delay-ms must be zero or greater.");
  }

  if (!Number.isInteger(options.retries) || options.retries < 1) {
    throw new Error("retries must be at least 1.");
  }

  return options;
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function buildRetryQueue() {
  const seen = new Set();
  const queue = [];

  for (const filePath of [INVALID_FILE, ERROR_FILE]) {
    for (const entry of readJsonLines(filePath)) {
      const npCommunicationId = String(entry?.npCommunicationId || "").trim();

      if (!/^NPWR\d{5}_\d{2}$/.test(npCommunicationId)) {
        continue;
      }

      if (seen.has(npCommunicationId)) {
        continue;
      }

      seen.add(npCommunicationId);
      queue.push(npCommunicationId);
    }
  }

  return queue;
}

function ensureDirectories() {
  fs.mkdirSync(TITLES_DIR, { recursive: true });
  fs.mkdirSync(INDEX_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNextLocalMidnightTimestamp(fromTime = Date.now()) {
  const next = new Date(fromTime);
  next.setHours(24, 0, 0, 0);
  return next.getTime();
}

function readInfoValue(variableName) {
  const file = fs.readFileSync(INFO_FILE, "utf8");
  const match = file.match(
    new RegExp(`${variableName}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`)
  );

  if (!match) {
    return "";
  }

  return match[1].trim();
}

function readNpsso() {
  const npsso = readInfoValue("myNpsso");
  if (!npsso) {
    throw new Error("Unable to read NPSSO from info.js");
  }
  return npsso;
}

function getNotificationConfig() {
  if (notificationConfig) {
    return notificationConfig;
  }

  notificationConfig = {
    userKey: "",
    appToken: "",
    watchedKeyword: "",
    enabled: NOTIFICATIONS_ENABLED,
  };

  return notificationConfig;
}

function scheduleNextMidnightRefresh(fromTime = Date.now()) {
  nextScheduledRefreshAt = getNextLocalMidnightTimestamp(fromTime);
}

async function fetchFreshAuthTokens() {
  const accessCode = await exchangeNpssoForAccessCode(readNpsso());
  return exchangeAccessCodeForAuthTokens(accessCode);
}

function readAuthState() {
  if (!fs.existsSync(AUTH_STATE_FILE)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(AUTH_STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeAuthState(state) {
  fs.writeFileSync(AUTH_STATE_FILE, JSON.stringify(state, null, 2));
}

function updateAuthCache(tokens, source) {
  authCache = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
    refreshTokenExpiresAt: Date.now() + tokens.refreshTokenExpiresIn * 1000,
    source,
  };

  writeAuthState({
    accessToken: authCache.accessToken,
    refreshToken: authCache.refreshToken,
    expiresAt: authCache.expiresAt,
    refreshTokenExpiresAt: authCache.refreshTokenExpiresAt,
    source,
    updatedAt: new Date().toISOString(),
  });

  return { accessToken: authCache.accessToken };
}

function hydrateAuthCacheFromDisk() {
  if (authCache) {
    return;
  }

  const saved = readAuthState();
  if (!saved?.accessToken || !saved?.refreshToken) {
    return;
  }

  authCache = {
    accessToken: saved.accessToken,
    refreshToken: saved.refreshToken,
    expiresAt: saved.expiresAt || 0,
    refreshTokenExpiresAt: saved.refreshTokenExpiresAt || 0,
    source: saved.source || "disk",
  };
}

async function getAuthorization() {
  hydrateAuthCacheFromDisk();

  if (authPromise) {
    return authPromise;
  }

  const now = Date.now();
  const accessStillValid = authCache && authCache.expiresAt - now > 60 * 1000;
  if (accessStillValid) {
    return { accessToken: authCache.accessToken };
  }

  authPromise = (async () => {
    const refreshStillValid =
      authCache && authCache.refreshTokenExpiresAt - now > 5 * 60 * 1000;

    if (refreshStillValid) {
      try {
        const tokens = await exchangeRefreshTokenForAuthTokens(authCache.refreshToken);
        return updateAuthCache(tokens, "refresh");
      } catch (error) {
        console.log("[auth] Refresh token failed, falling back to NPSSO exchange.");
      }
    }

    const tokens = await fetchFreshAuthTokens();
    return updateAuthCache(tokens, "npsso");
  })();

  try {
    return await authPromise;
  } finally {
    authPromise = null;
  }
}

function formatNpwr(index) {
  return `NPWR${String(index).padStart(5, "0")}_00`;
}

function appendJsonLine(filePath, value) {
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function readProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function readAlertState() {
  if (!fs.existsSync(ALERT_STATE_FILE)) {
    return { sent: {}, firstValidSent: false };
  }

  try {
    const state = JSON.parse(fs.readFileSync(ALERT_STATE_FILE, "utf8"));
    return {
      sent: state.sent || {},
      firstValidSent: Boolean(state.firstValidSent),
      firstValid: state.firstValid || null,
    };
  } catch {
    return { sent: {}, firstValidSent: false };
  }
}

function writeAlertState(state) {
  fs.writeFileSync(ALERT_STATE_FILE, JSON.stringify(state, null, 2));
}

async function maybeNotifyFirstValid(payload) {
  const alertState = readAlertState();
  if (alertState.firstValidSent) {
    return;
  }

  const message = [
    "The scanner found its first valid trophy list.",
    `Title: ${payload.titleName || "Unknown"}`,
    `ID: ${payload.npCommunicationId}`,
    `Platform: ${payload.titlePlatform || "Unknown"}`,
    `Service: ${payload.npServiceName || "Unknown"}`,
    `Saved: ${payload.scannedAt}`,
  ].join("\n");

  try {
    const result = await sendGenericPushoverNotification("First Valid NPWR Found", message);
    alertState.firstValidSent = true;
    alertState.firstValid = {
      npCommunicationId: payload.npCommunicationId,
      titleName: payload.titleName || null,
      notifiedAt: new Date().toISOString(),
      status: result.sent ? "sent" : result.reason || "skipped",
    };
    writeAlertState(alertState);

    if (result.sent) {
      console.log(`[notify] Sent first-valid alert for ${payload.npCommunicationId} ${payload.titleName}`);
    }
  } catch (error) {
    appendJsonLine(ERROR_FILE, {
      npCommunicationId: payload.npCommunicationId,
      scannedAt: new Date().toISOString(),
      attempt: "first_valid_notify",
      error: normalizeError(error),
    });
    console.log(`[notify-error] ${payload.npCommunicationId} ${error.message}`);
  }
}

function getTitleFilePath(npCommunicationId) {
  return path.join(TITLES_DIR, `${npCommunicationId}.json`);
}

function isResourceNotFound(resultOrError) {
  if (!resultOrError) {
    return false;
  }

  const errorPayload = resultOrError.error || resultOrError;
  return (
    errorPayload.code === 2240525 ||
    errorPayload.statusCode === 404 ||
    String(errorPayload.message || "").toLowerCase().includes("resource not found")
  );
}

function normalizeError(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || "Unknown error",
    code: error?.code || null,
    statusCode: error?.statusCode || null,
    stack: error?.stack || null,
  };
}

function isAuthError(error) {
  const text = [
    error?.message || "",
    error?.code || "",
    error?.statusCode || "",
    error?.status || "",
  ]
    .join(" ")
    .toLowerCase();

  return (
    text.includes("unauthorized") ||
    text.includes("forbidden") ||
    text.includes("access token") ||
    text.includes("refresh token") ||
    text.includes("oauth") ||
    text.includes("invalid_grant") ||
    text.includes("expired")
  );
}

async function recoverAuthorization() {
  hydrateAuthCacheFromDisk();

  if (authCache?.refreshToken) {
    try {
      const tokens = await exchangeRefreshTokenForAuthTokens(authCache.refreshToken);
      updateAuthCache(tokens, "refresh-recovery");
      console.log("[auth] Recovered scanner auth using refresh token.");
      return true;
    } catch (error) {
      console.log("[auth] Refresh recovery failed, retrying with NPSSO.");
    }
  }

  const tokens = await fetchFreshAuthTokens();
  updateAuthCache(tokens, "npsso-recovery");
  console.log("[auth] Recovered scanner auth using NPSSO.");
  return true;
}

async function runScheduledMidnightRefresh(progress, options) {
  console.log("[auth] Midnight refresh checkpoint reached. Pausing scan.");

  const scopeLabel = options.retryFailed
    ? `Retry queue progress: ${progress.completedItems || 0}/${progress.totalItems || 0}`
    : `Range: ${formatNpwr(options.start)} to ${formatNpwr(options.end)}`;

  try {
    await recoverAuthorization();
    scheduleNextMidnightRefresh();
    console.log(
      `[auth] Midnight refresh succeeded. Next refresh scheduled for ${new Date(
        nextScheduledRefreshAt
      ).toLocaleString()}.`
    );
  } catch (error) {
    const message = [
      "The scheduled midnight auth refresh failed.",
      scopeLabel,
      options.retryFailed
        ? `Next item: ${progress.lastScannedId || "Pending"}`
        : `Next index: ${formatNpwr(progress.nextIndex || options.start)}`,
      `Last scanned: ${progress.lastScannedId || "None"}`,
      `Error: ${error.message}`,
      "The scanner has stopped. Resume it manually when you are ready.",
    ].join("\n");

    try {
      await sendGenericPushoverNotification("NPWR Midnight Refresh Failed", message);
      console.log("[notify] Sent midnight refresh failure alert.");
    } catch (notifyError) {
      appendJsonLine(ERROR_FILE, {
        npCommunicationId: null,
        scannedAt: new Date().toISOString(),
        attempt: "midnight_refresh_notify",
        error: normalizeError(notifyError),
      });
      console.log(`[notify-error] ${notifyError.message}`);
    }

    appendJsonLine(ERROR_FILE, {
      npCommunicationId: null,
      scannedAt: new Date().toISOString(),
      attempt: "midnight_refresh",
      error: normalizeError(error),
    });

    throw new Error(`Scheduled midnight refresh failed: ${error.message}`);
  }
}

async function pauseForScheduledRefreshIfNeeded(progress, options) {
  if (!nextScheduledRefreshAt) {
    scheduleNextMidnightRefresh();
  }

  if (Date.now() < nextScheduledRefreshAt) {
    return;
  }

  await runScheduledMidnightRefresh(progress, options);
}

function shouldSendTitleAlert(payload) {
  const config = getNotificationConfig();
  const keyword = String(config.watchedKeyword || "").trim().toLowerCase();
  const titleName = String(payload?.titleName || "").toLowerCase();

  if (!keyword || !titleName) {
    return false;
  }

  return titleName.includes(keyword);
}

async function sendPushoverNotification(payload) {
  return { sent: false, reason: "disabled" };
}

async function sendGenericPushoverNotification(title, message) {
  return { sent: false, reason: "disabled" };
}

async function sendScannerStartupNotification(progress, resumeStart, options) {
  return;
}

async function sendScannerCompleteNotification(progress, options) {
  return;
}

async function maybeNotifyForTitle(payload) {
  if (!shouldSendTitleAlert(payload)) {
    return;
  }

  const alertState = readAlertState();
  if (alertState.sent?.[payload.npCommunicationId]) {
    return;
  }

  try {
    const result = await sendPushoverNotification(payload);
    alertState.sent[payload.npCommunicationId] = {
      titleName: payload.titleName,
      matchedKeyword: getNotificationConfig().watchedKeyword,
      notifiedAt: new Date().toISOString(),
      status: result.sent ? "sent" : result.reason || "skipped",
    };
    writeAlertState(alertState);

    if (result.sent) {
      console.log(`[notify] Sent Pushover alert for ${payload.npCommunicationId} ${payload.titleName}`);
    }
  } catch (error) {
    appendJsonLine(ERROR_FILE, {
      npCommunicationId: payload.npCommunicationId,
      scannedAt: new Date().toISOString(),
      attempt: "notify",
      error: normalizeError(error),
    });
    console.log(`[notify-error] ${payload.npCommunicationId} ${error.message}`);
  }
}

async function fetchTitlePayload(npCommunicationId) {
  const authorization = await getAuthorization();

  for (const npServiceName of ["trophy", "trophy2"]) {
    const groups = await getTitleTrophyGroups(authorization, npCommunicationId, {
      npServiceName,
    });

    if (isResourceNotFound(groups)) {
      continue;
    }

    if (groups?.error) {
      throw new Error(
        `${npCommunicationId} returned an unexpected error payload on ${npServiceName}: ${groups.error.message}`
      );
    }

    const trophies = await getTitleTrophies(authorization, npCommunicationId, "all", {
      npServiceName,
      limit: 800,
    });

    if (trophies?.error) {
      throw new Error(
        `${npCommunicationId} trophy fetch failed on ${npServiceName}: ${trophies.error.message}`
      );
    }

    return {
      npCommunicationId,
      npServiceName,
      scannedAt: new Date().toISOString(),
      titleName: groups.trophyTitleName || null,
      titleIconUrl: groups.trophyTitleIconUrl || null,
      titlePlatform: groups.trophyTitlePlatform || null,
      titleDetail: groups.trophyTitleDetail || null,
      trophySetVersion: groups.trophySetVersion || trophies.trophySetVersion || null,
      definedTrophies: groups.definedTrophies || null,
      trophyGroups: groups.trophyGroups || [],
      trophies: trophies.trophies || [],
      totalTrophyCount: trophies.totalItemCount || 0,
      hasTrophyGroups: Boolean(trophies.hasTrophyGroups),
    };
  }

  return null;
}

async function scanOne(npCommunicationId, options) {
  const existingTitleFile = getTitleFilePath(npCommunicationId);
  if (!options.force && fs.existsSync(existingTitleFile)) {
    return { status: "skipped-valid" };
  }

  for (let attempt = 1; attempt <= options.retries; attempt += 1) {
    try {
      const payload = await fetchTitlePayload(npCommunicationId);

      if (!payload) {
        appendJsonLine(INVALID_FILE, {
          npCommunicationId,
          scannedAt: new Date().toISOString(),
          reason: "resource_not_found",
        });
        return { status: "invalid" };
      }

      fs.writeFileSync(existingTitleFile, JSON.stringify(payload, null, 2));
      appendJsonLine(VALID_FILE, {
        npCommunicationId,
        titleName: payload.titleName,
        titlePlatform: payload.titlePlatform,
        npServiceName: payload.npServiceName,
        totalTrophyCount: payload.totalTrophyCount,
        scannedAt: payload.scannedAt,
      });

      await maybeNotifyFirstValid(payload);
      await maybeNotifyForTitle(payload);

      return { status: "valid", payload };
    } catch (error) {
      if (isAuthError(error)) {
        try {
          await recoverAuthorization();
          console.log(`[auth] Retrying ${npCommunicationId} after auth refresh.`);
          continue;
        } catch (recoveryError) {
          appendJsonLine(ERROR_FILE, {
            npCommunicationId,
            scannedAt: new Date().toISOString(),
            attempt: "auth_recovery",
            error: normalizeError(recoveryError),
          });
        }
      }

      const retryable = attempt < options.retries;

      if (!retryable) {
        appendJsonLine(ERROR_FILE, {
          npCommunicationId,
          scannedAt: new Date().toISOString(),
          attempt,
          error: normalizeError(error),
        });
        return { status: "error", error };
      }

      await sleep(options.delayMs * attempt);
    }
  }

  return { status: "error", error: new Error("Unexpected scanner fallthrough") };
}

async function main() {
  ensureDirectories();
  scheduleNextMidnightRefresh();

  const options = parseArgs(process.argv.slice(2));
  const savedValidCount = fs.existsSync(TITLES_DIR)
    ? fs.readdirSync(TITLES_DIR).filter((file) => file.endsWith(".json")).length
    : 0;
  const existingProgress = readProgress();

  if (options.retryFailed) {
    const retryQueue = buildRetryQueue();
    const progress = {
      mode: "retry-failed",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalItems: retryQueue.length,
      completedItems: 0,
      delayMs: options.delayMs,
      retries: options.retries,
      validCount: 0,
      invalidCount: 0,
      errorCount: 0,
      skippedValidCount: 0,
      savedValidCount,
      lastScannedId: null,
    };

    writeProgress(progress);

    console.log(`Retry-scanning ${retryQueue.length} invalid/error NPWR IDs.`);

    try {
      await sendScannerStartupNotification(progress, null, options);
    } catch (error) {
      appendJsonLine(ERROR_FILE, {
        npCommunicationId: null,
        scannedAt: new Date().toISOString(),
        attempt: "startup_notify",
        error: normalizeError(error),
      });
      console.log(`[notify-error] ${error.message}`);
    }

    for (let index = 0; index < retryQueue.length; index += 1) {
      await pauseForScheduledRefreshIfNeeded(progress, options);

      const npCommunicationId = retryQueue[index];
      const result = await scanOne(npCommunicationId, options);

      progress.updatedAt = new Date().toISOString();
      progress.completedItems = index + 1;
      progress.lastScannedId = npCommunicationId;

      if (result.status === "valid") {
        progress.validCount += 1;
        console.log(`[valid]   ${npCommunicationId} ${result.payload.titleName || ""}`.trim());
      } else if (result.status === "invalid") {
        progress.invalidCount += 1;
        console.log(`[invalid] ${npCommunicationId}`);
      } else if (result.status === "skipped-valid") {
        progress.skippedValidCount += 1;
        console.log(`[skip]    ${npCommunicationId} already saved`);
      } else {
        progress.errorCount += 1;
        console.log(`[error]   ${npCommunicationId} ${result.error.message}`);
      }

      writeProgress(progress);

      if (index < retryQueue.length - 1 && options.delayMs > 0) {
        await sleep(options.delayMs);
      }
    }

    console.log("Retry scan complete.");
    console.log(JSON.stringify(progress, null, 2));

    try {
      await sendScannerCompleteNotification(progress, options);
    } catch (error) {
      appendJsonLine(ERROR_FILE, {
        npCommunicationId: null,
        scannedAt: new Date().toISOString(),
        attempt: "completion_notify",
        error: normalizeError(error),
      });
      console.log(`[notify-error] ${error.message}`);
    }

    return;
  }

  const resumeStart =
    !options.force &&
    existingProgress &&
    existingProgress.mode !== "retry-failed" &&
    Boolean(existingProgress.reverse) === Boolean(options.reverse) &&
    Number.isInteger(existingProgress.nextIndex) &&
    (options.reverse
      ? existingProgress.nextIndex <= options.start && existingProgress.nextIndex >= options.end
      : existingProgress.nextIndex >= options.start && existingProgress.nextIndex <= options.end)
      ? existingProgress.nextIndex
      : options.start;

  const progress = {
    startedAt: existingProgress?.startedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reverse: options.reverse,
    start: options.start,
    end: options.end,
    nextIndex: resumeStart,
    totalItems: Math.abs(options.end - options.start) + 1,
    completedItems:
      !options.force &&
      existingProgress &&
      existingProgress.mode !== "retry-failed" &&
      Boolean(existingProgress.reverse) === Boolean(options.reverse)
        ? existingProgress.completedItems ||
          (options.reverse ? options.start - resumeStart : resumeStart - options.start)
        : 0,
    delayMs: options.delayMs,
    retries: options.retries,
    validCount: existingProgress?.validCount || 0,
    invalidCount: existingProgress?.invalidCount || 0,
    errorCount: existingProgress?.errorCount || 0,
    skippedValidCount: existingProgress?.skippedValidCount || 0,
    savedValidCount,
    lastScannedId: existingProgress?.lastScannedId || null,
  };

  writeProgress(progress);

  console.log(
    `${options.reverse ? "Reverse scanning" : "Scanning"} NPWR range ${formatNpwr(options.start)} to ${formatNpwr(
      options.end
    )} starting at ${formatNpwr(resumeStart)}`
  );

  try {
    await sendScannerStartupNotification(progress, resumeStart, options);
  } catch (error) {
    appendJsonLine(ERROR_FILE, {
      npCommunicationId: null,
      scannedAt: new Date().toISOString(),
      attempt: "startup_notify",
      error: normalizeError(error),
    });
    console.log(`[notify-error] ${error.message}`);
  }

  for (
    let index = resumeStart;
    options.reverse ? index >= options.end : index <= options.end;
    index += options.reverse ? -1 : 1
  ) {
    await pauseForScheduledRefreshIfNeeded(progress, options);

    const npCommunicationId = formatNpwr(index);
    const result = await scanOne(npCommunicationId, options);

    progress.updatedAt = new Date().toISOString();
    progress.nextIndex = index + (options.reverse ? -1 : 1);
    progress.completedItems += 1;
    progress.lastScannedId = npCommunicationId;

    if (result.status === "valid") {
      progress.validCount += 1;
      console.log(`[valid]   ${npCommunicationId} ${result.payload.titleName || ""}`.trim());
    } else if (result.status === "invalid") {
      progress.invalidCount += 1;
      console.log(`[invalid] ${npCommunicationId}`);
    } else if (result.status === "skipped-valid") {
      progress.skippedValidCount += 1;
      console.log(`[skip]    ${npCommunicationId} already saved`);
    } else {
      progress.errorCount += 1;
      console.log(`[error]   ${npCommunicationId} ${result.error.message}`);
    }

    writeProgress(progress);

    if (
      ((options.reverse && index > options.end) || (!options.reverse && index < options.end)) &&
      options.delayMs > 0
    ) {
      await sleep(options.delayMs);
    }
  }

  console.log("Scan complete.");
  console.log(JSON.stringify(progress, null, 2));

  try {
    await sendScannerCompleteNotification(progress, options);
  } catch (error) {
    appendJsonLine(ERROR_FILE, {
      npCommunicationId: null,
      scannedAt: new Date().toISOString(),
      attempt: "completion_notify",
      error: normalizeError(error),
    });
    console.log(`[notify-error] ${error.message}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
