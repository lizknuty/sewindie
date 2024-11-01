import { NextResponse } from 'next/server'
import prisma from '@/app/lib/db'

export async function GET() {
  try {
    const designers = await prisma.designer.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    })
    return NextResponse.json(designers)
  } catch (error) {
    console.error('Error fetching designers:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}