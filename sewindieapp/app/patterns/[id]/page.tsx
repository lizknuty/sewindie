import { query, Pattern } from '../../lib/db'
import Link from 'next/link'

export default async function PatternPage({ params }: { params: { id: string } }) {
  try {
    const pattern = await query('SELECT p.*, d.name as designer_name, d.id as designer_id FROM Pattern p JOIN Designer d ON p.designer_id = d.id WHERE p.id = $1', [params.id])
    const categories = await query('SELECT c.name FROM Category c JOIN PatternCategory pc ON c.id = pc.category_id WHERE pc.pattern_id = $1', [params.id])
    const formats = await query('SELECT f.name FROM Format f JOIN PatternFormat pf ON f.id = pf.format_id WHERE pf.pattern_id = $1', [params.id])
    const suggestedFabrics = await query('SELECT sf.name FROM SuggestedFabric sf JOIN PatternSuggestedFabric psf ON sf.id = psf.suggested_fabric_id WHERE psf.pattern_id = $1', [params.id])
    const attributes = await query('SELECT a.name FROM Attribute a JOIN PatternAttribute pa ON a.id = pa.attribute_id WHERE pa.pattern_id = $1', [params.id])

    if (pattern.rows.length === 0) {
      return <div>Pattern not found</div>
    }

    const patternData: Pattern & { designer_name: string; designer_id: number } = pattern.rows[0]

    return (
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold mb-4">{patternData.name}</h1>
        <div className="mb-4">
          <p>By <Link href={`/designers/${patternData.designer_id}`} className="text-blue-600 hover:underline">{patternData.designer_name}</Link></p>
        </div>
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">Categories</h2>
          <ul>
            {categories.rows.map((category, index) => (
              <li key={index}>{category.name}</li>
            ))}
          </ul>
        </div>
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">Formats</h2>
          <ul>
            {formats.rows.map((format, index) => (
              <li key={index}>{format.name}</li>
            ))}
          </ul>
        </div>
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">Suggested Fabrics</h2>
          <ul>
            {suggestedFabrics.rows.map((fabric, index) => (
              <li key={index}>{fabric.name}</li>
            ))}
          </ul>
        </div>
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">Attributes</h2>
          <ul>
            {attributes.rows.map((attribute, index) => (
              <li key={index}>{attribute.name}</li>
            ))}
          </ul>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Database query error:', error)
    return <div>Error loading pattern information. Please try again later.</div>
  }
}