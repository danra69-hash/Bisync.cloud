import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Bundle catalog via tsx runtime by importing compiled paths - use dynamic import after registering tsx
const { register } = await import('tsx/esm/api');
register();

const catalogModule = await import(join(root, 'client/src/data/vendorProductCatalog.ts'));
const products = catalogModule.VENDOR_PRODUCT_CATALOG ?? [];

const outDir = join(root, 'src/Bisync.Api/Data/Seeds');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'vendor-products.seed.json');
writeFileSync(outPath, JSON.stringify(products, null, 2), 'utf8');
console.log(`Exported ${products.length} vendor products to ${outPath}`);
