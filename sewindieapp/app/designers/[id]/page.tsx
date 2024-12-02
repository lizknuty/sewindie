import Link from 'next/link'
import Image from 'next/image'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PatternCard from '@/components/PatternCard'
import PaginationControls from '@/components/PaginationControls'

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
  PatternCategory: {
    category: {
      id: number;
      name: string;
    }
  }[];
}

type Designer = {
  id: number;
  name: string;
  logo_url: string | null;
  url: string;
  email: string | null;
  address: string | null;
  facebook: string | null;
  instagram: string | null;
  pinterest: string | null;
  youtube: string | null;
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const ITEMS_PER_PAGE = 12

export default async function DesignerPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const page = Number(resolvedSearchParams.page) || 1
  const designerId = parseInt(id)

  if (isNaN(designerId)) {
    notFound()
  }

  const designer: Designer | null = await prisma.designer.findUnique({
    where: { id: designerId },
  })

  if (!designer) {
    notFound()
  }

  const totalPatterns = await prisma.pattern.count({
    where: { designer_id: designerId },
  })

  const patterns: Pattern[] = await prisma.pattern.findMany({
    where: { designer_id: designerId },
    include: {
      designer: {
        select: { id: true, name: true }
      },
      PatternCategory: {
        include: {
          category: true,
        },
      },
    },
    skip: (page - 1) * ITEMS_PER_PAGE,
    take: ITEMS_PER_PAGE,
  })

  const totalPages = Math.ceil(totalPatterns / ITEMS_PER_PAGE)

  return (
    <div className="container py-5">
      <div className="row mb-5">
        <div className="col-md-8">
          <h1 className="display-4 fw-bold mb-4">{designer.name}</h1>
          <p className="lead mb-4">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>
          <div className="d-flex gap-3 mb-4">
            {designer.facebook && (
              <a href={designer.facebook} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                <Image src="/facebook.svg" alt="Facebook" width={24} height={24} className="social-icon" />
              </a>
            )}
            {designer.instagram && (
              <a href={designer.instagram} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                <Image src="/instagram.svg" alt="Instagram" width={24} height={24} className="social-icon" />
              </a>
            )}
            {designer.pinterest && (
              <a href={designer.pinterest} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                <Image src="/pinterest.svg" alt="Pinterest" width={24} height={24} className="social-icon" />
              </a>
            )}
            {designer.youtube && (
              <a href={designer.youtube} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                <Image src="/youtube.svg" alt="YouTube" width={24} height={24} className="social-icon" />
              </a>
            )}
          </div>
          {designer.address && (
            <p className="mb-2"><strong>Address:</strong> {designer.address}</p>
          )}
          {designer.email && (
            <div className="d-flex align-items-center">
              <Image src="/email.svg" alt="Email" width={24} height={24} className="social-icon me-2" />
              <a href={`mailto:${designer.email}`} className="text-decoration-none">{designer.email}</a>
            </div>
          )}
        </div>
        <div className="col-md-4 d-flex justify-content-center align-items-start">
          {designer.logo_url && (
            <a href={designer.url} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
              <Image src={designer.logo_url} alt={`${designer.name} logo`} width={200} height={200} className="img-fluid" />
            </a>
          )}
        </div>
      </div>

      <h2 className="h3 fw-bold mb-4">Patterns</h2>
      <div className="row row-cols-1 row-cols-md-2 row-cols-lg-4 g-4 mb-5">
        {patterns.map((pattern) => (
          <div key={pattern.id} className="col">
            <PatternCard
              id={pattern.id}
              name={pattern.name}
              thumbnail_url={pattern.thumbnail_url}
              designer={pattern.designer}
              patternCategories={pattern.PatternCategory}
            />
          </div>
        ))}
      </div>

      <PaginationControls
        currentPage={page}
        totalPages={totalPages}
        basePath={`/designers/${designerId}`}
        perPage={ITEMS_PER_PAGE}
        totalItems={totalPatterns}
      />
    </div>
  )
}