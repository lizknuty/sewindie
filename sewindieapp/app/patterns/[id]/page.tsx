/**
 * Individual pattern page
 */
import React from 'react'
import { query } from '../../lib/db'
import Link from 'next/link'

export default async function PatternPage({ params }: { params: { id: string } }) {
  const pattern = await query('SELECT p.*, d.name as designer_name FROM patterns p JOIN designers d ON p.designer_id = d.id WHERE p.id = $1', [params.id])

  if (pattern.rows.length === 0) {
    return <div>Pattern not found</div>
  }

  const { name, description, designer_name, designer_id } = pattern.rows[0]

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">{name}</h1>
      <p className="mb-4">By <Link href={`/designers/${designer_id}`} className="text-blue-600 hover:underline">{designer_name}</Link></p>
      <p className="mb-4">{description}</p>
    </div>
  )
}