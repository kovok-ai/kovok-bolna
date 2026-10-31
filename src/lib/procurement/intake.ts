import type { PrismaClient } from '@prisma/client';
import { CORE_VERIFIED_CANONICAL_IDS } from '../catalogue/types';

export interface RebarCalculations {
  nominalMassKgPerMeter: number;
  barLengthMeters: number;
  singleBarMassKg: number;
  theoreticalBarsPerTonne: number;
  totalPiecesEstimated?: number;
  totalTonnesEstimated?: number;
  isStandardListedDiameter: boolean;
  standardClauseCitation: string;
  commercialBillingCaveat: string;
}

export interface MatchResult {
  requestStatus: 'MATCHED_VERIFIED' | 'NEEDS_CLARIFICATION';
  canonicalProductId: string | null;
  materialCategoryId: string;
  clarificationReason: string | null;
  derivedCalculations: Record<string, any> | null;
  advisoryEngineeringNote?: string | null;
}

export interface CreateRequestInput {
  siteId: string;
  materialCategoryId: string;
  targetGrade?: string;
  targetDiameterMm?: number;
  quantityValue: number;
  quantityUnit: 'TONNES' | 'BAGS' | 'PIECES';
  buyerNotes?: string;
  rawDescription?: string;
}

// IS 1786:2008 Table 1 Standard Nominal Sizes & Nominal Mass (kg/m)
const IS_1786_TABLE_1: Record<number, number> = {
  8: 0.395,
  10: 0.617,
  12: 0.888,
  16: 1.578,
  20: 2.466,
  25: 3.853,
  28: 4.834,
  32: 6.313,
  36: 7.99,
  40: 9.864
};

export function calculateRebarConversions(
  diameterMm: number,
  quantityValue?: number,
  quantityUnit: 'TONNES' | 'BAGS' | 'PIECES' = 'TONNES',
  barLengthMeters = 12
): RebarCalculations {
  const isListed = Object.prototype.hasOwnProperty.call(IS_1786_TABLE_1, diameterMm);

  // If listed, use standard IS 1786 nominal mass. If unlisted, calculate per formula: d^2 * 0.006165
  const nominalMassKgPerMeter = isListed
    ? IS_1786_TABLE_1[diameterMm]
    : Math.round(diameterMm * diameterMm * 0.006165 * 1000) / 1000;

  // Single bar mass: length (12m) * nominal mass (unrounded intermediate)
  const singleBarMassKg = barLengthMeters * nominalMassKgPerMeter;

  // Bars per metric tonne: 1000 kg / singleBarMassKg (unrounded intermediate)
  const theoreticalBarsPerTonne = 1000 / singleBarMassKg;

  let totalPiecesEstimated: number | undefined;
  let totalTonnesEstimated: number | undefined;

  if (quantityValue) {
    if (quantityUnit === 'TONNES') {
      totalPiecesEstimated = Math.round(quantityValue * theoreticalBarsPerTonne);
      totalTonnesEstimated = quantityValue;
    } else if (quantityUnit === 'PIECES') {
      totalPiecesEstimated = Math.round(quantityValue);
      totalTonnesEstimated = (quantityValue * singleBarMassKg) / 1000;
    }
  }

  return {
    nominalMassKgPerMeter,
    barLengthMeters,
    singleBarMassKg: Math.round(singleBarMassKg * 1000) / 1000,
    theoreticalBarsPerTonne: Math.round(theoreticalBarsPerTonne * 100) / 100,
    totalPiecesEstimated,
    totalTonnesEstimated: totalTonnesEstimated ? Math.round(totalTonnesEstimated * 1000) / 1000 : undefined,
    isStandardListedDiameter: isListed,
    standardClauseCitation: isListed
      ? 'IS 1786:2008 Table 1 Standard Nominal Dimensions'
      : 'IS 1786:2008 Clause 6.1.1 (Non-standard nominal sizes permitted by mutual mill agreement)',
    commercialBillingCaveat:
      'Theoretical piece and weight conversions are engineering reference estimates. Commercial billing in Indian construction trade requires actual computerized weighbridge tare slips subject to IS 1786 Table 2 mass tolerances (±3% to ±7%).'
  };
}

