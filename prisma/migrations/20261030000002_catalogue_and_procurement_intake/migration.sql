-- Kovok Phase 2: Research-Backed Construction Catalogue & Procurement Intake Migration
-- Database: PostgreSQL 16+
-- Adds Material Categories, Standards, Canonical Products, Manufacturers, Product Variants,
-- Technical Specifications, Sources, Evidence, Suppliers, Listings, Quarantined Images,
-- Unresolved Queue, Import Batches, Request Counters, and Procurement Requests.

-- -----------------------------------------------------------------------------
-- 1. ADD COMPOSITE UNIQUE CONSTRAINT ON PROJECT SITES
-- Enables cross-table verification that request site belongs to the request workspace.
-- -----------------------------------------------------------------------------
ALTER TABLE "project_sites" ADD CONSTRAINT "project_sites_workspaceId_id_key" UNIQUE ("workspaceId", "id");

-- -----------------------------------------------------------------------------
-- 2. MATERIAL CATEGORIES & TAXONOMY
-- -----------------------------------------------------------------------------
CREATE TABLE "material_categories" (
    "id" VARCHAR(64) NOT NULL,
    "categoryName" VARCHAR(128) NOT NULL,
    "parentCategoryId" VARCHAR(64),
    "taxonomyVersion" VARCHAR(32) NOT NULL DEFAULT '2.0',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "researchStatus" VARCHAR(64) NOT NULL DEFAULT 'fully_researched_p0',
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_categories_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "material_categories" ADD CONSTRAINT "material_categories_parentCategoryId_fkey"
    FOREIGN KEY ("parentCategoryId") REFERENCES "material_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 3. STATUTORY STANDARDS REGISTRY
-- -----------------------------------------------------------------------------
CREATE TABLE "standards_registry" (
    "id" VARCHAR(64) NOT NULL,
    "standardNumber" VARCHAR(64) NOT NULL,
    "standardTitle" TEXT NOT NULL,
    "publishingBody" VARCHAR(128) NOT NULL DEFAULT 'Bureau of Indian Standards (BIS)',
    "editionYear" VARCHAR(32) NOT NULL,
    "amendmentStatus" VARCHAR(128) NOT NULL,
    "supersedes" VARCHAR(128),
    "mandatoryStatus" VARCHAR(128) NOT NULL,
    "categoryId" VARCHAR(64) NOT NULL,
    "scopeSummary" TEXT,
    "verificationSourceUrl" TEXT,
    "lastCheckedDate" DATE,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standards_registry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "standards_registry" ADD CONSTRAINT "standards_registry_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "material_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 4. CANONICAL PRODUCTS
-- -----------------------------------------------------------------------------
CREATE TABLE "canonical_products" (
    "id" VARCHAR(64) NOT NULL,
    "categoryId" VARCHAR(64) NOT NULL,
    "subcategoryId" VARCHAR(64),
    "canonicalName" VARCHAR(255) NOT NULL,
    "standardProductType" VARCHAR(128) NOT NULL,
    "technicalDescription" TEXT,
    "applicableStandard" VARCHAR(128) NOT NULL,
    "standardEditionStatus" VARCHAR(128) NOT NULL,
    "primaryUom" VARCHAR(32) NOT NULL,
    "allowedUoms" JSONB NOT NULL,
    "mandatoryAttributes" JSONB NOT NULL,
    "conversionFactors" JSONB NOT NULL,
    "sourceEvidence" TEXT,
    "verificationStatus" VARCHAR(64) NOT NULL DEFAULT 'verified_standard_spec',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_products_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "canonical_products_categoryId_verificationStatus_idx" ON "canonical_products"("categoryId", "verificationStatus");

ALTER TABLE "canonical_products" ADD CONSTRAINT "canonical_products_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "material_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 5. CORPORATE MANUFACTURERS
-- -----------------------------------------------------------------------------
CREATE TABLE "manufacturers" (
    "id" VARCHAR(64) NOT NULL,
    "manufacturerName" VARCHAR(255) NOT NULL,
    "corporateEntityName" VARCHAR(255) NOT NULL,
    "brandNames" JSONB NOT NULL,
    "headquarters" VARCHAR(128) NOT NULL,
    "primaryCategories" JSONB NOT NULL,
    "establishedYear" VARCHAR(16),
    "ownershipType" VARCHAR(128) NOT NULL,
    "corporateWebsite" TEXT,
    "sourceEvidence" TEXT,
    "verificationStatus" VARCHAR(64) NOT NULL DEFAULT 'verified',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- -----------------------------------------------------------------------------
-- 6. BRANDED PRODUCT VARIANTS (STAGED/UNVERIFIED)
-- -----------------------------------------------------------------------------
CREATE TABLE "product_variants" (
    "id" VARCHAR(64) NOT NULL,
    "canonicalProductId" VARCHAR(64) NOT NULL,
    "manufacturerId" VARCHAR(64) NOT NULL,
    "brandName" VARCHAR(128) NOT NULL,
    "variantName" VARCHAR(255) NOT NULL,
    "kovokVariantCode" VARCHAR(64) NOT NULL,
    "manufacturerProductCode" VARCHAR(64),
    "gradeDesignation" VARCHAR(64) NOT NULL,
    "diameterOrPackSize" VARCHAR(64) NOT NULL,
    "packagingUom" VARCHAR(32) NOT NULL,
    "technicalSpecifications" JSONB,
    "applicableStandard" VARCHAR(128) NOT NULL,
    "exactSourceUrl" TEXT,
    "datasheetUrl" TEXT,
    "verificationStatus" VARCHAR(64) NOT NULL DEFAULT 'unverified',
    "specVerificationStatus" VARCHAR(64),
    "sourceHttpStatus" VARCHAR(64),
    "unresolvedConflicts" TEXT,
    "lastCheckedDate" DATE,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_variants_canonicalProductId_verificationStatus_idx" ON "product_variants"("canonicalProductId", "verificationStatus");
CREATE INDEX "product_variants_manufacturerId_idx" ON "product_variants"("manufacturerId");

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_canonicalProductId_fkey"
    FOREIGN KEY ("canonicalProductId") REFERENCES "canonical_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_manufacturerId_fkey"
    FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 7. TECHNICAL SPECIFICATIONS (CANONICAL & VARIANT)
-- -----------------------------------------------------------------------------
CREATE TABLE "technical_specifications" (
    "id" VARCHAR(64) NOT NULL,
    "variantIdOrCanonicalId" VARCHAR(64) NOT NULL,
    "entityLevel" VARCHAR(32) NOT NULL,
    "attributeName" VARCHAR(128) NOT NULL,
    "attributeValue" VARCHAR(128) NOT NULL,
    "attributeUnit" VARCHAR(32),
    "specificationCategory" VARCHAR(64) NOT NULL,
    "originType" VARCHAR(64) NOT NULL,
    "sourceId" VARCHAR(64),
    "evidenceLocation" TEXT,
    "verificationStatus" VARCHAR(64) NOT NULL DEFAULT 'verified',
    "conflictsFlagged" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_specifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "technical_specifications_variantIdOrCanonicalId_entityLevel_idx" ON "technical_specifications"("variantIdOrCanonicalId", "entityLevel");

-- -----------------------------------------------------------------------------
-- 8. SOURCE REGISTRY & EVIDENCE
-- -----------------------------------------------------------------------------
CREATE TABLE "source_registry" (
    "id" VARCHAR(64) NOT NULL,
    "organizationName" VARCHAR(255) NOT NULL,
    "sourceTier" VARCHAR(32) NOT NULL,
    "sourceType" VARCHAR(64) NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "ownerOrPublisher" VARCHAR(255),
    "categoryCoverage" VARCHAR(255),
    "tlsVerificationStatus" VARCHAR(64) NOT NULL,
    "httpStatusCode" INTEGER,
    "accessMethod" VARCHAR(64) NOT NULL,
    "dataReuseStatus" VARCHAR(64) NOT NULL,
    "retrievalDate" DATE,
    "reviewerNotes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_registry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_evidence" (
    "id" VARCHAR(64) NOT NULL,
    "variantIdOrCanonicalId" VARCHAR(64) NOT NULL,
    "sourceId" VARCHAR(64) NOT NULL,
    "exactEvidenceUrl" TEXT NOT NULL,
    "documentTitleOrPage" VARCHAR(255),
    "evidenceType" VARCHAR(64) NOT NULL,
    "extractedAttributesSummary" TEXT,
    "evidenceQuoteOrExcerpt" TEXT,
    "httpResponseCode" INTEGER,
    "retrievalTimestamp" TIMESTAMPTZ(6),
    "verificationResult" VARCHAR(64) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_evidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_evidence_variantIdOrCanonicalId_idx" ON "product_evidence"("variantIdOrCanonicalId");

ALTER TABLE "product_evidence" ADD CONSTRAINT "product_evidence_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "source_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 9. SUPPLIER ORGANIZATIONS & LISTINGS (DEMOTED TO PLATFORM CANDIDATES)
-- -----------------------------------------------------------------------------
CREATE TABLE "supplier_organizations" (
    "id" VARCHAR(64) NOT NULL,
    "organizationName" VARCHAR(255) NOT NULL,
    "legalEntityName" VARCHAR(255) NOT NULL,
    "supplierType" VARCHAR(64) NOT NULL,
    "headquarters" VARCHAR(128) NOT NULL,
    "serviceGeography" JSONB NOT NULL,
    "authorizedPartnerships" JSONB NOT NULL,
    "supportedCategories" JSONB NOT NULL,
    "contactPhone" VARCHAR(32),
    "contactEmail" VARCHAR(128),
    "websiteUrl" TEXT,
    "sourceTier" VARCHAR(32) NOT NULL,
    "verificationStatus" VARCHAR(64) NOT NULL DEFAULT 'verified_organization',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_listings" (
    "id" VARCHAR(64) NOT NULL,
    "supplierId" VARCHAR(64) NOT NULL,
    "canonicalProductId" VARCHAR(64),
    "variantId" VARCHAR(64),
    "kovokCandidateSku" VARCHAR(64),
    "supplierProductTitle" VARCHAR(255) NOT NULL,
    "listingType" VARCHAR(64) NOT NULL,
    "serviceArea" VARCHAR(128) NOT NULL,
    "listingUrl" TEXT,
    "sourceId" VARCHAR(64),
    "listingStatus" VARCHAR(64) NOT NULL DEFAULT 'platform_only',
    "priceStockCollectionMethod" VARCHAR(64) NOT NULL,
    "verificationDate" DATE,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_listings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_listings_supplierId_listingStatus_idx" ON "supplier_listings"("supplierId", "listingStatus");

ALTER TABLE "supplier_listings" ADD CONSTRAINT "supplier_listings_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "supplier_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_listings" ADD CONSTRAINT "supplier_listings_canonicalProductId_fkey"
    FOREIGN KEY ("canonicalProductId") REFERENCES "canonical_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_listings" ADD CONSTRAINT "supplier_listings_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 10. PRODUCT IMAGES (100% QUARANTINED FROM PRODUCTION BUYER DISPLAY)
-- -----------------------------------------------------------------------------
CREATE TABLE "product_images" (
    "id" VARCHAR(64) NOT NULL,
    "variantId" VARCHAR(64),
    "canonicalProductId" VARCHAR(64),
    "imageUrl" TEXT NOT NULL,
    "originalPublisher" VARCHAR(255),
    "assetType" VARCHAR(64) NOT NULL,
    "imageRole" VARCHAR(64) NOT NULL,
    "fileFormat" VARCHAR(16) NOT NULL,
    "dimensionsPx" VARCHAR(32),
    "sha256Hash" VARCHAR(64) NOT NULL,
    "skuDepictionAccuracy" VARCHAR(64),
    "reusePermissionStatus" VARCHAR(64) NOT NULL,
    "displayInProduction" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" VARCHAR(64) NOT NULL DEFAULT 'restricted_pending_review',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_images_displayInProduction_idx" ON "product_images"("displayInProduction");

ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_images" ADD CONSTRAINT "product_images_canonicalProductId_fkey"
    FOREIGN KEY ("canonicalProductId") REFERENCES "canonical_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 11. UNRESOLVED ENGINEERING REVIEW QUEUE
-- -----------------------------------------------------------------------------
CREATE TABLE "unresolved_records" (
    "id" VARCHAR(64) NOT NULL,
    "recordType" VARCHAR(64) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "entityName" VARCHAR(255) NOT NULL,
    "issueType" VARCHAR(64) NOT NULL,
    "severity" VARCHAR(32) NOT NULL,
    "description" TEXT NOT NULL,
    "conflictingValues" JSONB,
    "missingFields" JSONB,
    "sourceIds" JSONB,
    "suggestedAction" TEXT,
    "assignedReviewer" VARCHAR(128),
    "status" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(6),

    CONSTRAINT "unresolved_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "unresolved_records_status_severity_idx" ON "unresolved_records"("status", "severity");

-- -----------------------------------------------------------------------------
-- 12. CONTROLLED STAGING IMPORT LINEAGE
-- -----------------------------------------------------------------------------
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "batchNumber" VARCHAR(64) NOT NULL,
    "sourceManifestSha256" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    "summary" JSONB,
    "importedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "import_batches_batchNumber_key" ON "import_batches"("batchNumber");

ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_importedByUserId_fkey"
    FOREIGN KEY ("importedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "import_batch_records" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "entityType" VARCHAR(64) NOT NULL,
    "recordId" VARCHAR(64) NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "snapshotBefore" JSONB,
    "snapshotAfter" JSONB NOT NULL,
    "isHumanLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batch_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_batch_records_batchId_entityType_idx" ON "import_batch_records"("batchId", "entityType");
CREATE INDEX "import_batch_records_entityType_recordId_idx" ON "import_batch_records"("entityType", "recordId");

ALTER TABLE "import_batch_records" ADD CONSTRAINT "import_batch_records_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 13. TENANT PROCUREMENT INTAKE & REQUEST COUNTERS
-- -----------------------------------------------------------------------------
CREATE TABLE "workspace_request_counters" (
    "workspaceId" UUID NOT NULL,
    "nextCounter" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_request_counters_pkey" PRIMARY KEY ("workspaceId")
);

ALTER TABLE "workspace_request_counters" ADD CONSTRAINT "workspace_request_counters_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "procurement_requests" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "requestCode" VARCHAR(64) NOT NULL,
    "materialCategoryId" VARCHAR(64) NOT NULL,
    "canonicalProductId" VARCHAR(64),
    "targetGrade" VARCHAR(64),
    "targetDiameterMm" DECIMAL(5,2),
    "quantityValue" DECIMAL(12,3) NOT NULL,
    "quantityUnit" VARCHAR(32) NOT NULL,
    "derivedCalculations" JSONB,
    "requestStatus" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "clarificationReason" TEXT,
    "buyerNotes" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "procurement_requests_workspaceId_requestCode_key" ON "procurement_requests"("workspaceId", "requestCode");
CREATE INDEX "procurement_requests_workspaceId_requestStatus_idx" ON "procurement_requests"("workspaceId", "requestStatus");
CREATE INDEX "procurement_requests_workspaceId_siteId_idx" ON "procurement_requests"("workspaceId", "siteId");

ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Strict Composite Foreign Key for Cross-Tenant Site Protection:
ALTER TABLE "procurement_requests" ADD CONSTRAINT "fk_procurement_requests_workspace_site"
    FOREIGN KEY ("workspaceId", "siteId") REFERENCES "project_sites"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_materialCategoryId_fkey"
    FOREIGN KEY ("materialCategoryId") REFERENCES "material_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_canonicalProductId_fkey"
    FOREIGN KEY ("canonicalProductId") REFERENCES "canonical_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 14. ROW-LEVEL SECURITY (RLS) FOR TENANT INTAKE
-- -----------------------------------------------------------------------------
ALTER TABLE "workspace_request_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_request_counters" FORCE ROW LEVEL SECURITY;

CREATE POLICY "workspace_request_counters_isolation" ON "workspace_request_counters"
    FOR ALL
    USING ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid)
    WITH CHECK ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

ALTER TABLE "procurement_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "procurement_requests" FORCE ROW LEVEL SECURITY;

CREATE POLICY "procurement_requests_isolation" ON "procurement_requests"
    FOR ALL
    USING ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid)
    WITH CHECK ("workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

-- -----------------------------------------------------------------------------
-- 15. ROLE-BASED PRIVILEGES FOR RUNTIME APPLICATION ROLE (kovok_app)
-- Shared catalogue tables are strictly READ-ONLY (SELECT) to runtime app role.
-- App role cannot execute INSERT/UPDATE/DELETE on shared catalogue.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kovok_app') THEN
        GRANT SELECT ON
            "material_categories",
            "standards_registry",
            "canonical_products",
            "manufacturers",
            "product_variants",
            "technical_specifications",
            "source_registry",
            "product_evidence",
            "supplier_organizations",
            "supplier_listings",
            "product_images",
            "unresolved_records",
            "import_batches",
            "import_batch_records"
        TO kovok_app;

        GRANT ALL ON
            "workspace_request_counters",
            "procurement_requests"
        TO kovok_app;
    END IF;
END $$;
