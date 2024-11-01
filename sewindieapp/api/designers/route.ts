import { NextResponse } from 'next/server'
import { query } from '../../lib/db'

export async function GET() {
  const designers = await query('SELECT * FROM designers')
  return NextResponse.json(designers.rows)
}

export async function POST(request: Request) {
  const { name, description } = await request.json()
  const result = await query(
    'INSERT INTO designers (name, description) VALUES ($1, $2) RETURNING *',
    [name, description]
  )
  return NextResponse.json(result.rows[0])
}