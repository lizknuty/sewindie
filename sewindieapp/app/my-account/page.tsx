'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

type Pattern = {
  id: number
  name: string
  thumbnail_url: string
  designer: {
    name: string
  }
}

type FavoritedPattern = Pattern & {
  favoritedAt: string
}

type RatedPattern = Pattern & {
  rating: number
  ratedAt: string
}

export default function MyAccountPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [favoritedPatterns, setFavoritedPatterns] = useState<FavoritedPattern[]>([])
  const [ratedPatterns, setRatedPatterns] = useState<RatedPattern[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchFavoritedPatterns()
      fetchRatedPatterns()
    }
  }, [status, router])

  const fetchFavoritedPatterns = async () => {
    try {
      const response = await fetch('/api/favorites')
      if (response.ok) {
        const data = await response.json()
        setFavoritedPatterns(data.favoritedPatterns)
      }
    } catch (error) {
      console.error('Error fetching favorited patterns:', error)
    }
  }

  const fetchRatedPatterns = async () => {
    try {
      const response = await fetch('/api/ratings')
      if (response.ok) {
        const data = await response.json()
        setRatedPatterns(data.ratedPatterns)
      }
    } catch (error) {
      console.error('Error fetching rated patterns:', error)
    }
  }

  if (status === 'loading') {
    return <div>Loading...</div>
  }

  return (
    <div className="container mt-5">
      <h1 className="mb-4">My Account</h1>
      <h2 className="mb-3">Favorited Patterns</h2>
      <div className="row">
        {favoritedPatterns.map((pattern) => (
          <div key={pattern.id} className="col-md-4 mb-4">
            <div className="card">
              <Image
                src={pattern.thumbnail_url || '/placeholder.svg'}
                alt={pattern.name}
                width={300}
                height={300}
                className="card-img-top"
              />
              <div className="card-body">
                <h5 className="card-title">{pattern.name}</h5>
                <p className="card-text">By {pattern.designer.name}</p>
                <p className="card-text">
                  <small className="text-muted">
                    Favorited on: {new Date(pattern.favoritedAt).toLocaleDateString()}
                  </small>
                </p>
                <Link href={`/patterns/${pattern.id}`} className="btn btn-primary">
                  View Pattern
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-5">Rated Patterns</h2>
      <div className="row">
        {ratedPatterns.map((pattern) => (
          <div key={pattern.id} className="col-md-4 mb-4">
            <div className="card">
              <Image
                src={pattern.thumbnail_url || '/placeholder.svg'}
                alt={pattern.name}
                width={300}
                height={300}
                className="card-img-top"
              />
              <div className="card-body">
                <h5 className="card-title">{pattern.name}</h5>
                <p className="card-text">By {pattern.designer.name}</p>
                <p className="card-text">
                  Rating: {pattern.rating} / 5
                </p>
                <p className="card-text">
                  <small className="text-muted">
                    Rated on: {new Date(pattern.ratedAt).toLocaleDateString()}
                  </small>
                </p>
                <Link href={`/patterns/${pattern.id}`} className="btn btn-primary">
                  View Pattern
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}