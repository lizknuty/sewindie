import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'
import prisma from '@/lib/prisma'

const PatternDetails = dynamic(() => import('@/components/PatternDetails'), {
  loading: () => <p>Loading...</p>,
})

type Pattern = {
  id: number;
  name: string;
  thumbnail_url: string | null;
  url: string;
  yardage: string | null;
  sizes: string | null;
  language: string | null;
  designer: { id: number; name: string };
  PatternCategory: { category: { id: number; name: string } }[];
  PatternAudience: { audience: { id: number; name: string } }[];
  PatternFabricType: { fabricType: { id: number; name: string } }[];
  PatternSuggestedFabric: { suggestedFabric: { id: number; name: string } }[];
  PatternAttribute: { attribute: { id: number; name: string } }[];
}

export default async function PatternPage({ params }: { params: { id: string } }) {
  const patternId = parseInt(params.id, 10)

  if (isNaN(patternId)) {
    notFound()
  }

  const pattern = await prisma.pattern.findUnique({
    where: { id: patternId },
    include: {
      designer: true,
      PatternCategory: { include: { category: true } },
      PatternAudience: { include: { audience: true } },
      PatternFabricType: { include: { fabricType: true } },
      PatternSuggestedFabric: { include: { suggestedFabric: true } },
      PatternAttribute: { include: { attribute: true } }
    }
  }) as Pattern | null

  if (!pattern) {
    notFound()
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PatternDetails pattern={pattern} />
    </Suspense>
  )
}