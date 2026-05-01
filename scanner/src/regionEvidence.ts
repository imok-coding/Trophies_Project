import { fetchTrophyTitlesForTitleIds, type Auth } from "./psn.js";

export type RegionBadge = "NA" | "EU" | "JP" | "CN";

export type RegionEvidence = {
  npwr: string;
  region_badge: RegionBadge;
  source_type: string;
  source_id: string;
  title_id?: string;
  product_id?: string;
  confidence: number;
  evidence: Record<string, unknown>;
};

export type RegionResolution = {
  checked: string[];
  evidence: RegionEvidence[];
  regions: Array<{
    npwr: string;
    region_badge: RegionBadge;
    locale: string;
    available: boolean;
    title?: string;
    product_ids: string[];
  }>;
};

const STORE_GRAPHQL_URL = "https://web.np.playstation.com/api/graphql/v1/op";
const MOBILE_SEARCH_URL = "https://m.np.playstation.com/api/search/v1/universalSearch";
const LEGACY_NPWR_LIST_URL = "https://nextgenupdate.com/forums/ps3-trophies-game-saves/773320-list-2384-folders-w-npwr-ids-titles.html";

const OPERATION_HASHES = {
  metGetProductById: "a128042177bd93dd831164103d53b73ef790d56f51dae647064cb8f9d9fc9d1a",
  metGetConceptById: "cc90404ac049d935afbd9968aef523da2b6723abfb9d586e5f77ebf7c5289006"
} as const;

let legacyRegionMap: Promise<Map<string, { badge: RegionBadge; title: string; source: string }>> | undefined;

export function badgeFromProductId(productId: string): RegionBadge | undefined {
  const prefix = productId.slice(0, 2).toUpperCase();
  if (prefix === "UP") return "NA";
  if (prefix === "EP") return "EU";
  if (prefix === "JP") return "JP";
  if (prefix === "CP") return "CN";
  return undefined;
}

export function badgeFromLegacyTitleId(titleId: string): RegionBadge | undefined {
  const prefix = titleId.replace("-", "").slice(0, 4).toUpperCase();
  if (/^(BCES|BLES|NPE[A-Z]|PCSB|PCSF|UCES|ULES)$/.test(prefix)) return "EU";
  if (/^(BCJS|BCJB|BLJS|BLJM|NPJ[A-Z]|PCJS|PCJB|UCJS|UCJB|ULJS|ULJM)$/.test(prefix)) return "JP";
  if (/^(BCUS|BLUS|NP[A-Z]?A|NPU[A-Z]|PCSA|PCSE|PCSI|UCUS|ULUS)$/.test(prefix)) return "NA";
  return undefined;
}

