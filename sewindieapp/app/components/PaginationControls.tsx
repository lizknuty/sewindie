'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type PaginationControlsProps = {
  currentPage: number
  totalPages: number
  basePath: string
}

export default function PaginationControls({ currentPage, totalPages, basePath }: PaginationControlsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    router.push(`${basePath}?${params.toString()}`)
  }

  return (
    <div className="d-flex justify-content-center align-items-center">
      <button
        className="btn btn-sm btn-outline-secondary me-2"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </button>
      <span>
        Page {currentPage} of {totalPages}
      </span>
      <button
        className="btn btn-sm btn-outline-secondary ms-2"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </div>
  )
}