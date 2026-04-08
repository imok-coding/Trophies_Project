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
    } else if (arg === "--force") {
      options.force = true;
    }
  }

  if (!options.repo || !options.repo.includes("/")) {
    throw new Error("Use --repo owner/repo or set GITHUB_REPOSITORY.");
  }

  if (!options.token) {
    throw new Error("Set GITHUB_TOKEN or pass --token.");
  }

  return options;
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

function appendFileContents(sourceFile, targetFile) {
  if (!fs.existsSync(sourceFile)) {
    return 0;
  }

  const content = fs.readFileSync(sourceFile, "utf8");
  if (!content.trim()) {
    return 0;
  }

  fs.appendFileSync(targetFile, content.endsWith("\n") ? content : content + "\n", "utf8");
  return content.trim().split(/\r?\n/).length;
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

function mergeTitles(extractedDir) {
  const sourceDir = path.join(extractedDir, "titles");
  if (!fs.existsSync(sourceDir)) {
    return 0;
  }

  let merged = 0;
  for (const file of fs.readdirSync(sourceDir)) {
    if (!file.endsWith(".json")) {
      continue;
    }

    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(TITLES_DIR, file);
    fs.copyFileSync(sourcePath, targetPath);
    merged += 1;
  }

  return merged;
}

function mergeIndexes(extractedDir) {
  const sourceIndexDir = path.join(extractedDir, "index");
  return {
    valid: appendFileContents(path.join(sourceIndexDir, "valid.jsonl"), path.join(INDEX_DIR, "valid.jsonl")),
    invalid: appendFileContents(path.join(sourceIndexDir, "invalid.jsonl"), path.join(INDEX_DIR, "invalid.jsonl")),
    errors: appendFileContents(path.join(sourceIndexDir, "errors.jsonl"), path.join(INDEX_DIR, "errors.jsonl")),
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

  const mergedTitles = mergeTitles(artifactDir);
  const mergedIndexes = mergeIndexes(artifactDir);
  const summary = readJson(path.join(artifactDir, "summary.json"), null);

  state.importedArtifactIds = [...new Set([...(state.importedArtifactIds || []), artifact.id])];
  state.importedAt = new Date().toISOString();
  writeJson(STATE_FILE, state);

  return {
    skipped: false,
    artifactName: artifact.name,
    mergedTitles,
    mergedIndexes,
    summary,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
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
    throw new Error("No matching artifacts were found for the selected workflow run.");
  }

  const results = [];
  for (const artifact of matchingArtifacts) {
    const result = await importArtifact(options, artifact, state);
    results.push(result);
    if (result.skipped) {
      console.log(`[receive] Skipped already imported artifact ${result.artifactName}`);
    } else {
      console.log(
        `[receive] Imported ${result.artifactName} | titles ${result.mergedTitles} | valid ${result.mergedIndexes.valid} | invalid ${result.mergedIndexes.invalid} | errors ${result.mergedIndexes.errors}`
      );
    }
  }

  console.log(JSON.stringify({ runId: run.id, artifactCount: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
