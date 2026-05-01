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

const OPERATION_HASHES = {
  metGetProductById: "a128042177bd93dd831164103d53b73ef790d56f51dae647064cb8f9d9fc9d1a",
  metGetConceptById: "cc90404ac049d935afbd9968aef523da2b6723abfb9d586e5f77ebf7c5289006"
} as const;

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
  const wanted = normalizeStoreTitle(titleName);
  if (wanted === "") return { checked, evidence: [], regions: [] };

  const search = await mobileGameSearch(auth, titleName);
  const domain = (search as any)?.domainResponses?.find((item: any) => item?.domain === "MobileGames")
    ?? (search as any)?.domainResponses?.[0];
  const results = Array.isArray(domain?.results) ? domain.results : [];
  const exactResults = results.filter((result: any) => normalizeStoreTitle(titleFromSearchResult(result)) === wanted);
  if (exactResults.length === 0) return { checked, evidence: [], regions: [] };

  const seedConcepts = new Set<string>();
  const seedProducts = new Set<string>();
  for (const result of exactResults.slice(0, 5)) {
    const ids = collectIds(result);
    for (const conceptId of ids.concepts) seedConcepts.add(conceptId);
    for (const productId of ids.products) seedProducts.add(productId);
  }

  const { productIds, titleIds } = await expandStoreCandidateIds(seedConcepts, seedProducts);
  const verifiedTitleIds = await titleIdsVerifiedForNpwr(auth, npwr, [...titleIds].slice(0, 50));
  const evidence: RegionEvidence[] = [];

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

  const uniqueBadges = [...new Set(evidence.map(row => row.region_badge))];
  const regions = uniqueBadges.length === 1
    ? [{
        npwr,
        region_badge: uniqueBadges[0],
        locale: "verified",
        available: true,
        title: titleName,
        product_ids: evidence.map(row => row.product_id).filter((value): value is string => Boolean(value))
      }]
    : [];

  return { checked, evidence, regions };
}
