import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const patterns = await prisma.pattern.findMany({
      orderBy: { name: 'asc' },
      include: {
        designer: { select: { id: true, name: true } },
        PatternCategory: {
          include: {
            category: true
          }
        },
        PatternAudience: {
          include: {
            audience: true
          }
        },
        PatternFabricType: {
          include: {
            fabricType: true
          }
        }
      }
    })
    return NextResponse.json({ success: true, patterns })
  } catch (error) {
    console.error('Error fetching patterns:', error)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}