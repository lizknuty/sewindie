import Link from 'next/link'
import Image from 'next/image'
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
      <h1 className="text-4xl font-bold mb-8 text-center">Designers</h1>
      <div className="row row-cols-1 row-cols-md-3 row-cols-lg-4 g-4">
        {designers.map((designer) => (
          <div key={designer.id} className="col">
            <Link href={`/designers/${designer.id}`} className="card h-100 text-center text-decoration-none">
              <div className="card-body d-flex flex-column justify-content-center align-items-center">
                <div className="mb-3" style={{ width: '100px', height: '100px', position: 'relative' }}>
                  {designer.logo_url ? (
                    <Image
                      src={designer.logo_url}
                      alt={`${designer.name} logo`}
                      fill
                      sizes="100px"
                      style={{ objectFit: 'contain' }}
                    />
                  ) : (
                    <div className="w-100 h-100 bg-light d-flex justify-content-center align-items-center">
                      <span className="text-muted fs-1">{designer.name[0]}</span>
                    </div>
                  )}
                </div>
                <h2 className="card-title h5">{designer.name}</h2>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}