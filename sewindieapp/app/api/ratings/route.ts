import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import prisma from '@/lib/prisma'
import { authOptions } from '../auth/[...nextauth]/route'

async function getUserId(email: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error('User not found')
  return user.id
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const patternId = searchParams.get('patternId')

  try {
    const userId = await getUserId(session.user.email)

    if (patternId) {
      // Get rating for a specific pattern
      const averageRating = await prisma.rating.aggregate({
        where: { patternId: parseInt(patternId) },
        _avg: { score: true },
      })

      const userRatingData = await prisma.rating.findFirst({
        where: {
          userId: userId,
          patternId: parseInt(patternId),
        },
      })

      return NextResponse.json({
        averageRating: averageRating._avg.score || 0,
        userRating: userRatingData?.score || 0,
      })
    } else {
      // Fetch all rated patterns for the user
      const ratedPatterns = await prisma.rating.findMany({
        where: {
          userId: userId,
        },
        include: {
          pattern: {
            include: {
              designer: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return NextResponse.json({
        ratedPatterns: ratedPatterns.map(rp => ({
          ...rp.pattern,
          rating: rp.score,
          ratedAt: rp.createdAt,
        })),
      })
    }
  } catch (error) {
    console.error('Error fetching ratings:', error)
    return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body;
  try {
    body = await request.json()
  } catch (error) {
    console.error('Error parsing request body:', error)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { patternId, score } = body

  if (!patternId || typeof patternId !== 'number' || typeof score !== 'number' || score < 1 || score > 5) {
    return NextResponse.json({ error: 'Valid Pattern ID and score (1-5) are required' }, { status: 400 })
  }

  try {
    const userId = await getUserId(session.user.email)
    const rating = await prisma.rating.upsert({
      where: {
        userId_patternId: {
          userId: userId,
          patternId: patternId,
        },
      },
      update: { score },
      create: {
        userId: userId,
        patternId: patternId,
        score,
      },
    })

    // Recalculate average rating
    const averageRating = await prisma.rating.aggregate({
      where: { patternId: patternId },
      _avg: { score: true },
    })

    return NextResponse.json({
      rating,
      averageRating: averageRating._avg.score || 0,
    })
  } catch (error) {
    console.error('Error updating rating:', error)
    return NextResponse.json({ error: 'Failed to update rating' }, { status: 500 })
  }
}