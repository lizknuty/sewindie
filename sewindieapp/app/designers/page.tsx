import prisma from '@/app/lib/db'
import Link from 'next/link'

export default async function DesignerSearch() {
  try {
    const designers = await prisma.designer.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    })

    return (
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold mb-4">Designers</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {designers.map((designer) => (
            <Link key={designer.id} href={`/designers/${designer.id}`} className="block p-4 border rounded-lg hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold text-center">{designer.name}</h2>
            </Link>
          ))}
        </div>
      </div>
    )
  } catch (error) {
    console.error('Database query error:', error)
    return <div>Error loading designers. Please try again later.</div>
  }
}