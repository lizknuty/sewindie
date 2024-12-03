import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import PatternDetails from '@/components/PatternDetails'
import prisma from '@/lib/prisma'

async function getPattern(id: string) {
  const pattern = await prisma.pattern.findUnique({
    where: { id: parseInt(id) },
    include: {
      designer: true,
      PatternCategory: { include: { category: true } },
      PatternAudience: { include: { audience: true } },
      PatternFabricType: { include: { fabricType: true } },
      PatternSuggestedFabric: { include: { suggestedFabric: true } },
      PatternAttribute: { include: { attribute: true } },
    },
  })

  if (!pattern) {
    notFound()
  }

  return pattern
}

export default async function PatternPage({ params }: { params: { id: string } }) {
  const pattern = await getPattern(params.id)

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PatternDetails pattern={pattern} />
    </Suspense>
  )
}