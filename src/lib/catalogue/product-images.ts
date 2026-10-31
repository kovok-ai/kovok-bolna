/**
 * Kovok Construction Materials Visual Asset Registry
 * Authoritative mapping for authentic statutory & representative category visuals
 * Conforms to BIS standards (IS 1786, IS 269, IS 1489, IS 2062, etc.)
 */

export interface ProductVisualAsset {
  imagePath: string;
  assetTitle: string;
  categoryName: string;
  badge: 'VERIFIED STATUTORY SPEC' | 'REPRESENTATIVE CATEGORY ASSET' | 'PROVISIONAL SPEC';
  badgeColor: 'green' | 'blue' | 'amber';
  applicableStandard: string;
  attribution: string;
  licensing: string;
  dimensionsPx: string;
  isRepresentative: boolean;
  notes: string;
}

const CATEGORY_VISUALS: Record<string, ProductVisualAsset> = {
  tmt_rebar: {
    imagePath: '/images/products/tmt_rebar.svg',
    assetTitle: 'TMT Reinforcement Steel Rebar (High Ductility)',
    categoryName: 'TMT & Reinforcement Steel',
    badge: 'VERIFIED STATUTORY SPEC',
    badgeColor: 'green',
    applicableStandard: 'IS 1786:2008 (Grade Fe 500D / Fe 550D)',
    attribution: 'Bureau of Indian Standards / Kovok Technical Documentation',
    licensing: 'Statutory Technical Standard Specification',
    dimensionsPx: '800x600',
    isRepresentative: false,
    notes: 'Authentic statutory rib geometry with longitudinal and transverse deformed ribs conforming strictly to IS 1786.',
  },
  cement: {
    imagePath: '/images/products/cement_opc.svg',
    assetTitle: 'Ordinary Portland Cement 53 Grade (50kg Bag)',
    categoryName: 'Cement & Mineral Binders',
    badge: 'VERIFIED STATUTORY SPEC',
    badgeColor: 'green',
    applicableStandard: 'IS 269:2015',
    attribution: 'Bureau of Indian Standards / Kovok Packaging Specification',
    licensing: 'Statutory Technical Standard Specification',
    dimensionsPx: '800x600',
    isRepresentative: false,
    notes: '50kg standard valve-stitched HDPE sack with BIS certification mark and compulsory test limits.',
  },
  structural_steel: {
    imagePath: '/images/products/structural_steel.svg',
    assetTitle: 'Structural Steel & Hot Rolled Sections (ISMB / ISMC)',
    categoryName: 'Structural Steel & Hot Rolled Sections',
    badge: 'REPRESENTATIVE CATEGORY ASSET',
    badgeColor: 'blue',
    applicableStandard: 'IS 2062:2011 Grade E250 / E350',
    attribution: 'Bureau of Indian Standards / Kovok Structural Engineering',
    licensing: 'Open Technical Standard Reference',
    dimensionsPx: '800x600',
    isRepresentative: true,
    notes: 'Representative 3D section profile of universal beam joist and channel sections with mill heat stamps.',
  },
  ms_gi_pipes: {
    imagePath: '/images/products/ms_gi_pipes.svg',
    assetTitle: 'Mild Steel & Galvanized Iron Structural Tubes',
    categoryName: 'MS & GI Steel Pipes',
    badge: 'REPRESENTATIVE CATEGORY ASSET',
    badgeColor: 'blue',
    applicableStandard: 'IS 1239:2004 & IS 1161:2014',
    attribution: 'Bureau of Indian Standards / Kovok Engineering',
    licensing: 'Open Technical Standard Reference',
    dimensionsPx: '800x600',
    isRepresentative: true,
    notes: 'Galvanized zinc coated tubular and square hollow sections with dimensional tolerances.',
  },
  plumbing_pipes: {
    imagePath: '/images/products/plumbing_pipes.svg',
    assetTitle: 'CPVC SDR 11 & UPVC Plumbing Systems',
    categoryName: 'PVC, CPVC & UPVC Plumbing Systems',
    badge: 'REPRESENTATIVE CATEGORY ASSET',
    badgeColor: 'blue',
    applicableStandard: 'IS 15778:2007 & IS 4985:2000',
    attribution: 'Bureau of Indian Standards / Kovok Plumbing Reference',
    licensing: 'Open Technical Standard Reference',
    dimensionsPx: '800x600',
    isRepresentative: true,
    notes: 'SDR 11 potable hot & cold water pipes with standard continuous stripe identification.',
  },
  rmc: {
    imagePath: '/images/products/rmc.svg',
    assetTitle: 'Ready-Mix Concrete (Batch Transit Mixed)',
    categoryName: 'Ready-Mix Concrete (RMC)',
    badge: 'REPRESENTATIVE CATEGORY ASSET',
    badgeColor: 'blue',
    applicableStandard: 'IS 4926:2003 & IS 456:2000',
    attribution: 'Bureau of Indian Standards / Kovok Concrete Technologies',
    licensing: 'Open Technical Standard Reference',
    dimensionsPx: '800x600',
    isRepresentative: true,
    notes: 'Computerized transit-mix delivery with slump cone workability verification.',
  },
  construction_chemicals: {
    imagePath: '/images/products/construction_chemicals.svg',
    assetTitle: 'Integral Waterproofing & Superplasticizer Admixtures',
    categoryName: 'Construction Chemicals & Waterproofing',
    badge: 'REPRESENTATIVE CATEGORY ASSET',
    badgeColor: 'blue',
    applicableStandard: 'IS 2645:2003 & IS 9103:1999',
    attribution: 'Bureau of Indian Standards / Kovok Chemical Formulations',
    licensing: 'Open Technical Standard Reference',
    dimensionsPx: '800x600',
    isRepresentative: true,
    notes: 'Industrial 200L bulk chemical drum and 20L site canister packaging.',
  },
  aac_blocks: {
    imagePath: '/images/products/aac_blocks.svg',
    assetTitle: 'Autoclaved Aerated Lightweight Concrete Blocks',
    categoryName: 'AAC Blocks & Precast Masonry',
    badge: 'REPRESENTATIVE CATEGORY ASSET',
    badgeColor: 'blue',
    applicableStandard: 'IS 2185 (Part 3):1984',
    attribution: 'Bureau of Indian Standards / Kovok Masonry Systems',
    licensing: 'Open Technical Standard Reference',
    dimensionsPx: '800x600',
    isRepresentative: true,
    notes: 'Precision-cut 600x200x150mm lightweight thermal masonry units.',
  },
  bricks_blocks: {
    imagePath: '/images/products/bricks_blocks.svg',
    assetTitle: 'Common Burnt Clay Bricks & Fly Ash Blocks',
    categoryName: 'Bricks & Concrete Masonry Blocks',
    badge: 'REPRESENTATIVE CATEGORY ASSET',
    badgeColor: 'blue',
    applicableStandard: 'IS 1077:1992 Class 10.5',
    attribution: 'Bureau of Indian Standards / Kovok Masonry Systems',
    licensing: 'Open Technical Standard Reference',
    dimensionsPx: '800x600',
    isRepresentative: true,
    notes: 'Wire-cut burnt clay brick with frog indentation conforming to modular sizing.',
  },
  sand_aggregates: {
    imagePath: '/images/products/sand_aggregates.svg',
    assetTitle: 'Graded Granite Aggregates & Manufactured Sand (M-Sand)',
    categoryName: 'Sand & Coarse Aggregates',
    badge: 'REPRESENTATIVE CATEGORY ASSET',
    badgeColor: 'blue',
    applicableStandard: 'IS 383:2016 Zone II',
    attribution: 'Bureau of Indian Standards / Kovok Materials Laboratory',
    licensing: 'Open Technical Standard Reference',
    dimensionsPx: '800x600',
    isRepresentative: true,
    notes: 'Angular 20mm coarse aggregate and crushed rock fine aggregate grading curves.',
  },
  tiles_flooring: {
    imagePath: '/images/products/tiles_flooring.svg',
    assetTitle: 'Glazed & Full Body Vitrified Tiles (GVT)',
    categoryName: 'Tiles & Architectural Flooring',
    badge: 'REPRESENTATIVE CATEGORY ASSET',
    badgeColor: 'blue',
    applicableStandard: 'IS 15622:2017 Group B1a',
    attribution: 'Bureau of Indian Standards / Kovok Architectural Materials',
    licensing: 'Open Technical Standard Reference',
    dimensionsPx: '800x600',
    isRepresentative: true,
    notes: '600x1200mm rectified large format glazed vitrified tile profile.',
  },
  roofing_materials: {
    imagePath: '/images/products/roofing_materials.svg',
    assetTitle: 'Pre-painted Galvalume Corrugated Roofing Sheets',
    categoryName: 'Roofing Sheets & Cladding Systems',
    badge: 'REPRESENTATIVE CATEGORY ASSET',
    badgeColor: 'blue',
    applicableStandard: 'IS 15965:2012 AZ150',
    attribution: 'Bureau of Indian Standards / Kovok Industrial Cladding',
    licensing: 'Open Technical Standard Reference',
    dimensionsPx: '800x600',
    isRepresentative: true,
    notes: 'Trapezoidal high-tensile steel roofing sheet with corrosion-protective metallic alloy coating.',
  },
  fasteners_hardware: {
    imagePath: '/images/products/fasteners_hardware.svg',
    assetTitle: 'High-Tensile Structural Bolts & Hardened Washers',
    categoryName: 'Structural Fasteners & Hardware',
    badge: 'REPRESENTATIVE CATEGORY ASSET',
    badgeColor: 'blue',
    applicableStandard: 'IS 3757:1985 Grade 10.9S',
    attribution: 'Bureau of Indian Standards / Kovok Mechanical Fasteners',
    licensing: 'Open Technical Standard Reference',
    dimensionsPx: '800x600',
    isRepresentative: true,
    notes: 'Grade 10.9 heavy hex structural bolt, nut, and washer assembly for steel connections.',
  },
  electrical: {
    imagePath: '/images/products/electrical.svg',
    assetTitle: 'FRLS Copper Building Wires & Rigid Conduits',
    categoryName: 'Electrical Construction Materials',
    badge: 'REPRESENTATIVE CATEGORY ASSET',
    badgeColor: 'blue',
    applicableStandard: 'IS 694:2010 & IS 9537',
    attribution: 'Bureau of Indian Standards / Kovok Electrical Standards',
    licensing: 'Open Technical Standard Reference',
    dimensionsPx: '800x600',
    isRepresentative: true,
    notes: 'Flame retardant low smoke multi-strand electrolytic copper conductor building wires.',
  },
};

