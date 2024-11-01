import { query, Pattern } from '../lib/db'
import Link from 'next/link'

export default async function PatternSearch() {
  try {
    const patterns = await query('SELECT p.id, p.name, d.name as designer_name FROM Pattern p JOIN Designer d ON p.designer_id = d.id ORDER BY p.name')

    return (
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold mb-4">Patterns</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patterns.rows.map((pattern: Pattern & { designer_name: string }) => (
            <Link key={pattern.id} href={`/patterns/${pattern.id}`} className="block p-4 border rounded-lg hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold text-center">{pattern.name}</h2>
              <p className="text-center text-gray-600">by {pattern.designer_name}</p>
            </Link>
          ))}
        </div>
      </div>
    )
  } catch (error) {
    console.error('Database query error:', error)
    return <div>Error loading patterns. Please try again later.</div>
  }
}