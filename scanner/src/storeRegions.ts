export type RegionBadge = "NA" | "EU" | "JP" | "CN";

export type StoreRegion = {
  badge: RegionBadge;
  locale: string;
  available: boolean;
  title?: string;
  productIds: string[];
  error?: string;
};

export type StoreRegionResolution = {
  sourceType: "concept" | "product" | "serialstation";
  sourceId: string;
  title?: string;
  regions: StoreRegion[];
};

type AuthLike = { accessToken: string };

const STORE_GRAPHQL_URL = "https://web.np.playstation.com/api/graphql/v1/op";
const MOBILE_SEARCH_URL = "https://m.np.playstation.com/api/search/v1/universalSearch";
const SERIALSTATION_URL = "https://serialstation.com";
const SERIALSTATION_API_URL = "https://api.serialstation.com/v1";

const OPERATION_HASHES = {
  metGetProductById: "a128042177bd93dd831164103d53b73ef790d56f51dae647064cb8f9d9fc9d1a",
  metGetConceptById: "cc90404ac049d935afbd9968aef523da2b6723abfb9d586e5f77ebf7c5289006"
} as const;

export const STORE_REGION_LOCALES: ReadonlyArray<{ badge: RegionBadge; locale: string }> = [
  { badge: "NA", locale: "en-us" },
  { badge: "EU", locale: "en-gb" },
  { badge: "JP", locale: "ja-jp" },
  { badge: "CN", locale: "zh-hans-cn" }
];

export function badgeFromProductId(productId: string): RegionBadge | undefined {
  const prefix = productId.slice(0, 2).toUpperCase();
  if (prefix === "UP") return "NA";
  if (prefix === "EP") return "EU";
  if (prefix === "JP") return "JP";
  if (prefix === "CP") return "CN";
  return undefined;
}

export function badgeFromTitleId(titleId: string): RegionBadge | undefined {
  const prefix = titleId.replace("-", "").slice(0, 4).toUpperCase();
  if (/^(BCES|BLES|NPE[A-Z]|PCSB|PCSF|UCES|ULES)$/.test(prefix)) return "EU";
  if (/^(BCJS|BCJB|BLJS|BLJM|NPJ[A-Z]|PCJS|PCJB|UCJS|UCJB|ULJS|ULJM)$/.test(prefix)) return "JP";
  if (/^(BCUS|BLUS|NP[A-Z]?A|NPU[A-Z]|PCSA|PCSE|PCSI|UCUS|ULUS)$/.test(prefix)) return "NA";
  return undefined;
}

export function npwrDigits(npwr: string): string | undefined {
  return npwr.match(/^NPWR(\d{5})_00$/)?.[1];
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

async function storeGraphql(operationName: keyof typeof OPERATION_HASHES, variables: Record<string, string>, locale: string) {
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
      "x-psn-store-locale-override": locale
    }
  });

  const body = await response.json().catch(() => ({}));
  return body as any;
}

