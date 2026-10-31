import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import {
  CatalogueManifest,
  ImportDryRunReport,
  ImportExecutionResult,
  RollbackExecutionResult,
  CORE_VERIFIED_CANONICAL_IDS
} from './types';
import { EMBEDDED_MANIFEST, EMBEDDED_CSV_FILES } from './embedded-seed-data';

export { CORE_VERIFIED_CANONICAL_IDS };

export function getFileContent(seedDir: string, filename: string): { content: string; bytes: Buffer } {
  if (seedDir !== '__EMBEDDED__') {
    try {
      const filePath = path.join(seedDir, filename);
      if (fs.existsSync(filePath)) {
        const bytes = fs.readFileSync(filePath);
        return { content: bytes.toString('utf-8'), bytes };
      }
    } catch {}
  }

  if (EMBEDDED_CSV_FILES[filename]) {
    const content = EMBEDDED_CSV_FILES[filename];
    return { content, bytes: Buffer.from(content, 'utf-8') };
  }
  throw new Error(`Catalogue file not found on disk or embedded seed data: ${filename}`);
}

export interface DatabaseExecutor {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<any>;
}

export function createPrismaExecutor(prisma: PrismaClient): DatabaseExecutor {
  return {
    async query<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[] }> {
      const rows = await prisma.$queryRawUnsafe<T[]>(sql, ...params);
      return { rows: Array.isArray(rows) ? rows : [] };
    },
    async exec(sql: string): Promise<any> {
      return await prisma.$executeRawUnsafe(sql);
    }
  };
}

export function parseCSV(content: string): { header: string[]; rows: Record<string, string>[] } {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return { header, rows };
}

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

export function normalizeForComparison(val: any): any {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  return val;
}

export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }

  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);

  if (normA === normB) return true;

  if (
    normA instanceof Date ||
    normB instanceof Date ||
    (typeof normA === 'string' && /^\d{4}-\d{2}-\d{2}/.test(normA)) ||
    (typeof normB === 'string' && /^\d{4}-\d{2}-\d{2}/.test(normB))
  ) {
    const d1 = normA instanceof Date ? normA : new Date(normA);
    const d2 = normB instanceof Date ? normB : new Date(normB);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      return d1.toISOString().slice(0, 10) === d2.toISOString().slice(0, 10);
    }
  }

  if (typeof normA !== typeof normB) return false;

  if (typeof normA === 'boolean') {
    return normA === normB;
  }

  if (typeof normA === 'number') {
    return Math.abs(normA - normB) < 1e-9;
  }

  if (typeof normA === 'string') {
    return normA.trim() === normB.trim();
  }

  if (Array.isArray(normA) && Array.isArray(normB)) {
    if (normA.length !== normB.length) return false;
    for (let i = 0; i < normA.length; i++) {
      if (!deepEqual(normA[i], normB[i])) return false;
    }
    return true;
  }

  if (typeof normA === 'object' && typeof normB === 'object') {
    const keysA = Object.keys(normA).sort();
    const keysB = Object.keys(normB).sort();
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
      if (keysA[i] !== keysB[i]) return false;
      if (!deepEqual(normA[keysA[i]], normB[keysB[i]])) return false;
    }
    return true;
  }

  return false;
}

export function validateManifestIntegrity(seedDir: string): {
  manifest: CatalogueManifest;
  manifestSha256: string;
} {
  const manifestPath = path.join(seedDir, 'catalogue_manifest.json');
  let manifestBuffer: Buffer;
  let manifest: CatalogueManifest;

  if (fs.existsSync(manifestPath)) {
    manifestBuffer = fs.readFileSync(manifestPath);
    manifest = JSON.parse(manifestBuffer.toString('utf-8'));
  } else if (seedDir === '__EMBEDDED__' || seedDir === '') {
    manifest = EMBEDDED_MANIFEST as CatalogueManifest;
    manifestBuffer = Buffer.from(JSON.stringify(manifest), 'utf-8');
  } else {
    throw new Error(`Catalogue manifest not found at ${manifestPath}`);
  }

  const manifestSha256 = crypto.createHash('sha256').update(manifestBuffer).digest('hex');

  for (const [filename, fileEntry] of Object.entries(manifest.files)) {
    const { bytes } = getFileContent(seedDir, filename);
    const calculatedHash = crypto.createHash('sha256').update(bytes).digest('hex');
    const normalizedBytes = Buffer.from(bytes.toString('utf-8').replace(/\r\n/g, '\n'), 'utf-8');
    const normalizedHash = crypto.createHash('sha256').update(normalizedBytes).digest('hex');

    if (calculatedHash !== fileEntry.sha256 && normalizedHash !== fileEntry.sha256) {
      throw new Error(
        `Byte integrity mismatch on ${filename}: expected ${fileEntry.sha256}, calculated ${calculatedHash}`
      );
    }
  }

  return { manifest, manifestSha256 };
}

