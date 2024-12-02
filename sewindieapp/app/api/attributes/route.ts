import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const attributes = await prisma.attribute.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    })
    return NextResponse.json(attributes)
  } catch (error) {
    console.error('Error fetching attributes:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}