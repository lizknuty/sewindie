import { NextResponse } from 'next/server'
import { query } from '@/app/lib/db'

export async function GET() {
  try {
    const result = await query('SELECT id, name FROM Attribute ORDER BY name')
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching attributes:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}