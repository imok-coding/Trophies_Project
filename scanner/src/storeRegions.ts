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
  sourceType: "concept" | "product";
  sourceId: string;
  title?: string;
  regions: StoreRegion[];
};

type AuthLike = { accessToken: string };

const STORE_GRAPHQL_URL = "https://web.np.playstation.com/api/graphql/v1/op";
const MOBILE_SEARCH_URL = "https://m.np.playstation.com/api/search/v1/universalSearch";

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