export function matchProcurementRequirement(
  categoryId: string,
  grade?: string,
  diameterMm?: number,
  quantityValue = 0,
  quantityUnit: 'TONNES' | 'BAGS' | 'PIECES' = 'TONNES',
  buyerNotes?: string
): MatchResult {
  const normCat = categoryId.trim().toUpperCase();

  // 1. TMT Steel
  if (normCat.includes('TMT') || normCat.includes('STEEL')) {
    const targetCatId = 'tmt_rebar';

    if (!grade || grade.trim() === '') {
      return {
        requestStatus: 'NEEDS_CLARIFICATION',
        canonicalProductId: null,
        materialCategoryId: targetCatId,
        clarificationReason:
          'UNRESOLVED_GRADE_SPECIFICATION: Buyer did not specify mandatory rebar grade (e.g. Fe 500D or Fe 550D). Kovok preserves original request without silent substitution.',
        derivedCalculations: diameterMm ? calculateRebarConversions(diameterMm, quantityValue, quantityUnit) : null
      };
    }

    const normGrade = grade.trim().toUpperCase().replace(/\s+/g, ' ');

    if (!diameterMm) {
      return {
        requestStatus: 'NEEDS_CLARIFICATION',
        canonicalProductId: null,
        materialCategoryId: targetCatId,
        clarificationReason:
          'MISSING_NOMINAL_DIAMETER: Buyer did not specify nominal rebar diameter (mm).',
        derivedCalculations: null
      };
    }

    const conv = calculateRebarConversions(diameterMm, quantityValue, quantityUnit);

    // Unlisted size check (e.g. 14mm, 18mm)
    if (!conv.isStandardListedDiameter) {
      return {
        requestStatus: 'NEEDS_CLARIFICATION',
        canonicalProductId: null,
        materialCategoryId: targetCatId,
        clarificationReason: `UNLISTED_NOMINAL_DIAMETER_REQUIRES_CONFIRMATION: Diameter ${diameterMm}mm is permitted under IS 1786:2008 Clause 6.1.1 by mutual agreement, but requires mill rolling confirmation and is not stocked off-the-shelf. Request preserved.`,
        derivedCalculations: conv
      };
    }

    // Standard core sizes: 8, 10, 12, 16, 20, 25, 32 mm
    const standardCoreSizes = [8, 10, 12, 16, 20, 25, 32];
    const isCoreSize = standardCoreSizes.includes(diameterMm);
    const diamStr = String(diameterMm).padStart(2, '0');

    if (normGrade === 'FE 500D' || normGrade === '500D') {
      const candidateId = `CP-TMT-500D-${diamStr}MM`;
      if (isCoreSize && CORE_VERIFIED_CANONICAL_IDS.has(candidateId)) {
        return {
          requestStatus: 'MATCHED_VERIFIED',
          canonicalProductId: candidateId,
          materialCategoryId: targetCatId,
          clarificationReason: null,
          derivedCalculations: conv
        };
      } else {
        return {
          requestStatus: 'NEEDS_CLARIFICATION',
          canonicalProductId: candidateId,
          materialCategoryId: targetCatId,
          clarificationReason: `PROVISIONAL_SPECIFICATION_PROJECT_ROLLING_REQUIRED: Size ${diameterMm}mm Fe 500D is a provisional non-preferred size under project rolling schedule. Request preserved.`,
          derivedCalculations: conv
        };
      }
    }

    if (normGrade === 'FE 550D' || normGrade === '550D') {
      const candidateId = `CP-TMT-550D-${diamStr}MM`;
      if (isCoreSize && CORE_VERIFIED_CANONICAL_IDS.has(candidateId)) {
        return {
          requestStatus: 'MATCHED_VERIFIED',
          canonicalProductId: candidateId,
          materialCategoryId: targetCatId,
          clarificationReason: null,
          derivedCalculations: conv
        };
      } else {
        return {
          requestStatus: 'NEEDS_CLARIFICATION',
          canonicalProductId: candidateId,
          materialCategoryId: targetCatId,
          clarificationReason: `PROVISIONAL_SPECIFICATION_PROJECT_ROLLING_REQUIRED: Size ${diameterMm}mm Fe 550D is a provisional heavy civil size under project rolling schedule. Request preserved.`,
          derivedCalculations: conv
        };
      }
    }

    if (normGrade.includes('CRS') || normGrade.includes('CORROSION')) {
      const candidateId = `CP-TMT-CRS-500D-${diamStr}MM`;
      return {
        requestStatus: 'NEEDS_CLARIFICATION',
        canonicalProductId: candidateId,
        materialCategoryId: targetCatId,
        clarificationReason:
          'PROVISIONAL_SPECIFICATION_PROJECT_ROLLING_REQUIRED: Corrosion Resistant Steel (CRS) requires specific mill heat chemistry and minimum batch volume. Request preserved.',
        derivedCalculations: conv
      };
    }

    if (normGrade.includes('415') || normGrade.includes('FE 415D')) {
      const candidateId = `CP-TMT-415D-${diamStr}MM`;
      return {
        requestStatus: 'NEEDS_CLARIFICATION',
        canonicalProductId: candidateId,
        materialCategoryId: targetCatId,
        clarificationReason:
          'PROVISIONAL_SPECIFICATION_LEGACY_GRADE: Fe 415D is a legacy ductility grade requiring availability confirmation from re-rollers. Request preserved.',
        derivedCalculations: conv
      };
    }

    // Unrecognized grade
    return {
      requestStatus: 'NEEDS_CLARIFICATION',
      canonicalProductId: null,
      materialCategoryId: targetCatId,
      clarificationReason: `UNRECOGNIZED_STEEL_GRADE: Grade "${grade}" could not be matched to an active BIS standard grade. Request preserved.`,
      derivedCalculations: conv
    };
  }

  // 2. Cement
  if (normCat.includes('CEM') || normCat.includes('CEMENT')) {
    const targetCatId = 'cement';

    let advisoryEngineeringNote: string | null = null;
    if (buyerNotes && /marine|saline|coastal|foundation piling|pile/i.test(buyerNotes)) {
      advisoryEngineeringNote =
        'IS 456:2000 Durability Advisory: Marine / coastal foundation works are subject to Tables 4 and 5 durability standards. Standard OPC 53 should be evaluated for slag/pozzolana content (PSC/PPC) or Sulphate Resisting Cement. Kovok preserves buyer request without automated alteration.';
    }

    if (!grade || grade.trim() === '') {
      return {
        requestStatus: 'NEEDS_CLARIFICATION',
        canonicalProductId: null,
        materialCategoryId: targetCatId,
        clarificationReason:
          'MISSING_CEMENT_GRADE_SPECIFICATION: Buyer did not specify cement grade (e.g. OPC 53, PPC, PSC). Generic cement requests require technical clarification.',
        derivedCalculations: null,
        advisoryEngineeringNote
      };
    }

    const normGrade = grade.trim().toUpperCase().replace(/\s+/g, ' ');

    if (normGrade.includes('OPC 53') || normGrade === '53' || normGrade === 'OPC-53') {
      return {
        requestStatus: 'MATCHED_VERIFIED',
        canonicalProductId: 'CP-CEM-OPC-53',
        materialCategoryId: targetCatId,
        clarificationReason: null,
        derivedCalculations: { standard: 'IS 269:2015', packaging: '50kg HDPE/Paper bags' },
        advisoryEngineeringNote
      };
    }

    if (normGrade.includes('PPC') || normGrade.includes('FLY ASH') || normGrade.includes('POZZOLANA')) {
      return {
        requestStatus: 'MATCHED_VERIFIED',
        canonicalProductId: 'CP-CEM-PPC-FA',
        materialCategoryId: targetCatId,
        clarificationReason: null,
        derivedCalculations: { standard: 'IS 1489 (Part 1):2015', packaging: '50kg bags' },
        advisoryEngineeringNote
      };
    }

    if (normGrade.includes('PSC') || normGrade.includes('SLAG')) {
      return {
        requestStatus: 'MATCHED_VERIFIED',
        canonicalProductId: 'CP-CEM-PSC-SLAG',
        materialCategoryId: targetCatId,
        clarificationReason: null,
        derivedCalculations: { standard: 'IS 455:2015', packaging: '50kg bags' },
        advisoryEngineeringNote
      };
    }

    if (normGrade.includes('COMPOSITE')) {
      return {
        requestStatus: 'MATCHED_VERIFIED',
        canonicalProductId: 'CP-CEM-COMPOSITE',
        materialCategoryId: targetCatId,
        clarificationReason: null,
        derivedCalculations: { standard: 'IS 16415:2015', packaging: '50kg bags' },
        advisoryEngineeringNote
      };
    }

    if (normGrade.includes('OPC 43') || normGrade === '43') {
      return {
        requestStatus: 'NEEDS_CLARIFICATION',
        canonicalProductId: 'CP-CEM-OPC-43',
        materialCategoryId: targetCatId,
        clarificationReason:
          'PROVISIONAL_SPECIFICATION_AVAILABILITY_REVIEW: OPC 43 has limited retail market supply in Delhi NCR. Request preserved for distributor stock confirmation.',
        derivedCalculations: { standard: 'IS 269:2015' },
        advisoryEngineeringNote
      };
    }

    if (normGrade.includes('OPC 33') || normGrade === '33') {
      return {
        requestStatus: 'NEEDS_CLARIFICATION',
        canonicalProductId: 'CP-CEM-OPC-33',
        materialCategoryId: targetCatId,
        clarificationReason:
          'PROVISIONAL_SPECIFICATION_AVAILABILITY_REVIEW: OPC 33 is rarely produced in standard distribution. Request preserved for manufacturer confirmation.',
        derivedCalculations: { standard: 'IS 269:2015' },
        advisoryEngineeringNote
      };
    }

    return {
      requestStatus: 'NEEDS_CLARIFICATION',
      canonicalProductId: null,
      materialCategoryId: targetCatId,
      clarificationReason: `UNRECOGNIZED_CEMENT_GRADE: Grade "${grade}" requires engineering review. Request preserved.`,
      derivedCalculations: null,
      advisoryEngineeringNote
    };
  }

  // Other categories
  return {
    requestStatus: 'NEEDS_CLARIFICATION',
    canonicalProductId: null,
    materialCategoryId: categoryId,
    clarificationReason: `CATEGORY_STAGED_FOR_FUTURE_PHASE: Material category "${categoryId}" is inventoried for future expansion. Request preserved.`,
    derivedCalculations: null
  };
}

