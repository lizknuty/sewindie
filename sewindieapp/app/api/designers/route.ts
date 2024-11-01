import { NextResponse } from 'next/server'
import { query } from '../../lib/db'

export async function GET() {
  const designers = await query('SELECT * FROM designer')
  return NextResponse.json(designers.rows)
}

export async function POST(request: Request) {
  const { name, url, logo_url, email, address, facebook, instagram, pinterest, youtube } = await request.json()
  const result = await query(
    'INSERT INTO designer (name, url, logo_url, email, address, facebook, instagram, pinterest, youtube) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
    [name, url, logo_url, email, address, facebook, instagram, pinterest, youtube]
  )
  return NextResponse.json(result.rows[0])
}