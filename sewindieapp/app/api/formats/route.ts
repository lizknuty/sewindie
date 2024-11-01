import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const formats = await prisma.format.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    })
    return NextResponse.json(formats)
  } catch (error) {
    console.error('Error fetching formats:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}