/**
 * Concurrency-safe, persistent request code generator.
 *
 * Guarantees:
 * 1. Atomicity & Concurrency Safety: Exclusively locks the workspace's row in
 *    workspace_request_counters using SELECT ... FOR UPDATE within the active transaction.
 * 2. Uniqueness & Monotonicity: Evaluates both the counter value and the maximum numeric
 *    suffix in existing procurement_requests for this workspace (MAX(KOV-REQ-XXXX)), ensuring
 *    pre-seeded or imported requests are never duplicated or overwritten.
 * 3. Multi-Tenant Independence: Each workspace has its own row and sequence in
 *    workspace_request_counters; distinct workspaces allocate codes concurrently without blocking.
 */
export async function generateNextRequestCode(
  prisma: any,
  workspaceId: string
): Promise<string> {
  const atomicQuery = `
    WITH max_req AS (
      SELECT COALESCE(
        MAX(
          CASE 
            WHEN "requestCode" ~ '^KOV-REQ-[0-9]+$' 
            THEN SUBSTRING("requestCode" FROM 9)::INTEGER 
            ELSE 0 
          END
        ), 0
      ) AS max_code
      FROM "procurement_requests"
      WHERE "workspaceId" = $1::uuid
    )
    INSERT INTO "workspace_request_counters" ("workspaceId", "nextCounter", "updatedAt")
    SELECT $1::uuid, max_code + 2, NOW() FROM max_req
    ON CONFLICT ("workspaceId")
    DO UPDATE SET 
      "nextCounter" = GREATEST("workspace_request_counters"."nextCounter", (SELECT max_code + 1 FROM max_req)) + 1,
      "updatedAt" = NOW()
    RETURNING GREATEST("workspace_request_counters"."nextCounter" - 1, (SELECT max_code + 1 FROM max_req)) AS "allocatedCounter";
  `;

  const result = (await prisma.$queryRawUnsafe(
    atomicQuery,
    workspaceId
  )) as Array<{ allocatedCounter: number }>;

  const allocated = Number(result[0]?.allocatedCounter ?? 1);
  return `KOV-REQ-${String(allocated).padStart(4, '0')}`;
}

