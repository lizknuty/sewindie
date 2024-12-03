'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Heart, Star } from 'lucide-react'

type FavoritesAndRatingsProps = {
  patternId: number;
}

export default function FavoritesAndRatings({ patternId }: FavoritesAndRatingsProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [isFavorited, setIsFavorited] = useState(false)
  const [userRating, setUserRating] = useState(0)
  const [averageRating, setAverageRating] = useState(0)

  useEffect(() => {
    const fetchFavoriteStatus = async () => {
      if (session?.user) {
        try {
          const res = await fetch(`/api/favorites?patternId=${patternId}`)
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
          const data = await res.json()
          setIsFavorited(data.isFavorited)
        } catch (e) {
          console.error('Failed to fetch favorite status:', e)
        }
      }
    }

    const fetchRatings = async () => {
      try {
        const res = await fetch(`/api/ratings?patternId=${patternId}`)
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        const data = await res.json()
        if (session?.user) setUserRating(data.userRating)
        setAverageRating(data.averageRating)
      } catch (e) {
        console.error('Failed to fetch ratings:', e)
      }
    }

    fetchFavoriteStatus()
    fetchRatings()
  }, [patternId, session])

  const handleFavorite = async () => {
    if (!session) {
      router.push('/login')
      return
    }

    try {
      if (isFavorited) {
        // DELETE request
        const res = await fetch(`/api/favorites?patternId=${patternId}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || `HTTP error! status: ${res.status}`)
        }
      } else {
        // POST request
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patternId }),
        })
        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || `HTTP error! status: ${res.status}`)
        }
      }

      setIsFavorited(!isFavorited)
    } catch (e) {
      console.error('Failed to update favorite status:', e)
      // You might want to show an error message to the user here
    }
  }

  const handleRating = async (score: number) => {
    if (!session) {
      router.push('/login')
      return
    }

    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patternId, score }),
      })
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      setUserRating(score)
      const ratingRes = await fetch(`/api/ratings?patternId=${patternId}`)
      if (!ratingRes.ok) throw new Error(`HTTP error! status: ${ratingRes.status}`)
      const ratingData = await ratingRes.json()
      setAverageRating(ratingData.averageRating)
    } catch (e) {
      console.error('Failed to update rating:', e)
      // You might want to show an error message to the user here
    }
  }

  return (
    <div className="mb-4">
      <div className="d-flex align-items-center mb-2">
        {session ? (
          <button 
            className={`btn ${isFavorited ? 'btn-secondary' : 'btn-outline-secondary'} me-2`}
            onClick={handleFavorite}
          >
            <Heart className={`inline-block mr-2 ${isFavorited ? 'text-danger' : ''}`} />
            {isFavorited ? 'Favorited' : 'Add to Favorites'}
          </button>
        ) : (
          <button 
            className="btn btn-outline-secondary me-2"
            onClick={() => router.push('/login')}
          >
            <Heart className="inline-block mr-2" />
            Login to Favorite
          </button>
        )}
        <div>
          <p className="mb-1">Average rating: {averageRating.toFixed(1)} / 5</p>
          <div className="d-flex">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`cursor-pointer ${star <= userRating ? 'text-warning' : 'text-secondary'}`}
                onClick={() => session ? handleRating(star) : router.push('/login')}
              />
            ))}
          </div>
        </div>
      </div>
      {!session && (
        <p className="text-muted small">Login to rate this pattern</p>
      )}
    </div>
  )
}