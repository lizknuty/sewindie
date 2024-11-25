import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const audiences = await prisma.audience.findMany({
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(audiences)
  } catch (error) {
    console.error('Error fetching audiences:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}