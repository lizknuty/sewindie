import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const fabricTypes = await prisma.fabricType.findMany({
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(fabricTypes)
  } catch (error) {
    console.error('Error fetching fabric types:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}