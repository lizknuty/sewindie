/**
 * Individual designer page
 */
import React from 'react'
import { query } from '../../lib/db'
import Link from 'next/link'

export default async function DesignerPage({ params }: { params: { id: string } }) {
  const designer = await query('SELECT * FROM designers WHERE id = $1', [params.id])
  const patterns = await query('SELECT id, name FROM patterns WHERE designer_id = $1', [params.id])

  if (designer.rows.length === 0) {
    return <div>Designer not found</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">{designer.rows[0].name}</h1>
      <p className="mb-4">{designer.rows[0].description}</p>
      <h2 className="text-2xl font-bold mb-2">Patterns</h2>
      <ul className="space-y-2">
        {patterns.rows.map((pattern) => (
          <li key={pattern.id}>
            <Link href={`/patterns/${pattern.id}`} className="text-blue-600 hover:underline">
              {pattern.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}