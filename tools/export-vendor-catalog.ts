import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VENDOR_PRODUCT_CATALOG } from '../client/src/data/vendorProductCatalog';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'src', 'Bisync.Api', 'Data', 'Seeds');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'vendor-products.seed.json');
writeFileSync(outPath, JSON.stringify(VENDOR_PRODUCT_CATALOG, null, 2), 'utf8');
console.log(`Exported ${VENDOR_PRODUCT_CATALOG.length} vendor products to ${outPath}`);
