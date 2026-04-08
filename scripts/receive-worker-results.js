const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data", "npwr");
const TITLES_DIR = path.join(DATA_DIR, "titles");
const INDEX_DIR = path.join(DATA_DIR, "index");
const STATE_FILE = path.join(DATA_DIR, "cloud-receiver-state.json");
const TEMP_DIR = path.join(ROOT_DIR, "data", "cloud-artifacts");
const DEFAULT_WORKFLOW_FILE = "npwr-cloud-scan.yml";
const DEFAULT_REPO = process.env.GITHUB_REPOSITORY || "imok-coding/Trophies_Project";

function parseArgs(argv) {
  const options = {
    repo: DEFAULT_REPO,
    workflowFile: DEFAULT_WORKFLOW_FILE,
    runId: "",
    artifactName: "",
    token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "",
    force: false,
    watch: false,
    pollSeconds: 120,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--repo" && next) {
      options.repo = next.trim();
      index += 1;
    } else if (arg === "--workflow-file" && next) {
      options.workflowFile = next.trim();
      index += 1;
    } else if (arg === "--run-id" && next) {
      options.runId = next.trim();
      index += 1;
    } else if (arg === "--artifact" && next) {
      options.artifactName = next.trim();
      index += 1;
    } else if (arg === "--token" && next) {
      options.token = next.trim();
      index += 1;
    } else if (arg === "--poll-seconds" && next) {
      options.pollSeconds = Number(next);
      index += 1;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--watch") {
      options.watch = true;
    }
  }

  if (!options.repo || !options.repo.includes("/")) {
    throw new Error("Use --repo owner/repo or set GITHUB_REPOSITORY.");
  }

  if (!options.token) {
    throw new Error("Set GITHUB_TOKEN or pass --token.");
  }

  if (!Number.isFinite(options.pollSeconds) || options.pollSeconds < 15) {
    throw new Error("poll-seconds must be at least 15.");
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDirectories() {
  fs.mkdirSync(TITLES_DIR, { recursive: true });
  fs.mkdirSync(INDEX_DIR, { recursive: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function readJson(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    return fallbackValue;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallbackValue;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
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

function appendFilteredJsonLines(sourceFile, targetFile, predicate) {
  const entries = readJsonLines(sourceFile).filter(predicate);
  if (!entries.length) {
    return 0;
  }

  fs.appendFileSync(targetFile, entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8");
  return entries.length;
}

function findPowerShellExecutable() {
  const candidates = ["powershell.exe", "pwsh.exe"];

  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
        stdio: "pipe",
        encoding: "utf8",
      });
      if (result.status === 0) {
        return candidate;
      }
    } catch {
      // Try next.
    }
  }

  throw new Error("PowerShell was not found. It is required to expand downloaded artifact ZIP files.");
}

function expandArchive(zipPath, destinationPath) {
  const shell = findPowerShellExecutable();
  const command = `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destinationPath.replace(/'/g, "''")}' -Force`;
  const result = spawnSync(shell, ["-NoProfile", "-Command", command], {
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "Failed to expand artifact ZIP.").trim());
  }
}

async function githubRequest(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "trophyproject-cloud-receiver",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${await response.text()}`);
  }

  return response;
}

async function getWorkflowRuns(options) {
  const [owner, repo] = options.repo.split("/");
  if (options.runId) {
    const response = await githubRequest(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${options.runId}`,
      options.token
    );
    return [await response.json()];
  }

  const response = await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${options.workflowFile}/runs?per_page=10`,
    options.token
  );
  const payload = await response.json();
  return payload.workflow_runs || [];
}

async function getArtifactsForRun(options, runId) {
  const [owner, repo] = options.repo.split("/");
  const response = await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts?per_page=100`,
    options.token
  );
  const payload = await response.json();
  return (payload.artifacts || []).filter((artifact) => !artifact.expired);
}

async function downloadArtifactZip(options, artifact, destinationZipPath) {
  const response = await githubRequest(artifact.archive_download_url, options.token);
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(destinationZipPath, Buffer.from(arrayBuffer));
}

