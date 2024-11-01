import { NextResponse } from 'next/server'
import prisma from '@/app/lib/db'

export async function GET() {
  try {
    const patterns = await prisma.pattern.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, designer_id: true }
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
    const { name, designer_id, url, thumbnail_url, yardage, sizes, language, audience, fabric_type, categories, formats, suggestedFabrics, attributes } = body

    const pattern = await prisma.pattern.create({
      data: {
        name,
        designer_id: parseInt(designer_id),
        url,
        thumbnail_url,
        yardage,
        sizes,
        language,
        audience,
        fabric_type,
        patternCategories: {
          create: categories.map((id: string) => ({ category_id: parseInt(id) }))
        },
        patternFormats: {
          create: formats.map((id: string) => ({ format_id: parseInt(id) }))
        },
        patternSuggestedFabrics: {
          create: suggestedFabrics.map((id: string) => ({ suggested_fabric_id: parseInt(id) }))
        },
        patternAttributes: {
          create: attributes.map((id: string) => ({ attribute_id: parseInt(id) }))
        }
      }
    })

    return NextResponse.json({ id: pattern.id, message: 'Pattern created successfully' }, { status: 201 })
  } catch (error) {
    console.error('Error creating pattern:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}