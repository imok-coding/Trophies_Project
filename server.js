const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getBasicPresence,
  getProfileFromAccountId,
  getProfileFromUserName,
  getTitleTrophies,
  getTitleTrophyGroups,
  getUserPlayedGames,
  getUserTitles,
  getUserTrophyProfileSummary,
} = require("psn-api");

const DEFAULT_PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const INFO_FILE = path.join(__dirname, "info.js");
const SCAN_TITLES_DIR = path.join(__dirname, "data", "npwr", "titles");
const SCAN_PROGRESS_FILE = path.join(__dirname, "data", "npwr", "progress.json");
const SCAN_VALID_INDEX_FILE = path.join(__dirname, "data", "npwr", "index", "valid.jsonl");
const SCAN_REGION_MAP_FILE = path.join(__dirname, "data", "npwr", "regions.json");
const PSNP_PLUS_URL = "https://psnp-plus.huskycode.dev/list.json";

let authCache = null;
let authPromise = null;

function readNpsso() {
  const file = fs.readFileSync(INFO_FILE, "utf8");
  const match = file.match(/myNpsso\s*=\s*["'`]([^"'`]+)["'`]/);

  if (!match) {
    throw new Error("Unable to read NPSSO from info.js");
  }

  return match[1].trim();
}

async function fetchFreshAuthTokens() {
  const npsso = readNpsso();
  const accessCode = await exchangeNpssoForAccessCode(npsso);
  return exchangeAccessCodeForAuthTokens(accessCode);
}

async function getAuthorization() {
  if (authPromise) {
    return authPromise;
  }

  const now = Date.now();
  const accessStillValid =
    authCache && authCache.expiresAt - now > 60 * 1000;

  if (accessStillValid) {
    return { accessToken: authCache.accessToken };
  }

  authPromise = (async () => {
    const refreshStillValid =
      authCache && authCache.refreshTokenExpiresAt - now > 5 * 60 * 1000;

    const tokens = refreshStillValid
      ? await exchangeRefreshTokenForAuthTokens(authCache.refreshToken)
      : await fetchFreshAuthTokens();

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

function getAvatar(avatars) {
  if (!Array.isArray(avatars) || avatars.length === 0) {
    return "";
  }

  return avatars[avatars.length - 1].url || avatars[avatars.length - 1].avatarUrl || "";
}

function pickStatus(presence) {
  const primary = presence?.basicPresence?.primaryPlatformInfo;
  const onlineStatus = primary?.onlineStatus || presence?.basicPresence?.onlineStatus || "offline";
  const platform = primary?.platform || presence?.basicPresence?.platform || "offline";
  const lastOnline = primary?.lastOnlineDate || presence?.basicPresence?.lastOnlineDate || null;
  const currentGame = presence?.basicPresence?.gameTitleInfoList?.[0] || null;

  return {
    onlineStatus,
    platform,
    lastOnline,
    currentGame: currentGame
      ? {
          titleName: currentGame.titleName,
          iconUrl: currentGame.conceptIconUrl || currentGame.npTitleIconUrl || "",
        }
      : null,
  };
}

function buildProfilePayload({
  username,
  profile,
  trophySummary,
  titles,
  playedGames,
  presence,
}) {
  const earned = trophySummary.earnedTrophies;
  const totalTrophies =
    earned.bronze + earned.silver + earned.gold + earned.platinum;
  const completionCount = titles.filter((title) => title.progress === 100).length;
  const ultraRareCount = titles.filter((title) => title.progress >= 90).length;
  const totalGames = titles.length;

  return {
    fetchedAt: new Date().toISOString(),
    profile: {
      username,
      avatarUrl: getAvatar(profile.avatars),
      aboutMe: profile.aboutMe || "",
      languages: profile.languages || [],
      isPlus: Boolean(profile.isPlus),
      isVerified: Boolean(profile.isOfficiallyVerified),
      status: pickStatus(presence),
    },
    summary: {
      accountId: trophySummary.accountId,
      trophyLevel: Number(trophySummary.trophyLevel),
      progress: trophySummary.progress,
      tier: trophySummary.tier,
      earnedTrophies: earned,
      totalTrophies,
      totalGames,
      completedGames: completionCount,
      nearCompleteGames: ultraRareCount,
      completionRate:
        totalGames > 0 ? Math.round((completionCount / totalGames) * 1000) / 10 : 0,
    },
    recentGames: playedGames.slice(0, 6).map((game) => ({
      titleId: game.titleId,
      name: game.localizedName || game.name,
      imageUrl: game.localizedImageUrl || game.imageUrl,
      playCount: game.playCount,
      playDuration: game.playDuration,
      firstPlayedDateTime: game.firstPlayedDateTime,
      lastPlayedDateTime: game.lastPlayedDateTime,
      category: game.category,
    })),
    trophyTitles: titles.slice(0, 60).map((title) => ({
      npCommunicationId: title.npCommunicationId,
      npServiceName: title.npServiceName,
      iconUrl: title.trophyTitleIconUrl,
      name: title.trophyTitleName,
      platform: title.trophyTitlePlatform,
      progress: title.progress,
      trophySetVersion: title.trophySetVersion,
      hasTrophyGroups: title.hasTrophyGroups,
      hidden: title.hiddenFlag,
      lastUpdatedDateTime: title.lastUpdatedDateTime,
      definedTrophies: title.definedTrophies,
      earnedTrophies: title.earnedTrophies,
    })),
  };
}

async function getProfileBundle(requestedUser) {
  const authorization = await getAuthorization();
  const lookup = (requestedUser || "me").trim();

  let accountId = "me";
  let username = lookup;

  if (lookup.toLowerCase() !== "me") {
    const userNameProfile = await getProfileFromUserName(authorization, lookup);
    accountId = userNameProfile.profile.accountId;
    username = userNameProfile.profile.onlineId;
  }

  const summary = await getUserTrophyProfileSummary(authorization, accountId);
  const resolvedAccountId = accountId === "me" ? summary.accountId : accountId;

  const [profile, titlesResponse, playedGamesResponse, presence] = await Promise.all([
    getProfileFromAccountId(authorization, resolvedAccountId),
    getUserTitles(authorization, accountId, { limit: 120 }),
    getUserPlayedGames(authorization, accountId, { limit: 20 }),
    getBasicPresence(authorization, resolvedAccountId).catch(() => null),
  ]);

  return buildProfilePayload({
    username: profile.onlineId || username,
    profile,
    trophySummary: summary,
    titles: titlesResponse.trophyTitles || [],
    playedGames: playedGamesResponse.titles || [],
    presence,
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readRegionMap() {
  if (!fs.existsSync(SCAN_REGION_MAP_FILE)) {
    return {};
  }

  try {
    const value = readJsonFile(SCAN_REGION_MAP_FILE);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function getMappedRegion(npCommunicationId, titleRegion) {
  const regionMap = readRegionMap();
  const mappedRegion = regionMap[npCommunicationId];
  return mappedRegion || titleRegion || "Unknown";
}

function getAvailableRegionsFromTitles(titles) {
  return [...new Set(titles.map((title) => title.region || "Unknown"))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function appendJsonLine(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function getCountSummary(definedTrophies) {
  const counts = definedTrophies || {};
  const bronze = counts.bronze || 0;
  const silver = counts.silver || 0;
  const gold = counts.gold || 0;
  const platinum = counts.platinum || 0;

  return {
    bronze,
    silver,
    gold,
    platinum,
    total: bronze + silver + gold + platinum,
  };
}

function getScanProgress() {
  if (!fs.existsSync(SCAN_PROGRESS_FILE)) {
    return null;
  }

  try {
    return readJsonFile(SCAN_PROGRESS_FILE);
  } catch {
    return null;
  }
}

function buildCatalogEntryFromTitle(title, fileName, stats) {
  const counts = getCountSummary(title.definedTrophies);
  const npCommunicationId = title.npCommunicationId || path.basename(fileName || "", ".json");

  return {
    npCommunicationId,
    titleName: title.titleName || title.npCommunicationId || fileName,
    titleIconUrl: title.titleIconUrl || "",
    titlePlatform: title.titlePlatform || "Unknown",
    region: getMappedRegion(npCommunicationId, title.region),
    npServiceName: title.npServiceName || "unknown",
    trophySetVersion: title.trophySetVersion || null,
    totalTrophyCount: title.totalTrophyCount || counts.total,
    trophyGroupCount: Array.isArray(title.trophyGroups) ? title.trophyGroups.length : 0,
    definedTrophies: counts,
    scannedAt: title.scannedAt || new Date(stats.mtimeMs).toISOString(),
    createdAt: new Date(stats.birthtimeMs || stats.mtimeMs).toISOString(),
    updatedAt: new Date(stats.mtimeMs).toISOString(),
    hasTrophyGroups: Boolean(title.hasTrophyGroups),
  };
}

function readCatalogEntry(npCommunicationId) {
  const filePath = path.join(SCAN_TITLES_DIR, `${npCommunicationId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stats = fs.statSync(filePath);
  const title = readJsonFile(filePath);
  return buildCatalogEntryFromTitle(title, `${npCommunicationId}.json`, stats);
}

function getTitleCatalog(limit = 250, region = "") {
  if (!fs.existsSync(SCAN_TITLES_DIR)) {
    return [];
  }

  const titles = fs
    .readdirSync(SCAN_TITLES_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const filePath = path.join(SCAN_TITLES_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        file,
        filePath,
        modifiedAtMs: stats.mtimeMs,
      };
    })
    .sort((left, right) => right.modifiedAtMs - left.modifiedAtMs)
    .slice(0, limit)
    .map(({ file, filePath }) => {
      const stats = fs.statSync(filePath);
      const title = readJsonFile(filePath);
      return buildCatalogEntryFromTitle(title, file, stats);
    });

  if (!region || region === "all") {
    return titles;
  }

  const normalizedRegion = region.toLowerCase();
  return titles.filter((title) => String(title.region || "Unknown").toLowerCase() === normalizedRegion);
}

function searchTitleCatalog(query, limit = 250, region = "") {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) {
    return getTitleCatalog(limit, region);
  }

  if (!fs.existsSync(SCAN_VALID_INDEX_FILE)) {
    return [];
  }

  const lines = fs
    .readFileSync(SCAN_VALID_INDEX_FILE, "utf8")
    .split(/\r?\n/)
    .filter(Boolean);

  const matches = [];

  for (let index = lines.length - 1; index >= 0 && matches.length < limit; index -= 1) {
    let entry;

    try {
      entry = JSON.parse(lines[index]);
    } catch {
      continue;
    }

    const haystack = [
      entry.npCommunicationId,
      entry.titleName,
      entry.titlePlatform,
      entry.npServiceName,
      readRegionMap()[entry.npCommunicationId] || "",
    ]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(normalizedQuery)) {
      continue;
    }

    const fullEntry = readCatalogEntry(entry.npCommunicationId);
    if (
      fullEntry &&
      (!region ||
        region === "all" ||
        String(fullEntry.region || "Unknown").toLowerCase() === String(region).toLowerCase())
    ) {
      matches.push(fullEntry);
    }
  }

  return matches;
}

