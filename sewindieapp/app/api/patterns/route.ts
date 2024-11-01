import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const patterns = await prisma.pattern.findMany({
      orderBy: { name: 'asc' },
      include: {
        designer: { select: { name: true } },
        patternCategories: { include: { category: true } }
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
        audience: body.audience,
        fabric_type: body.fabric_type,
        patternCategories: {
          create: body.categories.map((id: string) => ({ category: { connect: { id: parseInt(id) } } }))
        },
        patternFormats: {
          create: body.formats.map((id: string) => ({ format: { connect: { id: parseInt(id) } } }))
        },
        patternSuggestedFabrics: {
          create: body.suggestedFabrics.map((id: string) => ({ suggestedFabric: { connect: { id: parseInt(id) } } }))
        },
        patternAttributes: {
          create: body.attributes.map((id: string) => ({ attribute: { connect: { id: parseInt(id) } } }))
        }
      }
    })
    return NextResponse.json(pattern)
  } catch (error) {
    console.error('Error creating pattern:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}