import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import prisma from '@/lib/prisma'
import PaginationControls from '@/components/PaginationControls'

type Designer = {
  id: number
  name: string
  logo_url: string | null
  website: string | null
  patterns: {
    id: number
    name: string
    thumbnail_url: string | null
  }[]
}

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function DesignerPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const designerId = parseInt(id, 10)
  const page = parseInt(searchParams.page as string || '1', 10)
  const perPage = 20

  if (isNaN(designerId)) {
    notFound()
  }

  const designer = await prisma.designer.findUnique({
    where: { id: designerId },
    include: {
      patterns: {
        select: {
          id: true,
          name: true,
          thumbnail_url: true,
        },
        skip: (page - 1) * perPage,
        take: perPage,
      },
    },
  }) as Designer | null

  if (!designer) {
    notFound()
  }

  const totalPatterns = await prisma.pattern.count({
    where: { designer_id: designerId },
  })

  const totalPages = Math.ceil(totalPatterns / perPage)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        {designer.logo_url && (
          <Image
            src={designer.logo_url}
            alt={`${designer.name} logo`}
            width={200}
            height={200}
            className="mx-auto mb-4 rounded-full"
          />
        )}
        <h1 className="text-4xl font-bold mb-2">{designer.name}</h1>
        {designer.website && (
          <a href={designer.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
            Visit Website
          </a>
        )}
      </div>

      <h2 className="text-2xl font-semibold mb-4">Patterns by {designer.name}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {designer.patterns.map((pattern) => (
          <Link href={`/patterns/${pattern.id}`} key={pattern.id} className="block">
            <div className="border rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
              {pattern.thumbnail_url ? (
                <Image
                  src={pattern.thumbnail_url}
                  alt={pattern.name}
                  width={300}
                  height={400}
                  className="w-full h-64 object-cover"
                />
              ) : (
                <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500">No image available</span>
                </div>
              )}
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-2">{pattern.name}</h3>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <PaginationControls
          currentPage={page}
          totalPages={totalPages}
          basePath={`/designers/${designerId}`}
          perPage={perPage}
          totalItems={totalPatterns}
        />
      </div>
    </div>
  )
}