import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const dir1 = 'c:/Users/shiwa/IIT Delhi/KOVOK/ai cement/Kovok_Catalogue_UI_Spec_Package';
const dir2 = 'c:/Users/shiwa/IIT Delhi/KOVOK/ai cement/Kovok_Catalogue_UI_Spec_Package/data';

const files = [
  'categories.csv',
  'standards_registry.csv',
  'canonical_products.csv',
  'manufacturers.csv',
  'technical_specifications.csv',
  'source_registry.csv',
  'supplier_organizations.csv',
  'supplier_listings.csv',
  'product_variants.csv',
  'product_images.csv',
  'product_evidence.csv',
  'unresolved_records.csv'
];

console.log('--- RECONCILING ROOT CSV VS DATA/ CSV ---');
for (const file of files) {
  const p1 = path.join(dir1, file);
  const p2 = path.join(dir2, file);
  const b1 = fs.readFileSync(p1);
  const b2 = fs.readFileSync(p2);
  const h1 = crypto.createHash('sha256').update(b1).digest('hex');
  const h2 = crypto.createHash('sha256').update(b2).digest('hex');
  const match = h1 === h2;
  console.log(`${file.padEnd(30)} Match: ${match} | Size: ${b1.length} | Hash: ${h1}`);
}
