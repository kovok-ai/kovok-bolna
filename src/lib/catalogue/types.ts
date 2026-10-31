export interface ManifestFileEntry {
  filename: string;
  sha256: string;
  bytes: number;
  rowCount: number;
  primaryKey: string;
  provenance: string;
  statusSummary: Record<string, number>;
}

export interface CatalogueManifest {
  version: string;
  generatedAt: string;
  sourcePackage: string;
  sourceRepoCommit: string;
  files: Record<string, ManifestFileEntry>;
}

export interface ImportDryRunReport {
  batchNumber: string;
  manifestSha256: string;
  totalFiles: number;
  tables: Record<
    string,
    {
      totalRows: number;
      toInsert: number;
      toUpdate: number;
      toSkip: number;
      verifiedCount: number;
      provisionalCount: number;
      quarantinedCount: number;
    }
  >;
  verifiedCanonicalProductIds: string[];
  provisionalCanonicalProductIds: string[];
  quarantinedImageIdsCount: number;
  status: 'READY' | 'INVALID_INTEGRITY' | 'VALIDATION_FAILED';
  errors: string[];
}

export interface ImportExecutionResult {
  batchId: string;
  batchNumber: string;
  status: 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
  summary: Record<string, { inserted: number; updated: number; skipped: number }>;
}

export interface RollbackExecutionResult {
  batchId: string;
  batchNumber: string;
  status: 'ROLLED_BACK' | 'PARTIALLY_ROLLED_BACK' | 'FAILED';
  revertedInsertsCount: number;
  revertedUpdatesCount: number;
  skippedCount: number;
  errors: string[];
}

export const CORE_VERIFIED_CANONICAL_IDS = new Set<string>([
  // TMT Fe 500D (7 standard core sizes)
  'CP-TMT-500D-08MM',
  'CP-TMT-500D-10MM',
  'CP-TMT-500D-12MM',
  'CP-TMT-500D-16MM',
  'CP-TMT-500D-20MM',
  'CP-TMT-500D-25MM',
  'CP-TMT-500D-32MM',
  // TMT Fe 550D (7 standard core sizes)
  'CP-TMT-550D-08MM',
  'CP-TMT-550D-10MM',
  'CP-TMT-550D-12MM',
  'CP-TMT-550D-16MM',
  'CP-TMT-550D-20MM',
  'CP-TMT-550D-25MM',
  'CP-TMT-550D-32MM',
  // Primary Commercial Cement Grades (4 core standards)
  'CP-CEM-OPC-53',
  'CP-CEM-PPC-FA',
  'CP-CEM-PSC-SLAG',
  'CP-CEM-COMPOSITE'
]);