export function normalizeStoreTitle(value: string): string {
  return value
    .replace(/[™®©]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(trophies|trophy\s+set|trophy\s+list)\b/gi, "")
    .replace(/['’`]/g, "")
    .replace(/[.,:;!?()[\]{}_\-–—/\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function badgeFromLegacyMarker(marker: string | undefined): RegionBadge | undefined {
  if (!marker) return undefined;
  const value = marker.trim().toUpperCase();
  if (value === "USA" || value === "US" || value === "NA") return "NA";
  if (value === "EUR" || value === "EU" || value === "PAL") return "EU";
  if (value === "JPN" || value === "JP" || value === "JAPAN") return "JP";
  if (value === "CHN" || value === "CN" || value === "CHINA") return "CN";
  return undefined;
}

async function fetchLegacyRegionMap() {
  const response = await fetch(LEGACY_NPWR_LIST_URL, {
    headers: { "User-Agent": "TrophyProjectScanner/1.0" }
  });
  if (!response.ok) {
    throw new Error(`Legacy NPWR list failed ${response.status}`);
  }

  const html = await response.text();
  const text = decodeHtml(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/\r/g, "");
  const map = new Map<string, { badge: RegionBadge; title: string; source: string }>();

  const lines = text.split("\n").map(line => line.replace(/\s+/g, " ").trim());
  for (let index = 0; index < lines.length; index++) {
    let line = lines[index];
    let match = line.match(/\b(NPWR\d{5}_00)\b\s+(.+?)(?:\s+\[(USA|EUR|JPN|CHN|NA|EU|JP|CN|PAL|JAPAN|CHINA)\])?$/i);
    if (!match) {
      const npwrOnly = line.match(/^\b(NPWR\d{5}_00)\b$/i);
      if (!npwrOnly) continue;

      const titleLine = lines.slice(index + 1).find(value => value !== "");
      if (!titleLine) continue;
      line = `${npwrOnly[1]} ${titleLine}`;
      match = line.match(/\b(NPWR\d{5}_00)\b\s+(.+?)(?:\s+\[(USA|EUR|JPN|CHN|NA|EU|JP|CN|PAL|JAPAN|CHINA)\])?$/i);
      if (!match) continue;
    }

    const npwr = match[1].toUpperCase();
    const title = match[2].trim();
    const badge = badgeFromLegacyMarker(match[3]);
    if (!badge) continue;
    map.set(npwr, { badge, title, source: LEGACY_NPWR_LIST_URL });
  }

  return map;
}

async function resolveLegacyRegion(npwr: string, titleName: string): Promise<RegionEvidence[]> {
  legacyRegionMap ??= fetchLegacyRegionMap();
  const map = await legacyRegionMap;
  const row = map.get(npwr);
  if (!row) return [];

  const scanned = normalizeStoreTitle(titleName);
  const listed = normalizeStoreTitle(row.title);
  if (scanned === "" || listed === "" || scanned !== listed) return [];

  return [{
    npwr,
    region_badge: row.badge,
    source_type: "legacy_npwr_list",
    source_id: npwr,
    confidence: 82,
    evidence: {
      titleName,
      listedTitle: row.title,
      source: row.source,
      verification: "NPWR and normalized title matched legacy NPWR folder list"
    }
  }];
}

function titleFromSearchResult(result: any): string {
  const concept = result?.conceptMetadata;
  const product = result?.productMetadata;
  return concept?.nameEn ?? concept?.name ?? product?.nameEn ?? product?.name ?? "";
}

function collectIds(value: unknown, out = {
  concepts: new Set<string>(),
  products: new Set<string>(),
  titleIds: new Set<string>()
}) {
  if (!value || typeof value !== "object") return out;

  if (Array.isArray(value)) {
    for (const item of value) collectIds(item, out);
    return out;
  }

  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string") {
      if (/^[A-Z]{2}\d{4}-[A-Z0-9]{9}_[A-Z0-9]{2}-[A-Z0-9_]+$/.test(child)) {
        out.products.add(child);
        const titleId = titleIdFromProductId(child);
        if (titleId) out.titleIds.add(titleId);
      } else if (/^[A-Z0-9]{9}_[A-Z0-9]{2}$/.test(child)) {
        out.titleIds.add(child);
      } else if ((key === "conceptId" || key === "id") && /^\d+$/.test(child)) {
        out.concepts.add(child);
      }
    } else if (typeof child === "number" && (key === "conceptId" || key === "id")) {
      out.concepts.add(String(child));
    }
    collectIds(child, out);
  }

  return out;
}

function titleIdFromProductId(productId: string): string | undefined {
  const parts = productId.split("-");
  return /^[A-Z0-9]{9}_[A-Z0-9]{2}$/.test(parts[1] ?? "") ? parts[1] : undefined;
}

async function storeGraphql(operationName: keyof typeof OPERATION_HASHES, variables: Record<string, string>) {
  const url = new URL(STORE_GRAPHQL_URL);
  url.searchParams.set("operationName", operationName);
  url.searchParams.set("variables", JSON.stringify(variables));
  url.searchParams.set("extensions", JSON.stringify({
    persistedQuery: {
      version: 1,
      sha256Hash: OPERATION_HASHES[operationName]
    }
  }));

  const response = await fetch(url, {
    headers: {
      "content-type": "application/json",
      "x-psn-store-locale-override": "en-us"
    }
  });

  return await response.json().catch(() => ({}));
}

async function mobileGameSearch(auth: Auth, titleName: string) {
  const response = await fetch(MOBILE_SEARCH_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      searchTerm: titleName,
      domainRequests: [
        { domain: "MobileGames" }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Store search failed ${response.status}`);
  }

  return await response.json() as any;
}

async function expandStoreCandidateIds(conceptIds: Set<string>, productIds: Set<string>) {
  const expandedProducts = new Set(productIds);
  const titleIds = new Set<string>();

  for (const productId of productIds) {
    const titleId = titleIdFromProductId(productId);
    if (titleId) titleIds.add(titleId);
  }

  for (const conceptId of [...conceptIds].slice(0, 4)) {
    const data = await storeGraphql("metGetConceptById", { conceptId });
    const ids = collectIds(data);
    for (const productId of ids.products) {
      expandedProducts.add(productId);
      const titleId = titleIdFromProductId(productId);
      if (titleId) titleIds.add(titleId);
    }
    for (const titleId of ids.titleIds) titleIds.add(titleId);
  }

  for (const productId of [...expandedProducts].slice(0, 20)) {
    const data = await storeGraphql("metGetProductById", { productId });
    const ids = collectIds(data);
    for (const titleId of ids.titleIds) titleIds.add(titleId);
  }

  return { productIds: expandedProducts, titleIds };
}

async function titleIdsVerifiedForNpwr(auth: Auth, npwr: string, titleIds: string[]) {
  const verified = new Set<string>();
  for (let i = 0; i < titleIds.length; i += 5) {
    const batch = titleIds.slice(i, i + 5);
    const response = await fetchTrophyTitlesForTitleIds(auth, batch).catch(() => undefined);
    const titles = Array.isArray((response as any)?.titles) ? (response as any).titles : [];
    for (const title of titles) {
      const trophyTitles = Array.isArray(title?.trophyTitles) ? title.trophyTitles : [];
      if (trophyTitles.some((trophyTitle: any) => trophyTitle?.npCommunicationId === npwr)) {
        verified.add(String(title.npTitleId));
      }
    }
  }
  return verified;
}

export async function resolveVerifiedRegionsForNpwr(auth: Auth, npwr: string, titleName: string): Promise<RegionResolution> {
  const checked = [npwr];
  const fallbackEvidence = await resolveLegacyRegion(npwr, titleName).catch(() => []);
  const wanted = normalizeStoreTitle(titleName);
  if (wanted === "") return { checked, evidence: fallbackEvidence, regions: rowsForSingleRegion(npwr, titleName, fallbackEvidence) };

  const search = await mobileGameSearch(auth, titleName).catch(() => undefined);
  if (!search) return { checked, evidence: fallbackEvidence, regions: rowsForSingleRegion(npwr, titleName, fallbackEvidence) };
  const domain = (search as any)?.domainResponses?.find((item: any) => item?.domain === "MobileGames")
    ?? (search as any)?.domainResponses?.[0];
  const results = Array.isArray(domain?.results) ? domain.results : [];
  const exactResults = results.filter((result: any) => normalizeStoreTitle(titleFromSearchResult(result)) === wanted);
  if (exactResults.length === 0) return { checked, evidence: fallbackEvidence, regions: rowsForSingleRegion(npwr, titleName, fallbackEvidence) };

  const seedConcepts = new Set<string>();
  const seedProducts = new Set<string>();
  for (const result of exactResults.slice(0, 5)) {
    const ids = collectIds(result);
    for (const conceptId of ids.concepts) seedConcepts.add(conceptId);
    for (const productId of ids.products) seedProducts.add(productId);
  }

  const { productIds, titleIds } = await expandStoreCandidateIds(seedConcepts, seedProducts);
  const verifiedTitleIds = await titleIdsVerifiedForNpwr(auth, npwr, [...titleIds].slice(0, 50));
  const evidence: RegionEvidence[] = [...fallbackEvidence];

  for (const productId of productIds) {
    const titleId = titleIdFromProductId(productId);
    if (!titleId || !verifiedTitleIds.has(titleId)) continue;
    const badge = badgeFromProductId(productId);
    if (!badge) continue;
    evidence.push({
      npwr,
      region_badge: badge,
      source_type: "psn_title_product",
      source_id: productId,
      title_id: titleId,
      product_id: productId,
      confidence: 100,
      evidence: { titleName, matchedTitle: titleName, verification: "npTitleId returned scanned NPWR" }
    });
  }

  for (const titleId of verifiedTitleIds) {
    if (evidence.some(row => row.title_id === titleId)) continue;
    const badge = badgeFromLegacyTitleId(titleId);
    if (!badge) continue;
    evidence.push({
      npwr,
      region_badge: badge,
      source_type: "psn_title_id",
      source_id: titleId,
      title_id: titleId,
      confidence: 90,
      evidence: { titleName, verification: "npTitleId returned scanned NPWR; region from legacy title ID prefix" }
    });
  }

  return { checked, evidence, regions: rowsForSingleRegion(npwr, titleName, evidence) };
}

function rowsForSingleRegion(npwr: string, titleName: string, evidence: RegionEvidence[]) {
  const uniqueBadges = [...new Set(evidence.map(row => row.region_badge))];
  if (uniqueBadges.length !== 1) return [];

  const productIds = evidence
    .map(row => row.product_id)
    .filter((value): value is string => Boolean(value));
  return [{
    npwr,
    region_badge: uniqueBadges[0],
    locale: evidence.some(row => row.confidence === 100) ? "verified" : "legacy",
    available: true,
    title: titleName,
    product_ids: productIds
  }];
}
