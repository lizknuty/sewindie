import Link from 'next/link'
import prisma from '@/lib/prisma'

type Designer = {
  id: number;
  name: string;
  logo_url: string | null;
}

export default async function DesignersPage() {
  const designers: Designer[] = await prisma.designer.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, logo_url: true }
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Designers</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {designers.map((designer) => (
          <Link key={designer.id} href={`/designers/${designer.id}`} className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            {designer.logo_url && (
              <img src={designer.logo_url} alt={`${designer.name} logo`} className="w-32 h-32 object-contain mb-4 mx-auto" />
            )}
            <h2 className="text-xl font-semibold text-center">{designer.name}</h2>
          </Link>
        ))}
      </div>
    </div>
  )
}