import fs from 'fs';
import path from 'path';

const dir = 'c:/Users/shiwa/IIT Delhi/KOVOK/ai cement/Kovok_Catalogue_UI_Spec_Package/data';

function parseCSV(content: string) {
  const lines = content.trim().split(/\r?\n/);
  const header = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }
  return { header, rows };
}

function parseLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
}

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

console.log('=== DATA SUMMARY & STATUS DISTRIBUTIONS ===\n');

for (const f of files) {
  const content = fs.readFileSync(path.join(dir, f), 'utf-8');
  const { header, rows } = parseCSV(content);
  console.log(`FILE: ${f} (${rows.length} rows)`);
  console.log(`Columns: ${header.join(', ')}`);
  
  // Find any status-like column
  const statusCols = header.filter(h => /status|eligibility|verification|display_in_production/i.test(h));
  for (const statusCol of statusCols) {
    const counts: Record<string, number> = {};
    rows.forEach(r => {
      const s = r[statusCol] || 'BLANK';
      counts[s] = (counts[s] || 0) + 1;
    });
    console.log(`  Distribution of [${statusCol}]:`, counts);
  }

  if (f === 'canonical_products.csv') {
    const verified = rows.filter(r => r.verification_status === 'verified').map(r => r.canonical_product_id);
    const provisional = rows.filter(r => r.verification_status === 'provisional').map(r => r.canonical_product_id);
    console.log(`  Verified IDs (${verified.length}):`, verified);
    console.log(`  Provisional IDs (${provisional.length}):`, provisional);
  }

  console.log('');
}
