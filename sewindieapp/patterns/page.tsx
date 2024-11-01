import React from 'react'
import { query } from '../lib/db'
import Link from 'next/link'

export default async function PatternSearch() {
  const patterns = await query('SELECT p.id, p.name, d.name as designer_name FROM patterns p JOIN designers d ON p.designer_id = d.id ORDER BY p.name')

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Patterns</h1>
      <ul className="space-y-2">
        {patterns.rows.map((pattern) => (
          <li key={pattern.id}>
            <Link href={`/patterns/${pattern.id}`} className="text-blue-600 hover:underline">
              {pattern.name} by {pattern.designer_name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}