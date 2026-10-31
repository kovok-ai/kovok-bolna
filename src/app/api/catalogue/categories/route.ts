import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const categories = await prisma.materialCategory.findMany({
      where: { isActive: true },
      include: {
        standards: {
          select: {
            id: true,
            standardNumber: true,
            standardTitle: true,
            mandatoryStatus: true,
            editionYear: true
          }
        }
      },
      orderBy: { id: 'asc' }
    });

    return NextResponse.json({
      categories: categories.map((cat) => ({
        id: cat.id,
        categoryName: cat.categoryName,
        parentCategoryId: cat.parentCategoryId,
        taxonomyVersion: cat.taxonomyVersion,
        researchStatus: cat.researchStatus,
        description: cat.description,
        standards: cat.standards
      }))
    });
  } catch (error) {
    console.error('Failed to fetch catalogue categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
