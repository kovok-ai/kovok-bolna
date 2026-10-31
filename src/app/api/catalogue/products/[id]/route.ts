import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateRebarConversions } from '@/lib/procurement/intake';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await prisma.canonicalProduct.findUnique({
      where: { id },
      include: {
        category: true
      }
    });

    if (!product) {
      return NextResponse.json({ error: 'Canonical product not found' }, { status: 404 });
    }

    // Fetch associated standard technical specifications
    const specifications = await prisma.technicalSpecification.findMany({
      where: {
        variantIdOrCanonicalId: id,
        entityLevel: 'canonical'
      },
      orderBy: { specificationCategory: 'asc' }
    });

    // Check if rebar and extract diameter for theoretical calculations
    let rebarCalculations = null;
    const diameterMatch = id.match(/-(\d{2})MM$/);
    if (diameterMatch && (product.categoryId === 'tmt_rebar' || product.categoryId === 'CAT-TMT-STEEL')) {
      const diameterMm = parseInt(diameterMatch[1], 10);
      rebarCalculations = calculateRebarConversions(diameterMm);
    }

    return NextResponse.json({
      product: {
        id: product.id,
        categoryId: product.categoryId,
        categoryName: product.category.categoryName,
        canonicalName: product.canonicalName,
        standardProductType: product.standardProductType,
        technicalDescription: product.technicalDescription,
        applicableStandard: product.applicableStandard,
        standardEditionStatus: product.standardEditionStatus,
        primaryUom: product.primaryUom,
        allowedUoms: product.allowedUoms,
        mandatoryAttributes: product.mandatoryAttributes,
        conversionFactors: product.conversionFactors,
        verificationStatus: product.verificationStatus,
        notes: product.notes
      },
      specifications,
      rebarCalculations
    });
  } catch (error) {
    console.error('Failed to fetch product details:', error);
    return NextResponse.json({ error: 'Failed to fetch product details' }, { status: 500 });
  }
}
