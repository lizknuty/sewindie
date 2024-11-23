import React from 'react'
import Link from 'next/link'
import Image from 'next/image'

type DesignerCardProps = {
  id: number;
  name: string;
  logo_url: string | null;
}

export default function DesignerCard({ id, name, logo_url }: DesignerCardProps) {
  if (!id || !name) {
    console.error('Invalid designer data:', { id, name });
    return null;
  }

  return (
    <div className="card h-100" style={{ backgroundColor: 'white' }}>
      <div className="card-body d-flex flex-column justify-content-center align-items-center">
        <div className="mb-3" style={{ width: '100px', height: '100px', position: 'relative' }}>
          {logo_url ? (
            <Image
              src={logo_url}
              alt={`${name} logo`}
              fill
              sizes="100px"
              style={{ objectFit: 'contain' }}
              className="rounded"
            />
          ) : (
            <div className="w-100 h-100 bg-light d-flex justify-content-center align-items-center rounded">
              <span className="text-muted fs-1">{name[0]}</span>
            </div>
          )}
        </div>
        <h2 className="card-title h5 text-center mb-2">
          <Link href={`/designers/${id}`} className="text-decoration-none">
            {name}
          </Link>
        </h2>
      </div>
    </div>
  )
}