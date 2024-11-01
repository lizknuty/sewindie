import { NextResponse } from 'next/server'
import { query } from '@/app/lib/db'

export async function GET() {
  try {
    const result = await query('SELECT id, name, designer_id FROM Pattern ORDER BY name')
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching patterns:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, designer_id, categories, formats, suggestedFabrics, attributes } = body

    // Start a transaction
    await query('BEGIN')

    // Insert the pattern
    const patternResult = await query(
      'INSERT INTO Pattern (name, designer_id) VALUES ($1, $2) RETURNING id',
      [name, designer_id]
    )
    const patternId = patternResult.rows[0].id

    // Insert categories
    for (const categoryId of categories) {
      await query('INSERT INTO PatternCategory (pattern_id, category_id) VALUES ($1, $2)', [patternId, categoryId])
    }

    // Insert formats
    for (const formatId of formats) {
      await query('INSERT INTO PatternFormat (pattern_id, format_id) VALUES ($1, $2)', [patternId, formatId])
    }

    // Insert suggested fabrics
    for (const fabricId of suggestedFabrics) {
      await query('INSERT INTO PatternSuggestedFabric (pattern_id, suggested_fabric_id) VALUES ($1, $2)', [patternId, fabricId])
    }

    // Insert attributes
    for (const attributeId of attributes) {
      await query('INSERT INTO PatternAttribute (pattern_id, attribute_id) VALUES ($1, $2)', [patternId, attributeId])
    }

    // Commit the transaction
    await query('COMMIT')

    return NextResponse.json({ id: patternId, message: 'Pattern created successfully' }, { status: 201 })
  } catch (error) {
    // Rollback the transaction in case of error
    await query('ROLLBACK')
    console.error('Error creating pattern:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}