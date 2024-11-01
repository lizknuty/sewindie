import prisma from '@/app/lib/db'
import Link from 'next/link'

export default async function DesignerPage({ params }: { params: { id: string } }) {
  try {
    const designer = await prisma.designer.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        patterns: {
          select: { id: true, name: true }
        }
      }
    })

    if (!designer) {
      return <div>Designer not found</div>
    }

    return (
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold mb-4">{designer.name}</h1>
        <h2 className="text-2xl font-bold mb-2">Patterns</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {designer.patterns.map((pattern) => (
            <Link key={pattern.id} href={`/patterns/${pattern.id}`} className="block p-4 border rounded-lg hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-center">{pattern.name}</h3>
            </Link>
          ))}
        </div>
      </div>
    )
  } catch (error) {
    console.error('Database query error:', error)
    return <div>Error loading designer information. Please try again later.</div>
  }
}