function mergeTitles(extractedDir, options) {
  const sourceDir = path.join(extractedDir, "titles");
  if (!fs.existsSync(sourceDir)) {
    return { merged: 0, skippedExisting: 0, importedIds: new Set() };
  }

  let merged = 0;
  let skippedExisting = 0;
  const importedIds = new Set();

  for (const file of fs.readdirSync(sourceDir)) {
    if (!file.endsWith(".json")) {
      continue;
    }

    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(TITLES_DIR, file);
    const npCommunicationId = path.basename(file, ".json").toUpperCase();

    if (!options.force && fs.existsSync(targetPath)) {
      skippedExisting += 1;
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
    importedIds.add(npCommunicationId);
    merged += 1;
  }

  return { merged, skippedExisting, importedIds };
}

function mergeIndexes(extractedDir, importedIds, options) {
  const sourceIndexDir = path.join(extractedDir, "index");
  const shouldImportById = (entry) => {
    const npCommunicationId = String(entry?.npCommunicationId || "").toUpperCase();

    if (importedIds.has(npCommunicationId)) {
      return true;
    }

    if (options.force) {
      return true;
    }

    return npCommunicationId
      ? !fs.existsSync(path.join(TITLES_DIR, npCommunicationId + ".json"))
      : true;
  };

  return {
    valid: appendFilteredJsonLines(
      path.join(sourceIndexDir, "valid.jsonl"),
      path.join(INDEX_DIR, "valid.jsonl"),
      (entry) => importedIds.has(String(entry?.npCommunicationId || "").toUpperCase())
    ),
    invalid: appendFilteredJsonLines(
      path.join(sourceIndexDir, "invalid.jsonl"),
      path.join(INDEX_DIR, "invalid.jsonl"),
      shouldImportById
    ),
    errors: appendFilteredJsonLines(
      path.join(sourceIndexDir, "errors.jsonl"),
      path.join(INDEX_DIR, "errors.jsonl"),
      shouldImportById
    ),
  };
}

async function importArtifact(options, artifact, state) {
  if (!options.force && state.importedArtifactIds?.includes(artifact.id)) {
    return { skipped: true, artifactName: artifact.name };
  }

  const artifactDir = path.join(TEMP_DIR, String(artifact.id));
  const zipPath = path.join(TEMP_DIR, `artifact-${artifact.id}.zip`);

  fs.rmSync(artifactDir, { recursive: true, force: true });
  fs.rmSync(zipPath, { force: true });

  await downloadArtifactZip(options, artifact, zipPath);
  fs.mkdirSync(artifactDir, { recursive: true });
  expandArchive(zipPath, artifactDir);

  const mergeResult = mergeTitles(artifactDir, options);
  const mergedIndexes = mergeIndexes(artifactDir, mergeResult.importedIds, options);
  const summary = readJson(path.join(artifactDir, "summary.json"), null);

  state.importedArtifactIds = [...new Set([...(state.importedArtifactIds || []), artifact.id])];
  state.importedAt = new Date().toISOString();
  writeJson(STATE_FILE, state);

  return {
    skipped: false,
    artifactName: artifact.name,
    mergedTitles: mergeResult.merged,
    skippedExistingTitles: mergeResult.skippedExisting,
    mergedIndexes,
    summary,
  };
}

async function receiveOnce(options) {
  ensureDirectories();
  const state = readJson(STATE_FILE, { importedArtifactIds: [] });
  const runs = await getWorkflowRuns(options);

  if (!runs.length) {
    throw new Error("No workflow runs were found.");
  }

  const run = runs[0];
  const artifacts = await getArtifactsForRun(options, run.id);
  const matchingArtifacts = options.artifactName
    ? artifacts.filter((artifact) => artifact.name === options.artifactName)
    : artifacts;

  if (!matchingArtifacts.length) {
    return { runId: run.id, artifactCount: 0, results: [] };
  }

  const results = [];
  for (const artifact of matchingArtifacts) {
    const result = await importArtifact(options, artifact, state);
    results.push(result);
    if (result.skipped) {
      console.log(`[receive] Skipped already imported artifact ${result.artifactName}`);
    } else {
      console.log(
        `[receive] Imported ${result.artifactName} | titles ${result.mergedTitles} | skipped-existing ${result.skippedExistingTitles} | valid ${result.mergedIndexes.valid} | invalid ${result.mergedIndexes.invalid} | errors ${result.mergedIndexes.errors}`
      );
    }
  }

  return { runId: run.id, artifactCount: results.length, results };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.watch) {
    console.log(JSON.stringify(await receiveOnce(options), null, 2));
    return;
  }

  console.log(`[receive-watch] Watching ${options.repo} every ${options.pollSeconds}s`);
  while (true) {
    try {
      const result = await receiveOnce(options);
      if (result.results.length) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`[receive-watch] No new artifacts at ${new Date().toLocaleString()}`);
      }
    } catch (error) {
      console.error(`[receive-watch-error] ${error.message}`);
    }

    await sleep(options.pollSeconds * 1000);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
