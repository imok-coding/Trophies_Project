const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data", "npwr");
const INDEX_DIR = path.join(DATA_DIR, "index");
const TITLES_DIR = path.join(DATA_DIR, "titles");
const PROGRESS_FILE = path.join(DATA_DIR, "progress.json");

function countLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return 0;
  }

  const content = fs.readFileSync(filePath, "utf8");
  if (!content.trim()) {
    return 0;
  }

  return content.trim().split("\n").length;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

const progress = readJson(PROGRESS_FILE);
const validLines = countLines(path.join(INDEX_DIR, "valid.jsonl"));
const invalidLines = countLines(path.join(INDEX_DIR, "invalid.jsonl"));
const errorLines = countLines(path.join(INDEX_DIR, "errors.jsonl"));
const titleFiles = fs.existsSync(TITLES_DIR)
  ? fs.readdirSync(TITLES_DIR).filter((file) => file.endsWith(".json")).length
  : 0;

console.log(
  JSON.stringify(
    {
      progress,
      files: {
        savedTitles: titleFiles,
        validEntries: validLines,
        invalidEntries: invalidLines,
        errorEntries: errorLines,
      },
      paths: {
        dataDir: DATA_DIR,
        titlesDir: TITLES_DIR,
        indexDir: INDEX_DIR,
      },
    },
    null,
    2
  )
);