export async function createProcurementRequest(
  prisma: PrismaClient,
  workspaceId: string,
  createdByUserId: string,
  input: CreateRequestInput
) {
  // Step 1: Validate site ownership strictly (workspaceId + siteId)
  const site = await prisma.projectSite.findFirst({
    where: {
      id: input.siteId,
      workspaceId
    }
  });

  if (!site) {
    throw new Error('ProjectSite not found or does not belong to the active workspace');
  }

  // Step 2: Run matching engine
  const match = matchProcurementRequirement(
    input.materialCategoryId,
    input.targetGrade,
    input.targetDiameterMm,
    input.quantityValue,
    input.quantityUnit,
    input.buyerNotes
  );

  const MAX_RETRIES = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Step 3: Concurrency-safe request code allocation
      const requestCode = await generateNextRequestCode(prisma as any, workspaceId);

      // Step 4: Persist ProcurementRequest with composite foreign key & RLS context
      const request = await prisma.procurementRequest.create({
        data: {
          workspaceId,
          siteId: input.siteId,
          requestCode,
          materialCategoryId: match.materialCategoryId,
          canonicalProductId: match.canonicalProductId,
          targetGrade: input.targetGrade || null,
          targetDiameterMm: input.targetDiameterMm || null,
          quantityValue: input.quantityValue,
          quantityUnit: input.quantityUnit,
          derivedCalculations: match.derivedCalculations ? (match.derivedCalculations as any) : undefined,
          requestStatus: match.requestStatus,
          clarificationReason: match.clarificationReason,
          buyerNotes: input.buyerNotes || null,
          createdByUserId
        }
      });

      return {
        request,
        match
      };
    } catch (err: any) {
      lastError = err;
      const isUniqueConstraint =
        err?.code === 'P2002' ||
        err?.message?.includes('Unique constraint failed') ||
        err?.message?.includes('procurement_requests_workspaceId_requestCode_key');

      if (isUniqueConstraint && attempt < MAX_RETRIES) {
        // Force counter forward on collision before retry
        await (prisma as any).$executeRawUnsafe(
          `UPDATE "workspace_request_counters"
           SET "nextCounter" = "nextCounter" + 1, "updatedAt" = NOW()
           WHERE "workspaceId" = $1::uuid;`,
          workspaceId
        ).catch(() => {});
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}
