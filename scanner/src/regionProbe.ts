import { badgeFromProductId, fetchConceptRegions, fetchProductRegions, type StoreRegion } from "./storeRegions.js";

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function printRegions(label: string, regions: StoreRegion[]) {
  console.log(label);
  for (const region of regions) {
    const status = region.available ? "Available" : "Unavailable";
    const title = region.title ? ` - ${region.title}` : "";
    console.log(`${region.badge}: ${status}${title}`);
    if (region.productIds.length > 0) {
      const products = region.productIds
        .slice(0, 8)
        .map(productId => {
          const prefixBadge = badgeFromProductId(productId);
          return prefixBadge ? `${productId} (${prefixBadge})` : productId;
        });
      console.log(`  ${products.join(", ")}`);
    }
    if (!region.available && region.error) {
      console.log(`  ${region.error}`);
    }
  }
}

async function main() {
  const productId = readArg("--product");
  const conceptId = readArg("--concept");

  if (!productId && !conceptId) {
    throw new Error("Usage: npm run region:probe -- --product UP0001-CUSA09311_00-GAME000000000000 or --concept 10002694");
  }

  if (productId) {
    printRegions(`Product ${productId}`, await fetchProductRegions(productId));
  }

  if (conceptId) {
    printRegions(`Concept ${conceptId}`, await fetchConceptRegions(conceptId));
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