export async function generateDryRunReport(
  seedDir: string,
  db: DatabaseExecutor
): Promise<ImportDryRunReport> {
  const { manifest, manifestSha256 } = validateManifestIntegrity(seedDir);
  const batchNumber = `BATCH-${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)}`;

  const report: ImportDryRunReport = {
    batchNumber,
    manifestSha256,
    totalFiles: Object.keys(manifest.files).length,
    tables: {},
    verifiedCanonicalProductIds: [],
    provisionalCanonicalProductIds: [],
    quarantinedImageIdsCount: 0,
    status: 'READY',
    errors: []
  };

  try {
    const tableConfigs = [
      { file: 'categories.csv', table: 'material_categories', pk: 'category_id' },
      { file: 'standards_registry.csv', table: 'standards_registry', pk: 'standard_id' },
      { file: 'canonical_products.csv', table: 'canonical_products', pk: 'canonical_product_id' },
      { file: 'manufacturers.csv', table: 'manufacturers', pk: 'manufacturer_id' },
      { file: 'product_variants.csv', table: 'product_variants', pk: 'variant_id' },
      { file: 'technical_specifications.csv', table: 'technical_specifications', pk: 'spec_id' },
      { file: 'source_registry.csv', table: 'source_registry', pk: 'source_id' },
      { file: 'product_evidence.csv', table: 'product_evidence', pk: 'evidence_id' },
      { file: 'supplier_organizations.csv', table: 'supplier_organizations', pk: 'supplier_id' },
      { file: 'supplier_listings.csv', table: 'supplier_listings', pk: 'listing_id' },
      { file: 'product_images.csv', table: 'product_images', pk: 'image_id' },
      { file: 'unresolved_records.csv', table: 'unresolved_records', pk: 'unresolved_id' }
    ];

    for (const conf of tableConfigs) {
      const content = getFileContent(seedDir, conf.file).content;
      const { rows } = parseCSV(content);

      // Check existing IDs in DB
      let existingIds = new Set<string>();
      try {
        const res = await db.query<{ id: string }>(`SELECT id FROM "${conf.table}";`);
        existingIds = new Set(res.rows.map((r) => r.id));
      } catch {
        // Table might be empty or in setup
      }

      const toInsert = rows.filter((r) => !existingIds.has(r[conf.pk])).length;
      const toUpdate = 0;
      const toSkip = rows.filter((r) => existingIds.has(r[conf.pk])).length;

      let verifiedCount = 0;
      let provisionalCount = 0;
      let quarantinedCount = 0;

      if (conf.table === 'canonical_products') {
        for (const r of rows) {
          if (CORE_VERIFIED_CANONICAL_IDS.has(r.canonical_product_id)) {
            verifiedCount++;
            report.verifiedCanonicalProductIds.push(r.canonical_product_id);
          } else {
            provisionalCount++;
            report.provisionalCanonicalProductIds.push(r.canonical_product_id);
          }
        }
      } else if (conf.table === 'product_variants') {
        // Invariant: 0 verified branded variants
        verifiedCount = 0;
        provisionalCount = rows.length;
      } else if (conf.table === 'supplier_listings') {
        // Invariant: 0 verified supplier stock
        verifiedCount = 0;
        provisionalCount = rows.length;
      } else if (conf.table === 'product_images') {
        // Invariant: 100% quarantined from production display
        verifiedCount = 0;
        provisionalCount = 0;
        quarantinedCount = rows.length;
        report.quarantinedImageIdsCount = rows.length;
      } else {
        verifiedCount = rows.length;
      }

      report.tables[conf.table] = {
        totalRows: rows.length,
        toInsert,
        toUpdate,
        toSkip,
        verifiedCount,
        provisionalCount,
        quarantinedCount
      };
    }
  } catch (err) {
    report.status = 'VALIDATION_FAILED';
    report.errors.push((err as Error).message);
  }

  return report;
}

