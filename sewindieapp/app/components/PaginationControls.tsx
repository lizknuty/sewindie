'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type PaginationControlsProps = {
  currentPage: number
  totalPages: number
  perPage: number
  totalItems: number
}

export default function PaginationControls({ currentPage, totalPages, perPage, totalItems }: PaginationControlsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    router.push(`/patterns?${params.toString()}`)
  }

  const handlePerPageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newPerPage = parseInt(event.target.value, 10)
    const params = new URLSearchParams(searchParams.toString())
    params.set('perPage', newPerPage.toString())
    params.set('page', '1')
    router.push(`/patterns?${params.toString()}`)
  }

  return (
    <div className="d-flex justify-content-between align-items-center">
      <div className="d-flex align-items-center">
        <span className="me-2">Show:</span>
        <select
          className="form-select form-select-sm"
          value={perPage}
          onChange={handlePerPageChange}
          style={{ width: 'auto' }}
        >
          <option value="40">40</option>
          <option value="80">80</option>
          <option value="-1">All</option>
        </select>
      </div>
      <div className="d-flex align-items-center">
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
    </div>
  )
}