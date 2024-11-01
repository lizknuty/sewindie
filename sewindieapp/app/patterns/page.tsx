import Link from 'next/link'
import prisma from '@/lib/prisma'

type Category = {
  id: number;
  name: string;
}

type PatternCategory = {
  category: Category;
}

type Designer = {
  name: string;
}

type Pattern = {
  id: number;
  name: string;
  thumbnail_url: string | null;
  designer: Designer;
  patternCategories: PatternCategory[];
}

export default async function PatternsPage() {
  const patterns: Pattern[] = await prisma.pattern.findMany({
    orderBy: { name: 'asc' },
    include: {
      designer: { select: { name: true } },
      patternCategories: { include: { category: true } }
    }
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Patterns</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {patterns.map((pattern) => (
          <Link key={pattern.id} href={`/patterns/${pattern.id}`} className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            {pattern.thumbnail_url && (
              <img src={pattern.thumbnail_url} alt={pattern.name} className="w-full h-48 object-cover mb-4 rounded" />
            )}
            <h2 className="text-xl font-semibold mb-2">{pattern.name}</h2>
            <p className="text-gray-600 mb-2">By {pattern.designer.name}</p>
            <div className="flex flex-wrap gap-2">
              {pattern.patternCategories.map(({ category }) => (
                <span key={category.id} className="px-2 py-1 bg-gray-200 text-sm rounded">{category.name}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}