const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const TITLES_DIR = path.join(ROOT_DIR, "data", "npwr", "titles");
const ASSETS_DIR = path.join(ROOT_DIR, "assets");

function parseArgs(argv) {
  const options = {
    id: "",
    limit: 0,
    force: false,
    delayMs: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--id" && next) {
      options.id = next.trim();
      index += 1;
    } else if (arg === "--limit" && next) {
      options.limit = Number(next);
      index += 1;
    } else if (arg === "--delay-ms" && next) {
      options.delayMs = Number(next);
      index += 1;
    } else if (arg === "--force") {
      options.force = true;
    }
  }

  if (options.id && !/^NPWR\d{5}_\d{2}$/i.test(options.id)) {
    throw new Error("Use --id with a value like NPWR45823_00.");
  }

  if (!Number.isInteger(options.limit) || options.limit < 0) {
    throw new Error("limit must be zero or greater.");
  }

  if (!Number.isFinite(options.delayMs) || options.delayMs < 0) {
    throw new Error("delay-ms must be zero or greater.");
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeFolderName(npCommunicationId) {
  return String(npCommunicationId || "").toLowerCase();
}

function getJsonFiles(options) {
  if (!fs.existsSync(TITLES_DIR)) {
    throw new Error(`Titles directory not found: ${TITLES_DIR}`);
  }

  if (options.id) {
    const filePath = path.join(TITLES_DIR, `${options.id.toUpperCase()}.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Title JSON not found: ${filePath}`);
    }
    return [filePath];
  }

  const files = fs
    .readdirSync(TITLES_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => path.join(TITLES_DIR, file));

  return options.limit > 0 ? files.slice(0, options.limit) : files;
}

function getExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const extension = path.extname(pathname);
    return extension || ".png";
  } catch {
    return ".png";
  }
}

function getSourceFileNameFromUrl(url, fallbackName) {
  try {
    const pathname = new URL(url).pathname;
    const baseName = path.basename(pathname);
    if (baseName) {
      return baseName;
    }
  } catch {
    // Fall through to the generated fallback name.
  }

  return fallbackName;
}


function buildDownloadList(title) {
  const downloads = [];

  if (title.titleIconUrl) {
    downloads.push({
      type: "title",
      key: "title",
      url: title.titleIconUrl,
      filename: getSourceFileNameFromUrl(
        title.titleIconUrl,
        `title${getExtensionFromUrl(title.titleIconUrl)}`
      ),
    });
  }

  for (const group of title.trophyGroups || []) {
    if (!group.trophyGroupIconUrl) {
      continue;
    }

    const groupId = String(group.trophyGroupId || "default").toLowerCase();
    downloads.push({
      type: "group",
      key: `group:${groupId}`,
      url: group.trophyGroupIconUrl,
      filename: getSourceFileNameFromUrl(
        group.trophyGroupIconUrl,
        `group-${groupId}${getExtensionFromUrl(group.trophyGroupIconUrl)}`
      ),
    });
  }

  for (const trophy of title.trophies || []) {
    if (!trophy.trophyIconUrl) {
      continue;
    }

    downloads.push({
      type: "trophy",
      key: `trophy:${trophy.trophyId}`,
      url: trophy.trophyIconUrl,
      filename: getSourceFileNameFromUrl(
        trophy.trophyIconUrl,
        `trophy-${String(trophy.trophyId).padStart(3, "0")}${getExtensionFromUrl(
          trophy.trophyIconUrl
        )}`
      ),
    });
  }

  const seen = new Set();
  return downloads.filter((entry) => {
    if (seen.has(entry.key)) {
      return false;
    }

    seen.add(entry.key);
    return true;
  });
}

async function downloadFile(url, destinationPath, force) {
  if (!force && fs.existsSync(destinationPath)) {
    return { status: "skipped" };
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(destinationPath, Buffer.from(arrayBuffer));
  return { status: "downloaded" };
}

async function processTitleFile(filePath, options) {
  const title = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const npCommunicationId = String(title.npCommunicationId || path.basename(filePath, ".json")).toUpperCase();
  const assetFolder = path.join(ASSETS_DIR, sanitizeFolderName(npCommunicationId));
  const downloads = buildDownloadList(title);

  ensureDirectory(assetFolder);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const manifest = {
    npCommunicationId,
    titleName: title.titleName || null,
    generatedAt: new Date().toISOString(),
    files: [],
  };

  for (const entry of downloads) {
    const destinationPath = path.join(assetFolder, entry.filename);

    try {
      const result = await downloadFile(entry.url, destinationPath, options.force);
      if (result.status === "downloaded") {
        downloaded += 1;
      } else {
        skipped += 1;
      }

      manifest.files.push({
        type: entry.type,
        key: entry.key,
        file: entry.filename,
        sourceUrl: entry.url,
      });
    } catch (error) {
      failed += 1;
      manifest.files.push({
        type: entry.type,
        key: entry.key,
        file: entry.filename,
        sourceUrl: entry.url,
        error: error.message,
      });
      console.log(`[asset-error] ${npCommunicationId} ${entry.filename} ${error.message}`);
    }

    if (options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  fs.writeFileSync(path.join(assetFolder, "manifest.json"), JSON.stringify(manifest, null, 2));

  return {
    npCommunicationId,
    titleName: title.titleName || npCommunicationId,
    total: downloads.length,
    downloaded,
    skipped,
    failed,
    assetFolder,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = getJsonFiles(options);

  ensureDirectory(ASSETS_DIR);

  let titleCount = 0;
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of files) {
    const result = await processTitleFile(filePath, options);
    titleCount += 1;
    downloaded += result.downloaded;
    skipped += result.skipped;
    failed += result.failed;

    console.log(
      `[assets] ${result.npCommunicationId} ${result.titleName} | downloaded ${result.downloaded} | skipped ${result.skipped} | failed ${result.failed}`
    );
  }

  console.log(
    JSON.stringify(
      {
        processedTitles: titleCount,
        downloaded,
        skipped,
        failed,
        assetsDir: ASSETS_DIR,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
