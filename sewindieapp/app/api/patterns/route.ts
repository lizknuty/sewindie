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
        PatternAttribute: {
          include: {
            attribute: true
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
        },
        PatternSuggestedFabric: {
          include: {
            suggestedFabric: true
          }
        }
      }
    })
    return NextResponse.json(patterns)
  } catch (error) {
    console.error('Error fetching patterns:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const pattern = await prisma.pattern.create({
      data: {
        name: body.name,
        designer: { connect: { id: parseInt(body.designer_id) } },
        url: body.url,
        thumbnail_url: body.thumbnail_url,
        yardage: body.yardage,
        sizes: body.sizes,
        language: body.language,
        PatternCategory: {
          create: body.categories.map((categoryId: string) => ({
            category: { connect: { id: parseInt(categoryId) } }
          }))
        },
        PatternAttribute: {
          create: body.attributes.map((attributeId: string) => ({
            attribute: { connect: { id: parseInt(attributeId) } }
          }))
        },
        PatternAudience: {
          create: body.audiences.map((audienceId: string) => ({
            audience: { connect: { id: parseInt(audienceId) } }
          }))
        },
        PatternFabricType: {
          create: body.fabricTypes.map((fabricTypeId: string) => ({
            fabricType: { connect: { id: parseInt(fabricTypeId) } }
          }))
        },
        PatternSuggestedFabric: {
          create: body.suggestedFabrics.map((suggestedFabricId: string) => ({
            suggestedFabric: { connect: { id: parseInt(suggestedFabricId) } }
          }))
        }
      }
    })
    return NextResponse.json(pattern)
  } catch (error) {
    console.error('Error creating pattern:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}