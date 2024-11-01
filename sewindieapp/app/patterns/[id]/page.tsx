import prisma from '@/app/lib/db'
import Link from 'next/link'

export default async function PatternPage({ params }: { params: { id: string } }) {
  try {
    const pattern = await prisma.pattern.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        designer: true,
        patternCategories: {
          include: { category: true }
        },
        patternFormats: {
          include: { format: true }
        },
        patternSuggestedFabrics: {
          include: { suggestedFabric: true }
        },
        patternAttributes: {
          include: { attribute: true }
        }
      }
    })

    if (!pattern) {
      return <div>Pattern not found</div>
    }

    return (
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold mb-4">{pattern.name}</h1>
        <div className="mb-4">
          <p>By <Link href={`/designers/${pattern.designer_id}`} className="text-blue-600 hover:underline">{pattern.designer.name}</Link></p>
        </div>
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">Categories</h2>
          <ul>
            {pattern.patternCategories.map((pc) => (
              <li key={pc.category.id}>{pc.category.name}</li>
            ))}
          </ul>
        </div>
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">Formats</h2>
          <ul>
            {pattern.patternFormats.map((pf) => (
              <li key={pf.format.id}>{pf.format.name}</li>
            ))}
          </ul>
        </div>
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">Suggested Fabrics</h2>
          <ul>
            {pattern.patternSuggestedFabrics.map((psf) => (
              <li key={psf.suggestedFabric.id}>{psf.suggestedFabric.name}</li>
            ))}
          </ul>
        </div>
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">Attributes</h2>
          <ul>
            {pattern.patternAttributes.map((pa) => (
              <li key={pa.attribute.id}>{pa.attribute.name}</li>
            ))}
          </ul>
        </div>
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">Additional Information</h2>
          <p>Yardage: {pattern.yardage}</p>
          <p>Sizes: {pattern.sizes}</p>
          <p>Language: {pattern.language}</p>
          <p>Audience: {pattern.audience}</p>
          <p>Fabric Type: {pattern.fabric_type}</p>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Database query error:', error)
    return <div>Error loading pattern information. Please try again later.</div>
  }
}