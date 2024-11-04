import Link from 'next/link'
import prisma from '@/lib/prisma'
import FeaturedCarousel from './components/FeaturedCarousel'

import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

export default async function Home() {
  const featuredDesigners = await prisma.designer.findMany({
    take: 8,
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
    take: 8,
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
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold mb-8">Welcome to SewIndie</h1>
      </div>

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

      <div className="mb-32 grid text-center lg:mb-0 lg:grid-cols-2 lg:text-left">
        <Link
          href="/patterns"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Patterns{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Explore our collection of sewing patterns.
          </p>
        </Link>

        <Link
          href="/designers"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Designers{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Discover talented independent pattern designers.
          </p>
        </Link>
      </div>
    </main>
  )
}