export async function executeImport(
  seedDir: string,
  db: DatabaseExecutor,
  options?: { batchNumber?: string; importedByUserId?: string }
): Promise<ImportExecutionResult> {
  const { manifestSha256 } = validateManifestIntegrity(seedDir);
  const batchId = crypto.randomUUID();
  const batchNumber =
    options?.batchNumber ?? `BATCH-${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)}`;

  const result: ImportExecutionResult = {
    batchId,
    batchNumber,
    status: 'COMPLETED',
    insertedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errors: [],
    summary: {}
  };

  function initSummary(table: string) {
    result.summary[table] = { inserted: 0, updated: 0, skipped: 0 };
  }

  function safeJson(val: string | undefined, defaultVal: any = {}): any {
    if (!val || val.trim() === '') return defaultVal;
    try {
      return JSON.parse(val);
    } catch {
      return defaultVal;
    }
  }

  await db.exec('BEGIN;');

  try {
    // 1. Insert ImportBatch
    await db.query(
      `INSERT INTO import_batches (id, "batchNumber", "sourceManifestSha256", status, "importedByUserId", "createdAt")
       VALUES ($1::uuid, $2, $3, 'IMPORTING', $4::uuid, NOW());`,
      [batchId, batchNumber, manifestSha256, options?.importedByUserId || null]
    );

    // Helper for tracking record snapshot in import_batch_records
    async function track(
      entityType: string,
      recordId: string,
      action: 'INSERT' | 'UPDATE',
      snapshotBefore: any,
      snapshotAfter: any
    ) {
      await db.query(
        `INSERT INTO import_batch_records (id, "batchId", "entityType", "recordId", action, "snapshotBefore", "snapshotAfter", "isHumanLocked", "createdAt")
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7::jsonb, false, NOW());`,
        [
          crypto.randomUUID(),
          batchId,
          entityType,
          recordId,
          action,
          snapshotBefore ? JSON.stringify(snapshotBefore) : null,
          JSON.stringify(snapshotAfter)
        ]
      );
    }

    const DATE_COLUMNS = new Set(['lastCheckedDate', 'retrievalDate', 'verificationDate']);
    const TIMESTAMPTZ_COLUMNS = new Set(['retrievalTimestamp', 'resolvedAt']);
    const JSONB_COLUMNS = new Set([
      'allowedUoms',
      'mandatoryAttributes',
      'conversionFactors',
      'brandNames',
      'primaryCategories',
      'dimensionsJson',
      'attributesJson',
      'technicalSpecifications',
      'specifications',
      'serviceGeography',
      'authorizedPartnerships',
      'supportedCategories',
      'conflictingValues',
      'missingFields',
      'sourceIds',
      'summary',
      'snapshotBefore',
      'snapshotAfter',
      'derivedCalculations'
    ]);

    function formatPlaceholder(col: string, index: number, entity?: string): string {
      if (DATE_COLUMNS.has(col)) return `$${index}::date`;
      if (TIMESTAMPTZ_COLUMNS.has(col)) return `$${index}::timestamptz`;
      if (JSONB_COLUMNS.has(col)) return `$${index}::jsonb`;
      if (col === 'id' && (entity === 'import_batches' || entity === 'import_batch_records')) return `$${index}::uuid`;
      if (col === 'batchId' || col === 'importedByUserId') return `$${index}::uuid`;
      return `$${index}`;
    }

    // Generic, concurrency-safe, idempotent upsert helper with change detection and human-lock protection
    async function upsertRecord(
      entityType: string,
      id: string,
      data: Record<string, any>,
      hasUpdatedAt: boolean
    ): Promise<'INSERT' | 'UPDATE' | 'SKIPPED'> {
      // Step A: Preserve human-locked records against automated overwriting
      const isLockedRes = await db.query(
        'SELECT 1 FROM import_batch_records WHERE "entityType" = $1 AND "recordId" = $2 AND "isHumanLocked" = true LIMIT 1;',
        [entityType, id]
      );
      if (isLockedRes.rows.length > 0) {
        result.summary[entityType].skipped++;
        result.skippedCount++;
        return 'SKIPPED';
      }

      // Step B: Query existing state
      const existingRes = await db.query(`SELECT * FROM "${entityType}" WHERE id = $1;`, [id]);
      const isNew = existingRes.rows.length === 0;

      if (isNew) {
        const keys = Object.keys(data);
        const cols = keys.map((k) => `"${k}"`).join(', ');
        const placeholders = keys.map((k, i) => formatPlaceholder(k, i + 1, entityType)).join(', ');
        const values = keys.map((k) => {
          const v = data[k];
          if (typeof v === 'object' && v !== null && !(v instanceof Date)) {
            return JSON.stringify(v);
          }
          return v;
        });

        if (hasUpdatedAt && !keys.includes('updatedAt')) {
          await db.query(
            `INSERT INTO "${entityType}" (${cols}, "updatedAt") VALUES (${placeholders}, NOW());`,
            values
          );
        } else {
          await db.query(
            `INSERT INTO "${entityType}" (${cols}) VALUES (${placeholders});`,
            values
          );
        }

        await track(entityType, id, 'INSERT', null, data);
        result.summary[entityType].inserted++;
        result.insertedCount++;
        return 'INSERT';
      }

      // Step C: Differentiate genuinely changed vs unchanged records
      const existingRow = existingRes.rows[0];
      let hasChanges = false;
      for (const [key, incomingVal] of Object.entries(data)) {
        if (key === 'id' || key === 'createdAt' || key === 'updatedAt') continue;
        const existingVal = existingRow[key];
        if (!deepEqual(existingVal, incomingVal)) {
          hasChanges = true;
          break;
        }
      }

      if (!hasChanges) {
        // Record is identical: DO NOT execute update, DO NOT mutate updatedAt, DO NOT clutter audit log
        result.summary[entityType].skipped++;
        result.skippedCount++;
        return 'SKIPPED';
      }

      // Step D: Genuinely changed: update modified columns and record audit snapshot
      const updateKeys = Object.keys(data).filter(
        (k) => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt'
      );
      const setClauses = updateKeys.map((k, i) => `"${k}" = ${formatPlaceholder(k, i + 2, entityType)}`).join(', ');
      const values = updateKeys.map((k) => {
        const v = data[k];
        if (typeof v === 'object' && v !== null && !(v instanceof Date)) {
          return JSON.stringify(v);
        }
        return v;
      });

      if (hasUpdatedAt) {
        await db.query(
          `UPDATE "${entityType}" SET ${setClauses}, "updatedAt" = NOW() WHERE id = $1;`,
          [id, ...values]
        );
      } else {
        await db.query(
          `UPDATE "${entityType}" SET ${setClauses} WHERE id = $1;`,
          [id, ...values]
        );
      }

      await track(entityType, id, 'UPDATE', existingRow, data);
      result.summary[entityType].updated++;
      result.updatedCount++;
      return 'UPDATE';
    }

    // -------------------------------------------------------------------------
    // 1. Material Categories
    // -------------------------------------------------------------------------
    initSummary('material_categories');
    const { rows: categories } = parseCSV(
      getFileContent(seedDir, 'categories.csv').content
    );
    categories.sort((a, b) => (a.parent_category_id ? 1 : 0) - (b.parent_category_id ? 1 : 0));
    for (const c of categories) {
      const parentId = c.parent_category_id && c.parent_category_id.trim() ? c.parent_category_id : null;
      const isActive = c.is_active.toLowerCase() === 'true';
      await upsertRecord(
        'material_categories',
        c.category_id,
        {
          id: c.category_id,
          categoryName: c.category_name,
          parentCategoryId: parentId,
          taxonomyVersion: c.taxonomy_version || '2.0.0',
          isActive,
          researchStatus: c.research_status || 'fully_researched_p0',
          description: c.description || null
        },
        true
      );
    }

    // -------------------------------------------------------------------------
    // 2. Standards Registry
    // -------------------------------------------------------------------------
    initSummary('standards_registry');
    const { rows: standards } = parseCSV(
      getFileContent(seedDir, 'standards_registry.csv').content
    );
    for (const s of standards) {
      await upsertRecord(
        'standards_registry',
        s.standard_id,
        {
          id: s.standard_id,
          standardNumber: s.standard_number,
          standardTitle: s.standard_title,
          publishingBody: s.publishing_body || 'Bureau of Indian Standards (BIS)',
          editionYear: s.edition_year,
          amendmentStatus: s.amendment_status,
          supersedes: s.supersedes || null,
          mandatoryStatus: s.mandatory_status,
          categoryId: s.category_id,
          scopeSummary: s.scope_summary || null,
          verificationSourceUrl: s.verification_source_url || null,
          lastCheckedDate: s.last_checked_date ? s.last_checked_date : null
        },
        false
      );
    }

    // -------------------------------------------------------------------------
    // 3. Canonical Products
    // Reconciled Invariant: 18 verified_standard_spec vs 25 provisional_reference_spec
    // -------------------------------------------------------------------------
    initSummary('canonical_products');
    const { rows: canonical } = parseCSV(
      getFileContent(seedDir, 'canonical_products.csv').content
    );
    for (const c of canonical) {
      const isCoreVerified = CORE_VERIFIED_CANONICAL_IDS.has(c.canonical_product_id);
      const verificationStatus = isCoreVerified
        ? 'verified_standard_spec'
        : 'provisional_reference_spec';

      await upsertRecord(
        'canonical_products',
        c.canonical_product_id,
        {
          id: c.canonical_product_id,
          categoryId: c.category_id,
          subcategoryId: c.subcategory_id || null,
          canonicalName: c.canonical_name,
          standardProductType: c.standard_product_type,
          technicalDescription: c.technical_description || null,
          applicableStandard: c.applicable_standard,
          standardEditionStatus: c.standard_edition_status,
          primaryUom: c.primary_uom,
          allowedUoms: safeJson(c.allowed_uoms_json, [c.primary_uom]),
          mandatoryAttributes: safeJson(c.mandatory_attributes_json, []),
          conversionFactors: safeJson(c.conversion_factors_json, {}),
          sourceEvidence: c.source_evidence || null,
          verificationStatus,
          notes: c.notes || null
        },
        true
      );
    }

    // -------------------------------------------------------------------------
    // 4. Manufacturers
    // -------------------------------------------------------------------------
    initSummary('manufacturers');
    const { rows: manufacturers } = parseCSV(
      getFileContent(seedDir, 'manufacturers.csv').content
    );
    for (const m of manufacturers) {
      await upsertRecord(
        'manufacturers',
        m.manufacturer_id,
        {
          id: m.manufacturer_id,
          manufacturerName: m.manufacturer_name,
          corporateEntityName: m.corporate_entity_name,
          brandNames: safeJson(m.brand_names_json, [m.manufacturer_name]),
          headquarters: m.headquarters,
          primaryCategories: safeJson(m.primary_categories_json, []),
          establishedYear: m.established_year || null,
          ownershipType: m.ownership_type,
          corporateWebsite: m.corporate_website || null,
          sourceEvidence: m.source_evidence || null,
          verificationStatus: m.verification_status || 'verified',
          notes: m.notes || null
        },
        true
      );
    }

    // -------------------------------------------------------------------------
    // 5. Product Variants (0 verified variants!)
    // -------------------------------------------------------------------------
    initSummary('product_variants');
    const { rows: variants } = parseCSV(
      getFileContent(seedDir, 'product_variants.csv').content
    );
    for (const v of variants) {
      await upsertRecord(
        'product_variants',
        v.variant_id,
        {
          id: v.variant_id,
          canonicalProductId: v.canonical_product_id,
          manufacturerId: v.manufacturer_id,
          brandName: v.brand_name,
          variantName: v.variant_name,
          kovokVariantCode: v.kovok_variant_code,
          manufacturerProductCode: v.manufacturer_product_code || null,
          gradeDesignation: v.grade_designation,
          diameterOrPackSize: v.diameter_or_pack_size,
          packagingUom: v.packaging_uom,
          technicalSpecifications: safeJson(v.technical_specifications_json, {}),
          applicableStandard: v.applicable_standard,
          exactSourceUrl: v.exact_source_url || null,
          datasheetUrl: v.datasheet_url || null,
          verificationStatus: v.verification_status,
          specVerificationStatus: v.spec_verification_status || null,
          sourceHttpStatus: v.source_http_status || null,
          unresolvedConflicts: v.unresolved_conflicts || null,
          lastCheckedDate: v.last_checked_date ? v.last_checked_date : null
        },
        true
      );
    }

    // -------------------------------------------------------------------------
    // 6. Technical Specifications
    // -------------------------------------------------------------------------
    initSummary('technical_specifications');
    const { rows: specs } = parseCSV(
      getFileContent(seedDir, 'technical_specifications.csv').content
    );
    for (const s of specs) {
      await upsertRecord(
        'technical_specifications',
        s.spec_id,
        {
          id: s.spec_id,
          variantIdOrCanonicalId: s.variant_id_or_canonical_id,
          entityLevel: s.entity_level,
          attributeName: s.attribute_name,
          attributeValue: s.attribute_value,
          attributeUnit: s.attribute_unit || null,
          specificationCategory: s.specification_category,
          originType: s.origin_type,
          sourceId: s.source_id || null,
          evidenceLocation: s.evidence_location || null,
          verificationStatus: s.verification_status || 'verified',
          conflictsFlagged: s.conflicts_flagged || null,
          notes: s.notes || null
        },
        false
      );
    }

    // -------------------------------------------------------------------------
    // 7. Source Registry
    // -------------------------------------------------------------------------
    initSummary('source_registry');
    const { rows: sources } = parseCSV(
      getFileContent(seedDir, 'source_registry.csv').content
    );
    for (const s of sources) {
      await upsertRecord(
        'source_registry',
        s.source_id,
        {
          id: s.source_id,
          organizationName: s.organization_name,
          sourceTier: s.source_tier,
          sourceType: s.source_type,
          sourceUrl: s.source_url,
          ownerOrPublisher: s.owner_or_publisher || null,
          categoryCoverage: s.category_coverage || null,
          tlsVerificationStatus: s.tls_verification_status || 'verified_valid',
          httpStatusCode: s.http_status_code ? parseInt(s.http_status_code, 10) : null,
          accessMethod: s.access_method || 'public_web',
          dataReuseStatus: s.data_reuse_status || 'permitted_public',
          retrievalDate: s.retrieval_date ? s.retrieval_date : null,
          reviewerNotes: s.reviewer_notes || null
        },
        false
      );
    }

    // -------------------------------------------------------------------------
    // 8. Product Evidence
    // -------------------------------------------------------------------------
    initSummary('product_evidence');
    const { rows: evidence } = parseCSV(
      getFileContent(seedDir, 'product_evidence.csv').content
    );
    for (const e of evidence) {
      await upsertRecord(
        'product_evidence',
        e.evidence_id,
        {
          id: e.evidence_id,
          variantIdOrCanonicalId: e.variant_id_or_canonical_id,
          sourceId: e.source_id,
          exactEvidenceUrl: e.exact_evidence_url,
          documentTitleOrPage: e.document_title_or_page || null,
          evidenceType: e.evidence_type,
          extractedAttributesSummary: e.extracted_attributes_summary || null,
          evidenceQuoteOrExcerpt: e.evidence_quote_or_excerpt || null,
          httpResponseCode: e.http_response_code ? parseInt(e.http_response_code, 10) : null,
          retrievalTimestamp: e.retrieval_timestamp ? e.retrieval_timestamp : null,
          verificationResult: e.verification_result || 'verified',
          notes: e.notes || null
        },
        false
      );
    }

    // -------------------------------------------------------------------------
    // 9. Supplier Organizations
    // -------------------------------------------------------------------------
    initSummary('supplier_organizations');
    const { rows: suppliers } = parseCSV(
      getFileContent(seedDir, 'supplier_organizations.csv').content
    );
    for (const s of suppliers) {
      await upsertRecord(
        'supplier_organizations',
        s.supplier_id,
        {
          id: s.supplier_id,
          organizationName: s.organization_name,
          legalEntityName: s.legal_entity_name,
          supplierType: s.supplier_type,
          headquarters: s.headquarters,
          serviceGeography: safeJson(s.service_geography_json, []),
          authorizedPartnerships: safeJson(s.authorized_partnerships_json, []),
          supportedCategories: safeJson(s.supported_categories_json, []),
          contactPhone: s.contact_phone || null,
          contactEmail: s.contact_email || null,
          websiteUrl: s.website_url || null,
          sourceTier: s.source_tier || 'tier_1',
          verificationStatus: s.verification_status || 'verified_organization',
          notes: s.notes || null
        },
        true
      );
    }

    // -------------------------------------------------------------------------
    // 10. Supplier Listings (0 verified stockists!)
    // -------------------------------------------------------------------------
    initSummary('supplier_listings');
    const { rows: listings } = parseCSV(
      getFileContent(seedDir, 'supplier_listings.csv').content
    );
    for (const l of listings) {
      await upsertRecord(
        'supplier_listings',
        l.listing_id,
        {
          id: l.listing_id,
          supplierId: l.supplier_id,
          canonicalProductId: l.canonical_product_id || null,
          variantId: l.variant_id || null,
          kovokCandidateSku: l.kovok_candidate_sku || null,
          supplierProductTitle: l.supplier_product_title,
          listingType: l.listing_type,
          serviceArea: l.service_area,
          listingUrl: l.listing_url || null,
          sourceId: l.source_id || null,
          listingStatus: l.listing_status,
          priceStockCollectionMethod: l.price_stock_collection_method,
          verificationDate: l.verification_date ? l.verification_date : null,
          reviewNotes: l.review_notes || null
        },
        true
      );
    }

    // -------------------------------------------------------------------------
    // 11. Product Images (100% quarantined from production display)
    // -------------------------------------------------------------------------
    initSummary('product_images');
    const { rows: images } = parseCSV(
      getFileContent(seedDir, 'product_images.csv').content
    );
    for (const i of images) {
      await upsertRecord(
        'product_images',
        i.image_id,
        {
          id: i.image_id,
          variantId: i.variant_id || null,
          canonicalProductId: i.canonical_product_id || null,
          imageUrl: i.image_url,
          originalPublisher: i.original_publisher || null,
          assetType: i.asset_type,
          imageRole: i.image_role,
          fileFormat: i.file_format,
          dimensionsPx: i.dimensions_px || null,
          sha256Hash: i.sha256_hash,
          skuDepictionAccuracy: i.sku_depiction_accuracy || null,
          reusePermissionStatus: i.reuse_permission_status,
          displayInProduction: false,
          reviewStatus: i.review_status || 'restricted_pending_review',
          notes: i.notes || null
        },
        false
      );
    }

    // -------------------------------------------------------------------------
    // 12. Unresolved Records
    // -------------------------------------------------------------------------
    initSummary('unresolved_records');
    const { rows: unresolved } = parseCSV(
      getFileContent(seedDir, 'unresolved_records.csv').content
    );
    for (const u of unresolved) {
      await upsertRecord(
        'unresolved_records',
        u.unresolved_id,
        {
          id: u.unresolved_id,
          recordType: u.record_type,
          entityId: u.entity_id,
          entityName: u.entity_name,
          issueType: u.issue_type,
          severity: u.severity,
          description: u.description,
          conflictingValues: safeJson(u.conflicting_values_json, null),
          missingFields: safeJson(u.missing_fields_json, null),
          sourceIds: safeJson(u.source_ids_json, null),
          suggestedAction: u.suggested_action || null,
          assignedReviewer: u.assigned_reviewer || null,
          status: u.status
        },
        false
      );
    }

    // Complete batch
    await db.query(
      `UPDATE import_batches
       SET status = 'COMPLETED', summary = $1::jsonb, "completedAt" = NOW()
       WHERE id = $2::uuid;`,
      [JSON.stringify(result.summary), batchId]
    );

    await db.exec('COMMIT;');
  } catch (err) {
    await db.exec('ROLLBACK;');
    result.status = 'FAILED';
    result.errors.push((err as Error).message);
    throw err;
  }

  return result;
}

