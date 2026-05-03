import { mkdir, cp, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "gh-pages-dist");
const sourceDir = path.join(root, "github-pages");
const siteAssetsDir = path.join(root, "site", "assets");
const siteBase = process.env.TROPHY_SITE_BASE || "https://trophyproject.pro";
const exportUrl = process.env.PAGES_EXPORT_URL || `${siteBase}/api/pages-export.php`;
const ingestSecret = process.env.INGEST_SECRET || "";

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }
  return await response.json();
}

async function fetchExport() {
  if (!ingestSecret) {
    throw new Error("INGEST_SECRET not set for export endpoint");
  }

  return await fetchJson(exportUrl, {
    headers: {
      "X-Ingest-Secret": ingestSecret,
      "User-Agent": "TrophyProjectPagesBuilder/1.0"
    }
  });
}

async function fetchPublicPages() {
  const first = await fetchJson(`${siteBase}/api/games.php?page=1`);
  const games = [...(first.games || [])];

  for (let page = 2; page <= Number(first.totalPages || 1); page += 1) {
    const payload = await fetchJson(`${siteBase}/api/games.php?page=${page}`);
    games.push(...(payload.games || []));
  }

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    total: games.length,
    games
  };
}

async function build() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(path.join(outDir, "data"), { recursive: true });
  await cp(sourceDir, outDir, { recursive: true });
  await cp(path.join(siteAssetsDir, "trophy"), path.join(outDir, "assets", "trophy"), { recursive: true });
  await cp(path.join(siteAssetsDir, "trophy-project-logo.webp"), path.join(outDir, "assets", "trophy-project-logo.webp"));
  await writeFile(path.join(outDir, ".nojekyll"), "", "utf8");

  let payload;
  try {
    payload = await fetchExport();
    console.log(`Fetched private export with ${payload.total} games.`);
  } catch (error) {
    console.log(`Private export failed, falling back to public paginated API: ${error.message}`);
    payload = await fetchPublicPages();
    console.log(`Fetched public export with ${payload.total} games.`);
  }

  payload.games.sort((left, right) =>
    String(left.title || "").localeCompare(String(right.title || ""), undefined, { sensitivity: "base" })
      || String(left.npwr || "").localeCompare(String(right.npwr || ""))
  );

  await writeFile(path.join(outDir, "data", "games.json"), JSON.stringify(payload), "utf8");
  await writeFile(path.join(outDir, "data", "metadata.json"), JSON.stringify({
    generatedAt: payload.generatedAt,
    total: payload.total
  }, null, 2), "utf8");
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
