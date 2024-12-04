import Link from 'next/link'
import Image from 'next/image'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/api/auth/[...nextauth]/options'
import prisma from '@/lib/prisma'
import FeaturedCarousel from './components/FeaturedCarousel'

import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

export default async function Home() {
  const session = await getServerSession(authOptions)

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
    <div className="d-flex flex-column min-vh-100">
      <div className="hero-banner position-relative w-100">
        <Image
          src="/hero.jpg"
          alt="Hero image"
          fill
          style={{ objectFit: 'cover' }}
          className="z-1"
        />
        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center z-2">
          {!session && (
            <div className="d-flex flex-column flex-sm-row align-items-center justify-content-center">
              <Link href="/login" className="btn btn-primary btn-lg hero-btn mb-3 mb-sm-0 me-sm-4">
                Login
              </Link>
              <Link href="/create-account" className="btn btn-outline-primary btn-lg hero-btn">
                Create Account
              </Link>
            </div>
          )}
        </div>
      </div>

      <main className="flex-grow-1">
        <div className="container px-4 py-5">
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
        </div>
      </main>
    </div>
  )
}