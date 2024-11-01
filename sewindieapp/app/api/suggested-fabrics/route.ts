import { NextResponse } from 'next/server'
import prisma from '@/app/lib/db'

export async function GET() {
  try {
    const suggestedFabrics = await prisma.suggestedFabric.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    })
    return NextResponse.json(suggestedFabrics)
  } catch (error) {
    console.error('Error fetching suggested fabrics:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}