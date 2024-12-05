import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  if (!id || isNaN(parseInt(id))) {
    return NextResponse.json({ error: 'Invalid pattern ID' }, { status: 400 });
  }

  const patternId = parseInt(id);

  try {
    const pattern = await prisma.pattern.findUnique({
      where: { id: patternId },
      include: {
        designer: { select: { id: true, name: true } },
        PatternCategory: {
          include: {
            category: true,
          },
        },
        PatternAudience: {
          include: {
            audience: true,
          },
        },
        PatternFabricType: {
          include: {
            fabricType: true,
          },
        },
        PatternSuggestedFabric: {
          include: {
            suggestedFabric: true,
          },
        },
        PatternAttribute: {
          include: {
            attribute: true,
          },
        },
      },
    });

    if (!pattern) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, pattern });
  } catch (error) {
    console.error('Error fetching pattern:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
