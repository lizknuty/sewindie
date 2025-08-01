import Link from "next/link"

type Pattern = {
  id: number
  name: string
  thumbnail_url: string | null
  url: string
  yardage: string | null
  // sizes: string | null; // Removed as per schema update
  language: string | null
  designer: { id: number; name: string }
  PatternCategory: { category: { id: number; name: string } }[]
  PatternAudience: { audience: { id: number; name: string } }[]
  PatternFabricType: { fabricType: { id: number; name: string } }[]
  PatternSuggestedFabric: { suggestedFabric: { id: number; name: string } }[]
  PatternAttribute: { attribute: { id: number; name: string } }[]
}

export default function PatternDetails({ pattern }: { pattern: Pattern }) {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">{pattern.name}</h1>
      <p className="text-xl mb-6">
        By{" "}
        <Link href={`/designers/${pattern.designer.id}`} className="text-blue-500 hover:underline">
          {pattern.designer.name}
        </Link>
      </p>
      {pattern.thumbnail_url && (
        <img
          src={pattern.thumbnail_url || "/placeholder.svg"}
          alt={pattern.name}
          className="w-full max-w-2xl h-auto mb-6 rounded"
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Details</h2>
          <p>
            URL:{" "}
            <a href={pattern.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              {pattern.url}
            </a>
          </p>
          {pattern.yardage && <p>Yardage: {pattern.yardage}</p>}
          {/* {pattern.sizes && <p>Sizes: {pattern.sizes}</p>} // Removed as per schema update */}
          {pattern.language && <p>Language: {pattern.language}</p>}
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-2">Categories</h2>
          <div className="flex flex-wrap gap-2">
            {pattern.PatternCategory.map(({ category }) => (
              <span key={category.id} className="px-3 py-1 bg-blue-100 text-blue-800 rounded">
                {category.name}
              </span>
            ))}
          </div>
          <h2 className="text-2xl font-semibold mt-4 mb-2">Audience</h2>
          <div className="flex flex-wrap gap-2">
            {pattern.PatternAudience.map(({ audience }) => (
              <span key={audience.id} className="px-3 py-1 bg-green-100 text-green-800 rounded">
                {audience.name}
              </span>
            ))}
          </div>
          <h2 className="text-2xl font-semibold mt-4 mb-2">Fabric Types</h2>
          <div className="flex flex-wrap gap-2">
            {pattern.PatternFabricType.map(({ fabricType }) => (
              <span key={fabricType.id} className="px-3 py-1 bg-purple-100 text-purple-800 rounded">
                {fabricType.name}
              </span>
            ))}
          </div>
          <h2 className="text-2xl font-semibold mt-4 mb-2">Suggested Fabrics</h2>
          <div className="flex flex-wrap gap-2">
            {pattern.PatternSuggestedFabric.map(({ suggestedFabric }) => (
              <span key={suggestedFabric.id} className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded">
                {suggestedFabric.name}
              </span>
            ))}
          </div>
          <h2 className="text-2xl font-semibold mt-4 mb-2">Attributes</h2>
          <div className="flex flex-wrap gap-2">
            {pattern.PatternAttribute.map(({ attribute }) => (
              <span key={attribute.id} className="px-3 py-1 bg-red-100 text-red-800 rounded">
                {attribute.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
