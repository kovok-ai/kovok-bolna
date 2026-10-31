import fs from 'fs';
import path from 'path';

function parseCSV(content: string) {
  const lines = content.trim().split(/\r?\n/);
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    // simple parse or quoted
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < lines[i].length; j++) {
      const c = lines[i][j];
      if (c === '"') inQuotes = !inQuotes;
      else if (c === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
      else current += c;
    }
    values.push(current.trim());
    const r: Record<string, string> = {};
    header.forEach((h, idx) => {
      r[h] = (values[idx] || '').replace(/^"|"$/g, '').replace(/""/g, '"');
    });
    rows.push(r);
  }
  return rows;
}

const seedDir = path.join(process.cwd(), 'catalogue_seed');
const categories = parseCSV(fs.readFileSync(path.join(seedDir, 'categories.csv'), 'utf8'));
const standards = parseCSV(fs.readFileSync(path.join(seedDir, 'standards_registry.csv'), 'utf8'));
const canonical = parseCSV(fs.readFileSync(path.join(seedDir, 'canonical_products.csv'), 'utf8'));
const manufacturers = parseCSV(fs.readFileSync(path.join(seedDir, 'manufacturers.csv'), 'utf8'));
const variants = parseCSV(fs.readFileSync(path.join(seedDir, 'product_variants.csv'), 'utf8'));
const specs = parseCSV(fs.readFileSync(path.join(seedDir, 'technical_specifications.csv'), 'utf8'));
const sources = parseCSV(fs.readFileSync(path.join(seedDir, 'source_registry.csv'), 'utf8'));
const suppliers = parseCSV(fs.readFileSync(path.join(seedDir, 'supplier_organizations.csv'), 'utf8'));
const listings = parseCSV(fs.readFileSync(path.join(seedDir, 'supplier_listings.csv'), 'utf8'));
const images = parseCSV(fs.readFileSync(path.join(seedDir, 'product_images.csv'), 'utf8'));

const catIds = new Set(categories.map(c => c.category_id));
const stdIds = new Set(standards.map(s => s.standard_id));
const canIds = new Set(canonical.map(c => c.canonical_product_id));
const mfgIds = new Set(manufacturers.map(m => m.manufacturer_id));
const varIds = new Set(variants.map(v => v.variant_id));
const srcIds = new Set(sources.map(s => s.source_id));
const supIds = new Set(suppliers.map(s => s.supplier_id));

console.log('--- FOREIGN KEY REFERENTIAL INTEGRITY CHECK ---');

// Canonical Products -> Categories & Standards
for (const c of canonical) {
  if (!catIds.has(c.category_id)) console.error(`Canonical ${c.canonical_product_id} invalid category_id: ${c.category_id}`);
  // check applicable_standard
  if (c.applicable_standard && !stdIds.has(c.applicable_standard)) {
    console.log(`Canonical ${c.canonical_product_id} applicable_standard is "${c.applicable_standard}" (not standard_id)`);
  }
}

// Product Variants -> Canonical & Manufacturers
for (const v of variants) {
  if (!canIds.has(v.canonical_product_id)) console.error(`Variant ${v.variant_id} invalid canonical_product_id: ${v.canonical_product_id}`);
  if (!mfgIds.has(v.manufacturer_id)) console.error(`Variant ${v.variant_id} invalid manufacturer_id: ${v.manufacturer_id}`);
}

// Supplier Listings -> SupplierOrg & Canonical & Variant
for (const l of listings) {
  if (!supIds.has(l.supplier_id)) console.error(`Listing ${l.listing_id} invalid supplier_id: ${l.supplier_id}`);
  if (l.canonical_product_id && !canIds.has(l.canonical_product_id)) console.error(`Listing ${l.listing_id} invalid canonical_product_id: ${l.canonical_product_id}`);
  if (l.variant_id && !varIds.has(l.variant_id)) console.error(`Listing ${l.listing_id} invalid variant_id: ${l.variant_id}`);
}

// Product Images -> Variant & Canonical
for (const img of images) {
  if (img.canonical_product_id && !canIds.has(img.canonical_product_id)) console.error(`Image ${img.image_id} invalid canonical_product_id: ${img.canonical_product_id}`);
  if (img.variant_id && !varIds.has(img.variant_id)) console.error(`Image ${img.image_id} invalid variant_id: ${img.variant_id}`);
}

console.log('FK check completed.');
