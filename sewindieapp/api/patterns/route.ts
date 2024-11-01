import { NextResponse } from 'next/server'
import { query } from '../../lib/db'

export async function GET() {
  const patterns = await query('SELECT * FROM patterns')
  return NextResponse.json(patterns.rows)
}

export async function POST(request: Request) {
  const { name, description, designerId } = await request.json()
  const result = await query(
    'INSERT INTO patterns (name, description, designer_id) VALUES ($1, $2, $3) RETURNING *',
    [name, description, designerId]
  )
  return NextResponse.json(result.rows[0])
}