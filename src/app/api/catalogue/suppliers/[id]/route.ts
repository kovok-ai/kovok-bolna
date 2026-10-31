import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supplier = await prisma.supplierOrganization.findUnique({
      where: { id },
      include: {
        listings: {
          include: {
            canonicalProduct: {
              select: {
                canonicalName: true,
                applicableStandard: true,
                primaryUom: true,
                verificationStatus: true,
              },
            },
          },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: `Supplier organization '${id}' not found` },
        { status: 404 }
      );
    }

    const formatted = {
      id: supplier.id,
      organizationName: supplier.organizationName,
      legalEntityName: supplier.legalEntityName,
      supplierType: supplier.supplierType,
      headquarters: supplier.headquarters,
      serviceGeography: typeof supplier.serviceGeography === 'string' ? JSON.parse(supplier.serviceGeography) : supplier.serviceGeography,
      authorizedPartnerships: typeof supplier.authorizedPartnerships === 'string' ? JSON.parse(supplier.authorizedPartnerships) : supplier.authorizedPartnerships,
      supportedCategories: typeof supplier.supportedCategories === 'string' ? JSON.parse(supplier.supportedCategories) : supplier.supportedCategories,
      contactPhone: supplier.contactPhone,
      contactEmail: supplier.contactEmail,
      websiteUrl: supplier.websiteUrl,
      sourceTier: supplier.sourceTier,
      verificationStatus: supplier.verificationStatus,
      notes: supplier.notes,
      listingsCount: supplier.listings.length,
      listings: supplier.listings.map((l) => ({
        id: l.id,
        supplierProductTitle: l.supplierProductTitle,
        listingType: l.listingType,
        serviceArea: l.serviceArea,
        listingStatus: l.listingStatus,
        priceStockCollectionMethod: l.priceStockCollectionMethod,
        reviewNotes: l.reviewNotes,
        canonicalProductId: l.canonicalProductId,
        variantId: l.variantId,
        listingUrl: l.listingUrl,
        canonicalProduct: l.canonicalProduct,
      })),
    };

    return NextResponse.json({
      success: true,
      supplier: formatted,
    });
  } catch (error: any) {
    console.error('Failed to query supplier by ID:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve supplier organization details', details: error.message },
      { status: 500 }
    );
  }
}
