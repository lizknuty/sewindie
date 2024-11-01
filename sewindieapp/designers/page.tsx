/**
 * Designer search page
 */
import React from 'react'
import { query } from '../lib/db'
import Link from 'next/link'

export default async function DesignerSearch() {
  const designers = await query('SELECT id, name FROM designers ORDER BY name')

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Designers</h1>
      <ul className="space-y-2">
        {designers.rows.map((designer) => (
          <li key={designer.id}>
            <Link href={`/designers/${designer.id}`} className="text-blue-600 hover:underline">
              {designer.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}