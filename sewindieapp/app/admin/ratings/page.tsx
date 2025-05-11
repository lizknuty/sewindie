"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Star, Trash2, Search } from "lucide-react"
import { useRouter } from "next/navigation"

interface User {
  id: number
  name: string
  email: string
}

interface Pattern {
  id: string
  name: string
  designer: {
    id: string
    name: string
  }
}

interface Rating {
  id: number
  score: number
  createdAt: string
  updatedAt: string
  user: User
  pattern: Pattern
}

interface PaginationData {
  total: number
  page: number
  limit: number
  pages: number
}

export default function RatingsPage() {
  const router = useRouter()
  const [ratings, setRatings] = useState<Rating[]>([])
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: 20,
    pages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [patternFilter, setPatternFilter] = useState("")
  const [userFilter, setUserFilter] = useState("")
  const [isDeleting, setIsDeleting] = useState<Record<number, boolean>>({})

  const fetchRatings = async (page = 1) => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      })

      if (patternFilter) {
        queryParams.append("patternId", patternFilter)
      }

      if (userFilter) {
        queryParams.append("userId", userFilter)
      }

      const response = await fetch(`/api/admin/ratings?${queryParams.toString()}`)
      if (!response.ok) {
        throw new Error("Failed to fetch ratings")
      }

      const data = await response.json()
      setRatings(data.ratings)
      setPagination(data.pagination)
    } catch (error) {
      console.error("Error fetching ratings:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRatings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePageChange = (page: number) => {
    fetchRatings(page)
  }

  const handleDeleteRating = async (id: number) => {
    if (confirm("Are you sure you want to delete this rating?")) {
      setIsDeleting((prev) => ({ ...prev, [id]: true }))
      try {
        const response = await fetch(`/api/admin/ratings/${id}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          throw new Error("Failed to delete rating")
        }

        // Refresh the ratings list
        fetchRatings(pagination.page)
      } catch (error) {
        console.error("Error deleting rating:", error)
        alert("Failed to delete rating. Please try again.")
      } finally {
        setIsDeleting((prev) => ({ ...prev, [id]: false }))
      }
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchRatings(1)
  }

  const renderPagination = () => {
    const pages = []
    const maxPages = Math.min(pagination.pages, 5)
    let startPage = Math.max(1, pagination.page - 2)
    const endPage = Math.min(pagination.pages, startPage + maxPages - 1)

    if (endPage - startPage + 1 < maxPages) {
      startPage = Math.max(1, endPage - maxPages + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <li key={i} className={`page-item ${pagination.page === i ? "active" : ""}`}>
          <button className="page-link" onClick={() => handlePageChange(i)}>
            {i}
          </button>
        </li>,
      )
    }

    return (
      <nav aria-label="Ratings pagination">
        <ul className="pagination">
          <li className={`page-item ${pagination.page === 1 ? "disabled" : ""}`}>
            <button className="page-link" onClick={() => handlePageChange(1)} disabled={pagination.page === 1}>
              First
            </button>
          </li>
          <li className={`page-item ${pagination.page === 1 ? "disabled" : ""}`}>
            <button
              className="page-link"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              Previous
            </button>
          </li>
          {pages}
          <li className={`page-item ${pagination.page === pagination.pages ? "disabled" : ""}`}>
            <button
              className="page-link"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
            >
              Next
            </button>
          </li>
          <li className={`page-item ${pagination.page === pagination.pages ? "disabled" : ""}`}>
            <button
              className="page-link"
              onClick={() => handlePageChange(pagination.pages)}
              disabled={pagination.page === pagination.pages}
            >
              Last
            </button>
          </li>
        </ul>
      </nav>
    )
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Ratings Management</h1>
        <Link href="/admin/analytics/ratings" className="btn btn-primary">
          <Star size={18} className="me-2" />
          Ratings Analytics
        </Link>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <form onSubmit={handleSearch} className="row g-3">
            <div className="col-md-5">
              <label htmlFor="patternFilter" className="form-label">
                Pattern ID
              </label>
              <input
                type="text"
                className="form-control"
                id="patternFilter"
                value={patternFilter}
                onChange={(e) => setPatternFilter(e.target.value)}
                placeholder="Filter by pattern ID"
              />
            </div>
            <div className="col-md-5">
              <label htmlFor="userFilter" className="form-label">
                User ID
              </label>
              <input
                type="text"
                className="form-control"
                id="userFilter"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="Filter by user ID"
              />
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button type="submit" className="btn btn-primary w-100">
                <Search size={18} className="me-2" />
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      {loading ? (
        <div className="text-center my-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Pattern</th>
                  <th>Designer</th>
                  <th>Rating</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ratings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4">
                      No ratings found
                    </td>
                  </tr>
                ) : (
                  ratings.map((rating) => (
                    <tr key={rating.id}>
                      <td>{rating.id}</td>
                      <td>
                        {rating.user.name}
                        <br />
                        <small className="text-muted">{rating.user.email}</small>
                      </td>
                      <td>
                        <Link href={`/admin/patterns/${rating.pattern.id}/edit`}>{rating.pattern.name}</Link>
                      </td>
                      <td>{rating.pattern.designer?.name}</td>
                      <td>
                        <div className="d-flex align-items-center">
                          {Array.from({ length: rating.score }).map((_, i) => (
                            <Star key={i} size={16} className="text-warning" />
                          ))}
                        </div>
                      </td>
                      <td>{formatDistanceToNow(new Date(rating.createdAt), { addSuffix: true })}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteRating(rating.id)}
                          disabled={isDeleting[rating.id]}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && <div className="d-flex justify-content-center mt-4">{renderPagination()}</div>}
        </>
      )}
    </div>
  )
}
