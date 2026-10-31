import fs from 'fs';
import path from 'path';

function parseCSV(content: string) {
  const lines = content.trim().split(/\r?\n/);
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
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
  return { header, rows };
}

const seedDir = path.join(process.cwd(), 'catalogue_seed');
const files = fs.readdirSync(seedDir).filter(f => f.endsWith('.csv'));

console.log('=== MAXIMUM COLUMN LENGTHS ACROSS ALL CSVS ===\n');
for (const f of files) {
  const { header, rows } = parseCSV(fs.readFileSync(path.join(seedDir, f), 'utf8'));
  console.log(`--- ${f} ---`);
  for (const h of header) {
    const maxLen = Math.max(...rows.map(r => (r[h] || '').length), 0);
    if (maxLen > 40) {
      console.log(`  ${h.padEnd(30)} Max length: ${maxLen}`);
    }
  }
}
