import Link from 'next/link'
import prisma from '@/lib/prisma'
import FeaturedCarousel from './components/FeaturedCarousel'

import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

export default async function Home() {
  const featuredDesigners = await prisma.designer.findMany({
    take: 6,
    select: {
      id: true,
      name: true,
      logo_url: true,
    },
    orderBy: {
      patterns: {
        _count: 'desc',
      },
    },
  })

  const featuredPatterns = await prisma.pattern.findMany({
    take: 6,
    select: {
      id: true,
      name: true,
      thumbnail_url: true,
    },
    orderBy: {
      id: 'desc',
    },
  })

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 md:p-24">
      <div className="w-full max-w-5xl">
        <h1 className="text-4xl font-bold mb-8 text-center">Welcome to SewIndie</h1>

        <FeaturedCarousel
          designers={featuredDesigners.map(d => ({
            id: d.id,
            name: d.name,
            imageUrl: d.logo_url || '/placeholder.svg',
          }))}
          patterns={featuredPatterns.map(p => ({
            id: p.id,
            name: p.name,
            imageUrl: p.thumbnail_url || '/placeholder.svg',
          }))}
        />

        <div className="mt-12 flex flex-col sm:flex-row justify-center items-stretch gap-6">
          <Link href="/patterns" className="btn btn-primary btn-lg">
            Patterns
          </Link>
          <Link href="/designers" className="btn btn-primary btn-lg">
            Designers
          </Link>
        </div>
      </div>
    </main>
  )
}