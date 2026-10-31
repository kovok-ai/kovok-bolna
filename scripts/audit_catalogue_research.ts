import fs from 'fs';
import path from 'path';

const seedDir = path.join(process.cwd(), 'catalogue_seed');
const manifestPath = path.join(seedDir, 'catalogue_manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function parseCSVLine(line: string): string[] {
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
  return values.map((v) => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
}

function parseCSV(filepath: string): { header: string[]; rows: Record<string, string>[] } {
  const content = fs.readFileSync(filepath, 'utf8').trim();
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  const header = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => (obj[h] = vals[idx] || ''));
    rows.push(obj);
  }
  return { header, rows };
}

console.log('=================================================================');
console.log('   KOVOK RESEARCH AUDIT REPORT');
console.log('=================================================================\n');

let totalRecords = 0;

for (const [filename, info] of Object.entries(manifest.files) as [string, any][]) {
  const fullpath = path.join(seedDir, filename);
  const { header, rows } = parseCSV(fullpath);
  totalRecords += rows.length;

  const statuses: Record<string, number> = {};
  rows.forEach((r) => {
    const st =
      r.verification_status ||
      r.verification_level ||
      r.status ||
      r.licensing_audit_status ||
      'N/A';
    statuses[st] = (statuses[st] || 0) + 1;
  });

  console.log(`• File: ${filename}`);
  console.log(`  Target Table : ${info.target_table}`);
  console.log(`  SHA-256      : ${info.sha256}`);
  console.log(`  Record Count : ${rows.length}`);
  console.log(`  Primary Key  : ${info.primary_key}`);
  console.log(`  Key Columns  : ${header.slice(0, 6).join(', ')}${header.length > 6 ? '...' : ''}`);
  console.log(`  Statuses     : ${JSON.stringify(statuses)}`);
  console.log('');
}

console.log(`Total Staged Research Records: ${totalRecords}`);

