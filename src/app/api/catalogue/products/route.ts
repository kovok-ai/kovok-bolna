import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const verificationStatus = searchParams.get('verificationStatus'); // 'verified_standard_spec', 'provisional_reference_spec'
    const search = searchParams.get('q');

    const where: any = {};
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (verificationStatus) {
      where.verificationStatus = verificationStatus;
    }
    if (search) {
      where.OR = [
        { canonicalName: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
        { applicableStandard: { contains: search, mode: 'insensitive' } }
      ];
    }

    const products = await prisma.canonicalProduct.findMany({
      where,
      include: {
        category: {
          select: { id: true, categoryName: true }
        }
      },
      orderBy: [{ verificationStatus: 'asc' }, { id: 'asc' }]
    });

    return NextResponse.json({
      total: products.length,
      products: products.map((p) => ({
        id: p.id,
        categoryId: p.categoryId,
        categoryName: p.category.categoryName,
        canonicalName: p.canonicalName,
        standardProductType: p.standardProductType,
        applicableStandard: p.applicableStandard,
        standardEditionStatus: p.standardEditionStatus,
        primaryUom: p.primaryUom,
        allowedUoms: p.allowedUoms,
        mandatoryAttributes: p.mandatoryAttributes,
        conversionFactors: p.conversionFactors,
        verificationStatus: p.verificationStatus,
        notes: p.notes
      }))
    });
  } catch (error) {
    console.error('Failed to fetch canonical products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