/**
 * Resolve product visual asset by canonical product ID or category ID
 */
export function getProductVisualAsset(
  canonicalProductId?: string | null,
  categoryId?: string | null
): ProductVisualAsset {
  // 1. Direct canonical product overrides
  if (canonicalProductId) {
    if (canonicalProductId.includes('CEM-PPC')) {
      return {
        imagePath: '/images/products/cement_ppc.svg',
        assetTitle: 'Portland Pozzolana Cement Fly-ash Based (50kg Bag)',
        categoryName: 'Cement & Mineral Binders',
        badge: 'VERIFIED STATUTORY SPEC',
        badgeColor: 'green',
        applicableStandard: 'IS 1489 (Part 1):2015',
        attribution: 'Bureau of Indian Standards / Kovok Packaging Specification',
        licensing: 'Statutory Technical Standard Specification',
        dimensionsPx: '800x600',
        isRepresentative: false,
        notes: 'IS 1489 Part 1 compliant blended hydraulic cement for high-durability concrete.',
      };
    }
    if (canonicalProductId.startsWith('CP-CEM')) {
      return CATEGORY_VISUALS.cement;
    }
    if (canonicalProductId.startsWith('CP-TMT') || canonicalProductId.includes('STEEL')) {
      return CATEGORY_VISUALS.tmt_rebar;
    }
  }

  // 2. Category level lookup
  if (categoryId) {
    const cleanCat = categoryId.toLowerCase().replace('cat-', '').replace(/-/g, '_');
    if (CATEGORY_VISUALS[cleanCat]) {
      return CATEGORY_VISUALS[cleanCat];
    }
  }

  // 3. Fallback to TMT Steel default
  return CATEGORY_VISUALS.tmt_rebar;
}
