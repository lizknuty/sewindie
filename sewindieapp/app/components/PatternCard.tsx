import React from 'react'
import Link from 'next/link'
import Image from 'next/image'

type PatternCardProps = {
  id: number;
  name: string;
  thumbnail_url: string | null;
  designer: {
    id: number;
    name: string;
  };
  patternCategories: {
    category: {
      id: number;
      name: string;
    }
  }[];
}

export default function PatternCard({ id, name, thumbnail_url, designer, patternCategories }: PatternCardProps) {
  if (!id || !name || !designer) {
    console.error('Invalid pattern data:', { id, name, designer });
    return null;
  }

  return (
    <div className="card h-100">
      <div className="card-body d-flex flex-column">
        <div className="mb-3" style={{ height: '200px', position: 'relative' }}>
          {thumbnail_url ? (
            <Image
              src={thumbnail_url}
              alt={`${name} thumbnail`}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              style={{ objectFit: 'contain' }}
              className="rounded"
            />
          ) : (
            <div className="w-100 h-100 bg-light d-flex justify-content-center align-items-center rounded">
              <span className="text-muted">No image</span>
            </div>
          )}
        </div>
        <h2 className="card-title h5 text-center mb-2">
          <Link href={`/patterns/${id}`} className="text-decoration-none">
            {name}
          </Link>
        </h2>
        <p className="card-text text-center text-muted mb-3">
          <Link href={`/designers/${designer.id}`} className="text-decoration-none text-muted">
            {designer.name}
          </Link>
        </p>
        <div className="mt-auto d-flex flex-wrap justify-content-center gap-1">
          {patternCategories && patternCategories.map(pc => (
            <span key={pc.category.id} className="badge bg-secondary">
              {pc.category.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}