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
const OUTPUT_ROOT = path.join(ROOT_DIR, "worker-output");

let authCache = null;
let authPromise = null;

function parseArgs(argv) {
  const options = {
    start: 0,
    end: 99999,
    delayMs: 1200,
    retries: 3,
    reverse: false,
    outputDir: path.join(OUTPUT_ROOT, "default"),
    shardName: "default",
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
    } else if (arg === "--output-dir" && next) {
      options.outputDir = path.resolve(ROOT_DIR, next);
      index += 1;
    } else if (arg === "--shard-name" && next) {
      options.shardName = next;
      index += 1;
    } else if (arg === "--reverse") {
      options.reverse = true;
    }
  }

  if (!Number.isInteger(options.start) || !Number.isInteger(options.end)) {
    throw new Error("Start and end must be integers.");
  }

  if (
    options.start < 0 ||
    options.start > 99999 ||
    options.end < 0 ||
    options.end > 99999 ||
    (!options.reverse && options.end < options.start) ||
    (options.reverse && options.start < options.end)
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDirectories(outputDir) {
  fs.mkdirSync(path.join(outputDir, "titles"), { recursive: true });
  fs.mkdirSync(path.join(outputDir, "index"), { recursive: true });
}

function appendJsonLine(filePath, value) {
  fs.appendFileSync(filePath, JSON.stringify(value) + "\n", "utf8");
}

function formatNpwr(index) {
  return `NPWR${String(index).padStart(5, "0")}_00`;
}

function readNpssoFromEnv() {
  const npsso = process.env.PSN_NPSSO || process.env.NPSSO || "";
  if (!npsso) {
    throw new Error("Missing PSN_NPSSO secret/environment variable.");
  }
  return npsso.trim();
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

async function fetchFreshAuthTokens() {
  const accessCode = await exchangeNpssoForAccessCode(readNpssoFromEnv());
  return exchangeAccessCodeForAuthTokens(accessCode);
}

async function getAuthorization() {
  if (authPromise) {
    return authPromise;
  }

  const now = Date.now();
  if (authCache && authCache.expiresAt - now > 60 * 1000) {
    return { accessToken: authCache.accessToken };
  }

  authPromise = (async () => {
    if (authCache && authCache.refreshTokenExpiresAt - now > 5 * 60 * 1000) {
      try {
        const tokens = await exchangeRefreshTokenForAuthTokens(authCache.refreshToken);
        authCache = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
          refreshTokenExpiresAt: Date.now() + tokens.refreshTokenExpiresIn * 1000,
        };
        return { accessToken: authCache.accessToken };
      } catch {
        // Fall through to NPSSO.
      }
    }

    const tokens = await fetchFreshAuthTokens();
    authCache = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
      refreshTokenExpiresAt: Date.now() + tokens.refreshTokenExpiresIn * 1000,
    };
    return { accessToken: authCache.accessToken };
  })();

  try {
    return await authPromise;
  } finally {
    authPromise = null;
  }
}

async function recoverAuthorization() {
  if (authCache?.refreshToken) {
    try {
      const tokens = await exchangeRefreshTokenForAuthTokens(authCache.refreshToken);
      authCache = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: Date.now() + tokens.expiresIn * 1000,
        refreshTokenExpiresAt: Date.now() + tokens.refreshTokenExpiresIn * 1000,
      };
      return true;
    } catch {
      // Fall back to NPSSO.
    }
  }

  const tokens = await fetchFreshAuthTokens();
  authCache = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
    refreshTokenExpiresAt: Date.now() + tokens.refreshTokenExpiresIn * 1000,
  };
  return true;
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

async function scanOne(npCommunicationId, options, paths) {
  const existingTitleFile = path.join(paths.titlesDir, `${npCommunicationId}.json`);
  if (fs.existsSync(existingTitleFile)) {
    return { status: "skipped-valid" };
  }

  for (let attempt = 1; attempt <= options.retries; attempt += 1) {
    try {
      const payload = await fetchTitlePayload(npCommunicationId);

      if (!payload) {
        appendJsonLine(paths.invalidFile, {
          npCommunicationId,
          scannedAt: new Date().toISOString(),
          reason: "resource_not_found",
        });
        return { status: "invalid" };
      }

      fs.writeFileSync(existingTitleFile, JSON.stringify(payload, null, 2));
      appendJsonLine(paths.validFile, {
        npCommunicationId,
        titleName: payload.titleName,
        titlePlatform: payload.titlePlatform,
        npServiceName: payload.npServiceName,
        totalTrophyCount: payload.totalTrophyCount,
        scannedAt: payload.scannedAt,
      });

      return { status: "valid", payload };
    } catch (error) {
      if (isAuthError(error)) {
        try {
          await recoverAuthorization();
          continue;
        } catch (recoveryError) {
          appendJsonLine(paths.errorFile, {
            npCommunicationId,
            scannedAt: new Date().toISOString(),
            attempt: "auth_recovery",
            error: normalizeError(recoveryError),
          });
        }
      }

      if (attempt >= options.retries) {
        appendJsonLine(paths.errorFile, {
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
  const options = parseArgs(process.argv.slice(2));
  ensureDirectories(options.outputDir);

  const paths = {
    titlesDir: path.join(options.outputDir, "titles"),
    validFile: path.join(options.outputDir, "index", "valid.jsonl"),
    invalidFile: path.join(options.outputDir, "index", "invalid.jsonl"),
    errorFile: path.join(options.outputDir, "index", "errors.jsonl"),
    summaryFile: path.join(options.outputDir, "summary.json"),
  };

  const progress = {
    shardName: options.shardName,
    start: options.start,
    end: options.end,
    reverse: options.reverse,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalItems: Math.abs(options.end - options.start) + 1,
    completedItems: 0,
    validCount: 0,
    invalidCount: 0,
    errorCount: 0,
    skippedValidCount: 0,
    lastScannedId: null,
  };

  for (
    let index = options.start;
    options.reverse ? index >= options.end : index <= options.end;
    index += options.reverse ? -1 : 1
  ) {
    const npCommunicationId = formatNpwr(index);
    const result = await scanOne(npCommunicationId, options, paths);

    progress.updatedAt = new Date().toISOString();
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
      console.log(`[skip]    ${npCommunicationId} already saved in shard output`);
    } else {
      progress.errorCount += 1;
      console.log(`[error]   ${npCommunicationId} ${result.error.message}`);
    }

    fs.writeFileSync(paths.summaryFile, JSON.stringify(progress, null, 2));

    const hasMore = options.reverse ? index > options.end : index < options.end;
    if (hasMore && options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  console.log(JSON.stringify(progress, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