async function fetchText(url: string): Promise<string | undefined> {
  const response = await fetch(url, {
    headers: { "User-Agent": "TrophyProjectScanner/1.0" }
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`SerialStation failed ${response.status}`);
  return await response.text();
}

async function fetchJson(url: string): Promise<any | undefined> {
  const response = await fetch(url, {
    headers: { "User-Agent": "TrophyProjectScanner/1.0" }
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`SerialStation API failed ${response.status}`);
  return await response.json();
}

async function mobileGameSearch(auth: AuthLike, titleName: string) {
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

function collectProductIds(value: unknown, out = new Set<string>()) {
  if (!value || typeof value !== "object") return out;

  if (Array.isArray(value)) {
    for (const item of value) collectProductIds(item, out);
    return out;
  }

  for (const [key, child] of Object.entries(value)) {
    if (
      (key === "id" || key === "productId") &&
      typeof child === "string" &&
      /^[A-Z]{2}\d{4}-/.test(child)
    ) {
      out.add(child);
    }
    collectProductIds(child, out);
  }

  return out;
}

function firstError(data: any): string | undefined {
  return typeof data?.errors?.[0]?.message === "string" ? data.errors[0].message : undefined;
}

function conceptTitle(concept: any): string | undefined {
  return concept?.name ??
    concept?.invariantName ??
    concept?.defaultProduct?.name ??
    concept?.defaultProduct?.invariantName;
}

function productTitle(product: any): string | undefined {
  return product?.name ??
    product?.invariantName ??
    product?.concept?.name ??
    product?.concept?.invariantName;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function titleFromHtml(html: string): string | undefined {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return undefined;
  return decodeHtml(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function titleIdsFromHtml(html: string): string[] {
  const out = new Set<string>();
  for (const match of html.matchAll(/\/titles\/([A-Z0-9]{4})\/(\d{5})/g)) {
    out.add(`${match[1]}${match[2]}`);
  }
  for (const match of html.matchAll(/\b([A-Z0-9]{4})-(\d{5})\b/g)) {
    out.add(`${match[1]}${match[2]}`);
  }
  return [...out];
}

function contentIdsFromHtml(html: string): string[] {
  return [...new Set([...html.matchAll(/\b[A-Z]{2}\d{4}-[A-Z0-9]{9}_[A-Z0-9]{2}-[A-Z0-9_]{16}\b/g)].map(match => match[0]))];
}

async function serialStationTrophyHtml(digits: string, trophySetVersion?: string): Promise<string | undefined> {
  const versions = [...new Set([trophySetVersion, "01.00"].filter(Boolean))] as string[];
  for (const version of versions) {
    const ajax = await fetchText(`${SERIALSTATION_URL}/ajax/table/trophies/NPWR/${digits}/${encodeURIComponent(version)}`);
    if (ajax) return ajax;
  }

  const page = await fetchText(`${SERIALSTATION_URL}/trophies/NPWR/${digits}`);
  if (!page) return undefined;

  const tableMatch = page.match(/initializeTable\("([^"]+)"/);
  if (tableMatch?.[1]) {
    return await fetchText(`${SERIALSTATION_URL}/ajax/table/${tableMatch[1]}`) ?? page;
  }
  return page;
}

async function contentIdsForTitleId(titleId: string): Promise<string[]> {
  const data = await fetchJson(`${SERIALSTATION_API_URL}/content-ids/?title_id=${encodeURIComponent(titleId)}&limit=100`);
  const items = Array.isArray(data?.items) ? data.items : [];
  return items
    .map((item: any) => typeof item?.content_id === "string" ? item.content_id : undefined)
    .filter(Boolean);
}

export async function resolveSerialStationRegionsForNpwr(npwr: string, trophySetVersion?: string): Promise<StoreRegionResolution | undefined> {
  const digits = npwrDigits(npwr);
  if (!digits) return undefined;

  const html = await serialStationTrophyHtml(digits, trophySetVersion);
  if (!html) return undefined;

  const titleIds = titleIdsFromHtml(html);
  const directContentIds = contentIdsFromHtml(html);
  const contentIds = new Set(directContentIds);
  for (const titleId of titleIds.slice(0, 10)) {
    for (const contentId of await contentIdsForTitleId(titleId)) {
      contentIds.add(contentId);
    }
  }

  const badgeProducts = new Map<RegionBadge, Set<string>>();
  for (const productId of contentIds) {
    const badge = badgeFromProductId(productId);
    if (!badge) continue;
    const products = badgeProducts.get(badge) ?? new Set<string>();
    products.add(productId);
    badgeProducts.set(badge, products);
  }

  for (const titleId of titleIds) {
    const badge = badgeFromTitleId(titleId);
    if (!badge || badgeProducts.has(badge)) continue;
    badgeProducts.set(badge, new Set([titleId]));
  }

  return {
    sourceType: "serialstation",
    sourceId: `NPWR-${digits}`,
    title: titleFromHtml(html),
    regions: [...badgeProducts.entries()].map(([badge, products]) => ({
      badge,
      locale: "serialstation",
      available: true,
      title: titleFromHtml(html),
      productIds: [...products]
    }))
  };
}

export async function fetchProductRegions(productId: string): Promise<StoreRegion[]> {
  const regions: StoreRegion[] = [];

  for (const region of STORE_REGION_LOCALES) {
    const data = await storeGraphql("metGetProductById", { productId }, region.locale);
    const product = data?.data?.productRetrieve;
    regions.push({
      ...region,
      available: Boolean(product),
      title: productTitle(product),
      productIds: product ? [productId] : [],
      error: firstError(data)
    });
  }

  return regions;
}

export async function fetchConceptRegions(conceptId: string): Promise<StoreRegion[]> {
  const regions: StoreRegion[] = [];

  for (const region of STORE_REGION_LOCALES) {
    const data = await storeGraphql("metGetConceptById", { conceptId }, region.locale);
    const concept = data?.data?.conceptRetrieve;
    regions.push({
      ...region,
      available: Boolean(concept),
      title: conceptTitle(concept),
      productIds: concept ? [...collectProductIds(concept)] : [],
      error: firstError(data)
    });
  }

  return regions;
}

export async function resolveStoreRegionsForTitle(auth: AuthLike, titleName: string): Promise<StoreRegionResolution | undefined> {
  const wanted = normalizeStoreTitle(titleName);
  if (wanted === "") return undefined;

  const data = await mobileGameSearch(auth, titleName);
  const domain = data?.domainResponses?.find((item: any) => item?.domain === "MobileGames")
    ?? data?.domainResponses?.[0];
  const results = Array.isArray(domain?.results) ? domain.results : [];

  const candidates = results
    .map((result: any) => {
      const concept = result?.conceptMetadata;
      const product = result?.productMetadata;
      const resultTitle = concept?.nameEn ?? concept?.name ?? product?.nameEn ?? product?.name ?? "";
      const normalized = normalizeStoreTitle(resultTitle);
      return {
        result,
        title: resultTitle,
        normalized,
        exact: normalized === wanted,
        startsWith: normalized !== "" && (normalized.startsWith(wanted) || wanted.startsWith(normalized))
      };
    })
    .filter((candidate: any) => candidate.normalized !== "");

  const match = candidates.find((candidate: any) => candidate.exact)
    ?? candidates.find((candidate: any) => candidate.startsWith)
    ?? candidates[0];
  if (!match) return undefined;

  const conceptId = match.result?.conceptMetadata?.id != null
    ? String(match.result.conceptMetadata.id)
    : undefined;
  if (conceptId) {
    return {
      sourceType: "concept",
      sourceId: conceptId,
      title: match.title,
      regions: await fetchConceptRegions(conceptId)
    };
  }

  const productId = match.result?.productMetadata?.id != null
    ? String(match.result.productMetadata.id)
    : undefined;
  if (!productId) return undefined;

  return {
    sourceType: "product",
    sourceId: productId,
    title: match.title,
    regions: await fetchProductRegions(productId)
  };
}
