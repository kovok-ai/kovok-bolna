import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface ManifestEntry {
  filename: string;
  sha256: string;
  bytes: number;
  rowCount: number;
  primaryKey: string;
  provenance: string;
  statusSummary: Record<string, number>;
}

interface CatalogueManifest {
  version: string;
  generatedAt: string;
  sourcePackage: string;
  sourceRepoCommit: string;
  files: Record<string, ManifestEntry>;
}

function parseCSVLines(content: string): { header: string[]; rows: string[][] } {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseLine(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim().length > 0).map(parseLine);
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

const seedDir = path.join(process.cwd(), 'catalogue_seed');

const fileConfigs: Record<string, { pk: string; statusCol: string | null }> = {
  'categories.csv': { pk: 'category_id', statusCol: 'research_status' },
  'standards_registry.csv': { pk: 'standard_id', statusCol: 'mandatory_status' },
  'canonical_products.csv': { pk: 'canonical_product_id', statusCol: 'verification_status' },
  'manufacturers.csv': { pk: 'manufacturer_id', statusCol: 'verification_status' },
  'technical_specifications.csv': { pk: 'spec_id', statusCol: 'verification_status' },
  'source_registry.csv': { pk: 'source_id', statusCol: 'tls_verification_status' },
  'supplier_organizations.csv': { pk: 'supplier_id', statusCol: 'verification_status' },
  'supplier_listings.csv': { pk: 'listing_id', statusCol: 'listing_status' },
  'product_variants.csv': { pk: 'variant_id', statusCol: 'verification_status' },
  'product_images.csv': { pk: 'image_id', statusCol: 'reuse_permission_status' },
  'product_evidence.csv': { pk: 'evidence_id', statusCol: 'verification_result' },
  'unresolved_records.csv': { pk: 'unresolved_id', statusCol: 'status' }
};

const manifest: CatalogueManifest = {
  version: '2.0.0',
  generatedAt: new Date().toISOString(),
  sourcePackage: 'Kovok_Final_Construction_Catalogue_Package.zip',
  sourceRepoCommit: '822c05a95be1c3cbf709da0ded75f32fe53b48bc',
  files: {}
};

for (const [filename, config] of Object.entries(fileConfigs)) {
  const filePath = path.join(seedDir, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing expected seed file: ${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const content = buffer.toString('utf-8');
  const { header, rows } = parseCSVLines(content);

  const statusSummary: Record<string, number> = {};
  if (config.statusCol) {
    const colIdx = header.indexOf(config.statusCol);
    if (colIdx !== -1) {
      for (const row of rows) {
        const val = row[colIdx] || 'UNKNOWN';
        statusSummary[val] = (statusSummary[val] || 0) + 1;
      }
    }
  }

  manifest.files[filename] = {
    filename,
    sha256,
    bytes: buffer.length,
    rowCount: rows.length,
    primaryKey: config.pk,
    provenance: `Kovok_Catalogue_UI_Spec_Package/data/${filename}`,
    statusSummary
  };
}

const manifestPath = path.join(seedDir, 'catalogue_manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
console.log(`Successfully generated manifest at ${manifestPath} with ${Object.keys(manifest.files).length} files.`);