function getTitleDetails(npCommunicationId) {
  const filePath = path.join(SCAN_TITLES_DIR, `${npCommunicationId}.json`);
  if (!filePath.startsWith(SCAN_TITLES_DIR) || !fs.existsSync(filePath)) {
    return null;
  }

  const title = readJsonFile(filePath);
  const stats = fs.statSync(filePath);

  return {
    npCommunicationId: title.npCommunicationId,
    titleName: title.titleName,
    titleIconUrl: title.titleIconUrl || "",
    titlePlatform: title.titlePlatform || "Unknown",
    region: getMappedRegion(title.npCommunicationId, title.region),
    titleDetail: title.titleDetail || "",
    npServiceName: title.npServiceName || "unknown",
    trophySetVersion: title.trophySetVersion || null,
    definedTrophies: getCountSummary(title.definedTrophies),
    trophyGroups: title.trophyGroups || [],
    trophies: title.trophies || [],
    totalTrophyCount: title.totalTrophyCount || 0,
    hasTrophyGroups: Boolean(title.hasTrophyGroups),
    scannedAt: title.scannedAt || new Date(stats.mtimeMs).toISOString(),
    createdAt: new Date(stats.birthtimeMs || stats.mtimeMs).toISOString(),
    updatedAt: new Date(stats.mtimeMs).toISOString(),
  };
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

async function fetchTitlePayload(authorization, npCommunicationId, preferredServiceName) {
  const serviceNames = preferredServiceName
    ? [preferredServiceName, ...["trophy", "trophy2"].filter((value) => value !== preferredServiceName)]
    : ["trophy", "trophy2"];

  for (const npServiceName of serviceNames) {
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

async function importMissingTitlesFromPlayer(requestedUser) {
  const lookup = String(requestedUser || "").trim();
  if (!lookup) {
    throw new Error("Missing username.");
  }

  const authorization = await getAuthorization();
  let accountId = "me";
  let username = lookup;

  if (lookup.toLowerCase() === "me") {
    const summary = await getUserTrophyProfileSummary(authorization, "me");
    const profile = await getProfileFromAccountId(authorization, summary.accountId);
    accountId = "me";
    username = profile.onlineId || lookup;
  } else {
    const userProfile = await getProfileFromUserName(authorization, lookup);
    accountId = userProfile.profile.accountId;
    username = userProfile.profile.onlineId || lookup;
  }

  const titlesResponse = await getUserTitles(authorization, accountId, { limit: 800 });
  const trophyTitles = titlesResponse.trophyTitles || [];

  let imported = 0;
  let skippedExisting = 0;
  let unavailable = 0;
  let failed = 0;
  const addedTitles = [];

  for (const title of trophyTitles) {
    const npCommunicationId = String(title.npCommunicationId || "").trim();
    if (!npCommunicationId) {
      continue;
    }

    const filePath = path.join(SCAN_TITLES_DIR, `${npCommunicationId}.json`);
    if (fs.existsSync(filePath)) {
      skippedExisting += 1;
      continue;
    }

    try {
      const payload = await fetchTitlePayload(
        authorization,
        npCommunicationId,
        title.npServiceName || undefined
      );

      if (!payload) {
        unavailable += 1;
        continue;
      }

      fs.mkdirSync(SCAN_TITLES_DIR, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
      appendJsonLine(SCAN_VALID_INDEX_FILE, {
        npCommunicationId,
        titleName: payload.titleName,
        titlePlatform: payload.titlePlatform,
        npServiceName: payload.npServiceName,
        totalTrophyCount: payload.totalTrophyCount,
        scannedAt: payload.scannedAt,
        source: `player-import:${username}`,
      });

      imported += 1;
      addedTitles.push({
        npCommunicationId,
        titleName: payload.titleName || npCommunicationId,
        titlePlatform: payload.titlePlatform || "Unknown",
      });
    } catch (error) {
      failed += 1;
    }
  }

  return {
    requestedUser: lookup,
    resolvedUser: username,
    totalTitles: trophyTitles.length,
    imported,
    skippedExisting,
    unavailable,
    failed,
    addedTitles,
    importedAt: new Date().toISOString(),
  };
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

function serveStaticFile(requestPath, response) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, normalizedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, file) => {
    if (error) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    response.writeHead(200, { "Content-Type": getContentType(filePath) });
    response.end(file);
  });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/api/import-player") {
    try {
      if (request.method !== "POST") {
        sendJson(response, 405, { error: "Use POST for this endpoint." });
        return;
      }

      const username = (url.searchParams.get("username") || "").trim();
      if (!username) {
        sendJson(response, 400, { error: "Missing username query parameter." });
        return;
      }

      const payload = await importMissingTitlesFromPlayer(username);
      sendJson(response, 200, payload);
    } catch (error) {
      sendJson(response, 500, {
        error: "Failed to import trophy lists from player.",
        detail: error.message,
      });
    }
    return;
  }

  if (url.pathname === "/api/psnp-plus") {
    try {
      const upstream = await fetch(PSNP_PLUS_URL);
      if (!upstream.ok) {
        sendJson(response, 502, {
          error: "Failed to fetch remote PSNP+ dataset.",
          detail: `Upstream responded with status ${upstream.status}.`,
        });
        return;
      }

      const payload = await upstream.json();
      sendJson(response, 200, payload);
    } catch (error) {
      sendJson(response, 500, {
        error: "Failed to fetch remote PSNP+ dataset.",
        detail: error.message,
      });
    }
    return;
  }

  if (url.pathname === "/api/catalog") {
    try {
      const limit = Number(url.searchParams.get("limit") || 250);
      const query = (url.searchParams.get("q") || "").trim();
      const region = (url.searchParams.get("region") || "").trim();
      const titles = query ? searchTitleCatalog(query, limit, region) : getTitleCatalog(limit, region);
      sendJson(response, 200, {
        progress: getScanProgress(),
        totalSaved: fs.existsSync(SCAN_TITLES_DIR)
          ? fs.readdirSync(SCAN_TITLES_DIR).filter((file) => file.endsWith(".json")).length
          : 0,
        availableRegions: getAvailableRegionsFromTitles(
          fs.existsSync(SCAN_TITLES_DIR) ? getTitleCatalog(Number.MAX_SAFE_INTEGER) : []
        ),
        selectedRegion: region || "all",
        titles,
      });
    } catch (error) {
      sendJson(response, 500, {
        error: "Failed to read scanned title catalog.",
        detail: error.message,
      });
    }
    return;
  }

  if (url.pathname === "/api/title") {
    try {
      const npCommunicationId = (url.searchParams.get("id") || "").trim();
      if (!npCommunicationId) {
        sendJson(response, 400, { error: "Missing id query parameter." });
        return;
      }

      const title = getTitleDetails(npCommunicationId);
      if (!title) {
        sendJson(response, 404, { error: "Title not found." });
        return;
      }

      sendJson(response, 200, title);
    } catch (error) {
      sendJson(response, 500, {
        error: "Failed to read title details.",
        detail: error.message,
      });
    }
    return;
  }

  if (url.pathname === "/api/profile") {
    try {
      const username = url.searchParams.get("username") || "me";
      const payload = await getProfileBundle(username);
      sendJson(response, 200, payload);
    } catch (error) {
      sendJson(response, 500, {
        error: "Failed to fetch PSN profile data.",
        detail: error.message,
      });
    }
    return;
  }

  serveStaticFile(url.pathname, response);
}

function startServer(port) {
  const server = http.createServer(handleRequest);

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      const nextPort = port + 1;
      console.log(`Port ${port} is busy, trying http://localhost:${nextPort} instead...`);
      startServer(nextPort);
      return;
    }

    throw error;
  });

  server.listen(port, () => {
    console.log(`PSN dashboard running at http://localhost:${port}`);
  });
}

startServer(DEFAULT_PORT);
