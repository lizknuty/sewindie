import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import PatternThumbnail from '@/components/PatternThumbnail'
import { prisma } from '@/lib/prisma'
import FavoritesAndRatings from '@/components/FavoritesAndRatings'

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

  // Renders a joined list, or an italic placeholder so an empty relation is
  // visibly "no data" rather than a blank space next to a label.
  const specValue = (value: string | null | undefined) =>
    value && value.trim() ? (
      <span>{value}</span>
    ) : (
      <span className="pdetail-spec-empty">Not specified</span>
    )

  const joinNames = (items: { name: string }[]) => (items.length > 0 ? items.map((i) => i.name).join(', ') : null)

  return (
    <Suspense fallback={<div className="pdetail">Loading...</div>}>
      <div className="pdetail">
        <Link href="/patterns" className="pdetail-back">
          <ChevronLeft size={15} aria-hidden="true" />
          All patterns
        </Link>

        <div className="pdetail-body">
          <div>
            {pattern.thumbnail_url ? (
              <>
                <div className="pdetail-media">
                  <PatternThumbnail
                    src={pattern.thumbnail_url}
                    alt={pattern.name}
                    fill
                    sizes="(min-width: 768px) 320px, 100vw"
                  />
                </div>
                <p className="pdetail-credit">© {pattern.designer.name}</p>
              </>
            ) : (
              <div className="pdetail-media">
                <span className="pcard-media-empty">No image</span>
              </div>
            )}

            <a
              href={pattern.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ui-btn ui-btn-dark ui-btn-block pdetail-cta"
            >
              View on designer&apos;s website
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          </div>

          <div>
            <h1 className="pdetail-title">{pattern.name}</h1>
            <p className="pdetail-byline">
              by <Link href={`/designers/${pattern.designer.id}`}>{pattern.designer.name}</Link>
            </p>

            <FavoritesAndRatings patternId={pattern.id} />

            <section className="pdetail-section">
              <h2 className="pdetail-section-title">Details</h2>
              <dl className="pdetail-specs">
                <div>
                  <dt className="pdetail-spec-label">Yardage</dt>
                  <dd className="pdetail-spec-value">{specValue(pattern.yardage)}</dd>
                </div>
                <div>
                  <dt className="pdetail-spec-label">Sizes</dt>
                  <dd className="pdetail-spec-value">{specValue(pattern.sizes)}</dd>
                </div>
                <div>
                  <dt className="pdetail-spec-label">Language</dt>
                  <dd className="pdetail-spec-value">{specValue(pattern.language)}</dd>
                </div>
                <div>
                  <dt className="pdetail-spec-label">Audience</dt>
                  <dd className="pdetail-spec-value">
                    {specValue(joinNames(pattern.PatternAudience.map(({ audience }) => audience)))}
                  </dd>
                </div>
                <div>
                  <dt className="pdetail-spec-label">Fabric types</dt>
                  <dd className="pdetail-spec-value">
                    {specValue(joinNames(pattern.PatternFabricType.map(({ fabricType }) => fabricType)))}
                  </dd>
                </div>
                <div>
                  <dt className="pdetail-spec-label">Suggested fabrics</dt>
                  <dd className="pdetail-spec-value">
                    {specValue(joinNames(pattern.PatternSuggestedFabric.map(({ suggestedFabric }) => suggestedFabric)))}
                  </dd>
                </div>
              </dl>
            </section>

            {pattern.PatternCategory.length > 0 && (
              <section className="pdetail-section">
                <h2 className="pdetail-section-title">Categories</h2>
                <div className="pdetail-tags">
                  {pattern.PatternCategory.map(({ category }) => (
                    <span key={category.id} className="pdetail-tag">
                      {category.name}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {pattern.PatternAttribute.length > 0 && (
              <section className="pdetail-section">
                <h2 className="pdetail-section-title">Attributes</h2>
                <div className="pdetail-tags">
                  {pattern.PatternAttribute.map(({ attribute }) => (
                    <span key={attribute.id} className="pdetail-tag">
                      {attribute.name}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="pdetail-section">
              <h2 className="pdetail-section-title">About the designer</h2>
              <div className="pdetail-designer-card">
                <div>
                  <p className="pdetail-designer-name">{pattern.designer.name}</p>
                  <p className="pdetail-designer-note">No designer description available.</p>
                </div>
                <Link
                  href={`/designers/${pattern.designer.id}`}
                  className="ui-btn ui-btn-light pdetail-designer-link"
                >
                  View all patterns
                  <ChevronRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Suspense>
  )
}