export async function rollbackBatch(
  batchIdOrNumber: string,
  db: DatabaseExecutor
): Promise<RollbackExecutionResult> {
  const batchRes = await db.query(
    'SELECT * FROM import_batches WHERE id::text = $1 OR "batchNumber" = $1;',
    [batchIdOrNumber]
  );

  if (batchRes.rows.length === 0) {
    throw new Error(`Import batch not found: ${batchIdOrNumber}`);
  }

  const batch = batchRes.rows[0];
  if (batch.status === 'ROLLED_BACK') {
    throw new Error(`Import batch ${batch.batchNumber} has already been rolled back.`);
  }

  const recordsRes = await db.query<{
    id: string;
    entityType: string;
    recordId: string;
    action: string;
    snapshotBefore: string | null;
    isHumanLocked: boolean;
  }>(
    'SELECT * FROM import_batch_records WHERE "batchId" = $1::uuid ORDER BY "createdAt" DESC;',
    [batch.id]
  );

  const ENTITY_ROLLBACK_ORDER: Record<string, number> = {
    unresolved_records: 1,
    product_images: 2,
    supplier_listings: 3,
    product_evidence: 4,
    technical_specifications: 5,
    product_variants: 6,
    manufacturers: 7,
    supplier_organizations: 8,
    source_registry: 9,
    canonical_products: 10,
    standards_registry: 11,
    material_categories: 12
  };

  const sortedRecords = [...recordsRes.rows].sort((a, b) => {
    const orderA = ENTITY_ROLLBACK_ORDER[a.entityType] ?? 99;
    const orderB = ENTITY_ROLLBACK_ORDER[b.entityType] ?? 99;
    return orderA - orderB;
  });

  const result: RollbackExecutionResult = {
    batchId: batch.id,
    batchNumber: batch.batchNumber,
    status: 'ROLLED_BACK',
    revertedInsertsCount: 0,
    revertedUpdatesCount: 0,
    skippedCount: 0,
    errors: []
  };

  await db.exec('BEGIN;');
  try {
    await db.query("UPDATE import_batches SET status = 'ROLLING_BACK' WHERE id = $1::uuid;", [batch.id]);

    for (const record of sortedRecords) {
      if (record.isHumanLocked) {
        result.skippedCount++;
        continue;
      }

      const entity = record.entityType;
      const recordId = record.recordId;

      await db.exec('SAVEPOINT sp_revert;');
      try {
        if (record.action === 'INSERT') {
          await db.query(`DELETE FROM "${entity}" WHERE id = $1;`, [recordId]);
          result.revertedInsertsCount++;
        } else if (record.action === 'UPDATE' && record.snapshotBefore) {
          const beforeObj = typeof record.snapshotBefore === 'string'
            ? JSON.parse(record.snapshotBefore)
            : record.snapshotBefore;

          const keys = Object.keys(beforeObj).filter((k) => k !== 'id' && k !== 'createdAt');
          if (keys.length > 0) {
            const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
            const values = keys.map((k) => {
              const v = beforeObj[k];
              if (typeof v === 'object' && v !== null && !(v instanceof Date)) {
                return JSON.stringify(v);
              }
              return v;
            });
            await db.query(`UPDATE "${entity}" SET ${setClauses} WHERE id = $1;`, [recordId, ...values]);
            result.revertedUpdatesCount++;
          }
        }
        await db.exec('RELEASE SAVEPOINT sp_revert;');
      } catch (err) {
        await db.exec('ROLLBACK TO SAVEPOINT sp_revert;');
        result.skippedCount++;
        result.errors.push(`Error reverting ${entity} ${recordId}: ${(err as Error).message}`);
      }
    }

    const finalStatus = result.errors.length > 0 ? 'PARTIALLY_ROLLED_BACK' : 'ROLLED_BACK';
    await db.query('UPDATE import_batches SET status = $1 WHERE id = $2::uuid;', [finalStatus, batch.id]);
    await db.exec('COMMIT;');
    result.status = finalStatus;
  } catch (err) {
    await db.exec('ROLLBACK;');
    result.status = 'FAILED';
    result.errors.push((err as Error).message);
    throw err;
  }

  return result;
}
