import React from 'react'
import prisma from '@/lib/prisma'
import DesignerCard from '@/components/DesignerCard'

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
            <DesignerCard
              id={designer.id}
              name={designer.name}
              logo_url={designer.logo_url}
            />
          </div>
        ))}
      </div>
    </div>
  )
}