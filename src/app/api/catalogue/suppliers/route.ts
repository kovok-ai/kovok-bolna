import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const suppliers = await prisma.supplierOrganization.findMany({
      include: {
        listings: {
          select: {
            id: true,
            supplierProductTitle: true,
            listingType: true,
            serviceArea: true,
            listingStatus: true,
            priceStockCollectionMethod: true,
            reviewNotes: true,
            canonicalProductId: true,
            variantId: true,
            listingUrl: true,
          },
        },
      },
      orderBy: {
        organizationName: 'asc',
      },
    });

    const formatted = suppliers.map((s) => ({
      id: s.id,
      organizationName: s.organizationName,
      legalEntityName: s.legalEntityName,
      supplierType: s.supplierType,
      headquarters: s.headquarters,
      serviceGeography: typeof s.serviceGeography === 'string' ? JSON.parse(s.serviceGeography) : s.serviceGeography,
      authorizedPartnerships: typeof s.authorizedPartnerships === 'string' ? JSON.parse(s.authorizedPartnerships) : s.authorizedPartnerships,
      supportedCategories: typeof s.supportedCategories === 'string' ? JSON.parse(s.supportedCategories) : s.supportedCategories,
      contactPhone: s.contactPhone,
      contactEmail: s.contactEmail,
      websiteUrl: s.websiteUrl,
      sourceTier: s.sourceTier,
      verificationStatus: s.verificationStatus,
      notes: s.notes,
      listingsCount: s.listings.length,
      listings: s.listings,
    }));

    return NextResponse.json({
      success: true,
      count: formatted.length,
      suppliers: formatted,
    });
  } catch (error: any) {
    console.error('Failed to query suppliers:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve supplier organizations', details: error.message },
      { status: 500 }
    );
  }
}
