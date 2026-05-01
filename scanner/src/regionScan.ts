import { existsSync, readFileSync } from "node:fs";
import { postIngest } from "./post.js";
import { fetchConceptRegions, fetchProductRegions, type StoreRegion } from "./storeRegions.js";

type RegionLink = {
  npwr: string;
  conceptId?: string;
  productId?: string;
};

function env(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (value == null || value === "") throw new Error(`Missing env ${name}`);
  return value;
}

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeNpwr(value: string) {
  const trimmed = value.trim().toUpperCase();
  if (!/^NPWR\d{5}_00$/.test(trimmed)) {
    throw new Error(`Invalid NPWR ${value}`);
  }
  return trimmed;
}

function normalizeLinks(value: unknown): RegionLink[] {
  if (!Array.isArray(value)) {
    throw new Error("Region links must be a JSON array.");
  }

  return value.map(item => {
    if (!item || typeof item !== "object") {
      throw new Error("Each region link must be an object.");
    }

    const row = item as Record<string, unknown>;
    const npwr = normalizeNpwr(String(row.npwr ?? ""));
    const conceptId = row.conceptId == null || row.conceptId === "" ? undefined : String(row.conceptId);
    const productId = row.productId == null || row.productId === "" ? undefined : String(row.productId);
    if (!conceptId && !productId) {
      throw new Error(`${npwr} needs conceptId or productId.`);
    }

    return { npwr, conceptId, productId };
  });
}

function parseLineLinks(text: string): RegionLink[] {
  return text
    .split(/\r?\n|;/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.startsWith("#"))
    .map(line => {
      const [npwrRaw, targetRaw] = line.split("=", 2);
      if (!npwrRaw || !targetRaw) {
        throw new Error(`Invalid region link line: ${line}`);
      }

      const npwr = normalizeNpwr(npwrRaw);
      const [kind, id] = targetRaw.split(":", 2);
      if (!id || (kind !== "concept" && kind !== "product")) {
        throw new Error(`Invalid region link target: ${targetRaw}`);
      }

      return kind === "concept"
        ? { npwr, conceptId: id }
        : { npwr, productId: id };
    });
}

function readLinks(): RegionLink[] {
  const inline = process.env.REGION_LINKS;
  const file = arg("--links") ?? process.env.REGION_LINKS_FILE ?? "store-links.json";

  if (inline && inline.trim().startsWith("[")) {
    return normalizeLinks(JSON.parse(inline));
  }
  if (inline) {
    return parseLineLinks(inline);
  }
  if (existsSync(file)) {
    const text = readFileSync(file, "utf8");
    return text.trim().startsWith("[")
      ? normalizeLinks(JSON.parse(text))
      : parseLineLinks(text);
  }

  throw new Error("No region links found. Use REGION_LINKS, REGION_LINKS_FILE, or --links store-links.json.");
}

function rowsForRegions(npwr: string, regions: StoreRegion[]) {
  return regions.map(region => ({
    npwr,
    region_badge: region.badge,
    locale: region.locale,
    available: region.available,
    title: region.title,
    product_ids: region.productIds,
    error: region.error
  }));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const ingestUrl = dryRun ? "" : env("INGEST_URL");
  const ingestSecret = dryRun ? "" : env("INGEST_SECRET");
  const links = readLinks();

  const storeLinks: any[] = [];
  const regionRows: any[] = [];

  for (const link of links) {
    if (link.conceptId) {
      const regions = await fetchConceptRegions(link.conceptId);
      const title = regions.find(region => region.title)?.title;
      storeLinks.push({
        npwr: link.npwr,
        source_type: "concept",
        source_id: link.conceptId,
        title
      });
      regionRows.push(...rowsForRegions(link.npwr, regions));
      console.log(`${link.npwr}: ${regions.filter(region => region.available).map(region => region.badge).join(", ") || "No Store regions"}`);
    }

    if (link.productId) {
      const regions = await fetchProductRegions(link.productId);
      const title = regions.find(region => region.title)?.title;
      storeLinks.push({
        npwr: link.npwr,
        source_type: "product",
        source_id: link.productId,
        title
      });
      regionRows.push(...rowsForRegions(link.npwr, regions));
      console.log(`${link.npwr}: ${regions.filter(region => region.available).map(region => region.badge).join(", ") || "No Store regions"}`);
    }
  }

  if (dryRun) {
    console.log(`Dry run: resolved ${regionRows.length} region rows for ${links.length} NPWR links.`);
    return;
  }

  const result = await postIngest(ingestUrl, ingestSecret, {
    games: [],
    groups: [],
    trophies: [],
    store_links: storeLinks,
    regions: regionRows
  });

  console.log(`Posted ${regionRows.length} region rows for ${links.length} NPWR links.`);
  if (result.results) {
    for (const [npwr, status] of Object.entries(result.results)) {
      console.log(`${npwr}: ${status === "updated" ? "Regions Updated" : status}`);
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
