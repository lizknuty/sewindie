import { NextResponse } from 'next/server'
import { query } from '../../lib/db'

export async function GET() {
  const patterns = await query('SELECT * FROM pattern')
  return NextResponse.json(patterns.rows)
}

export async function POST(request: Request) {
  const { name, designer_id, url, thumbnail_url, yardage, sizes, language, audience, fabric_type } = await request.json()
  const result = await query(
    'INSERT INTO pattern (name, designer_id, url, thumbnail_url, yardage, sizes, language, audience, fabric_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
    [name, designer_id, url, thumbnail_url, yardage, sizes, language, audience, fabric_type]
  )
  return NextResponse.json(result.rows[0])
}