import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import prisma from '@/lib/prisma'

type Pattern = {
  id: number;
  name: string;
  thumbnail_url: string | null;
  url: string;
  yardage: string | null;
  sizes: string | null;
  language: string | null;
  designer: {
    id: number;
    name: string;
  };
  PatternCategory: { category: { id: number; name: string } }[];
  PatternAudience: { audience: { id: number; name: string } }[];
  PatternFabricType: { fabricType: { id: number; name: string } }[];
  PatternSuggestedFabric: { suggestedFabric: { id: number; name: string } }[];
  PatternAttribute: { attribute: { id: number; name: string } }[];
}

type PageProps = {
  params: Promise<{ id: string }>;
}

export default async function PatternPage({ params }: PageProps) {
  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    notFound()
  }

  const pattern = await prisma.pattern.findUnique({
    where: { id: patternId },
    include: {
      designer: true,
      PatternCategory: { include: { category: true } },
      PatternAudience: { include: { audience: true } },
      PatternFabricType: { include: { fabricType: true } },
      PatternSuggestedFabric: { include: { suggestedFabric: true } },
      PatternAttribute: { include: { attribute: true } }
    }
  }) as Pattern | null

  if (!pattern) {
    notFound()
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="container py-5">
        <div className="row">
          <div className="col-md-4">
            <div className="card mb-4">
              {pattern.thumbnail_url && (
                <>
                  <div className="position-relative" style={{ paddingBottom: '125%' }}>
                    <Image
                      src={pattern.thumbnail_url}
                      alt={pattern.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 40vw, 25vw"
                      className="card-img-top object-fit-cover"
                    />
                  </div>
                  <p className="text-center mt-2">© {pattern.designer.name}</p>
                </>
              )}
              <div className="card-body">
                <a href={pattern.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-100">
                  View on Designer's Website
                </a>
              </div>
            </div>
          </div>
          <div className="col-md-8">
            <h1 className="font-heading mb-4">{pattern.name}</h1>
            <h2 className="h4 font-heading mb-3">by {pattern.designer.name}</h2>

            <div className="row mb-4">
              <div className="col-md-6">
                <h3 className="h5 font-heading">Details</h3>
                <ul className="list-unstyled">
                  <li><strong>Yardage:</strong> {pattern.yardage || 'Not specified'}</li>
                  <li><strong>Sizes:</strong> {pattern.sizes || 'Not specified'}</li>
                  <li><strong>Language:</strong> {pattern.language || 'Not specified'}</li>
                  <li>
                    <strong>Audience:</strong>{' '}
                    {pattern.PatternAudience.map(({ audience }, index) => (
                      <span key={audience.id}>
                        {index > 0 && ', '}
                        {audience.name}
                      </span>
                    ))}
                  </li>
                  <li>
                    <strong>Fabric Types:</strong>{' '}
                    {pattern.PatternFabricType.map(({ fabricType }, index) => (
                      <span key={fabricType.id}>
                        {index > 0 && ', '}
                        {fabricType.name}
                      </span>
                    ))}
                  </li>
                  <li>
                    <strong>Suggested Fabrics:</strong>{' '}
                    {pattern.PatternSuggestedFabric.map(({ suggestedFabric }, index) => (
                      <span key={suggestedFabric.id}>
                        {index > 0 && ', '}
                        {suggestedFabric.name}
                      </span>
                    ))}
                  </li>
                </ul>
              </div>
              <div className="col-md-6">
                <h3 className="h5 font-heading">Categories</h3>
                <div>
                  {pattern.PatternCategory.map(({ category }) => (
                    <span key={category.id} className="badge bg-secondary text-white me-2 mb-2">
                      {category.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>


            <div className="mb-4">
              <h3 className="h5 font-heading">Attributes</h3>
              <ul className="list-inline">
                {pattern.PatternAttribute.map(({ attribute }) => (
                  <li key={attribute.id} className="list-inline-item">
                    <span className="badge bg-secondary">{attribute.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-4">
              <h3 className="h5 font-heading">About the Designer</h3>
              <p>No designer description available.</p>
              <Link href={`/designers/${pattern.designer.id}`} className="btn btn-primary">
                View All Patterns by {pattern.designer.name}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Suspense>
  )
}