import React from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Pattern {
  id: number
  name: string
  thumbnail_url: string
  designer: {
    id: number
    name: string
  }
}

interface PatternListProps {
  patterns: Pattern[]
}

export default function PatternList({ patterns }: PatternListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {patterns.map((pattern) => (
        <div key={pattern.id} className="bg-white rounded-lg shadow-md overflow-hidden">
          <Link href={`/patterns/${pattern.id}`}>
            <div className="relative h-48">
              <Image
                src={pattern.thumbnail_url || '/placeholder.svg'}
                alt={pattern.name}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-2">{pattern.name}</h2>
              <p className="text-sm text-gray-600">By {pattern.designer.name}</p>
            </div>
          </Link>
        </div>
      ))}
    </div>
  )
}