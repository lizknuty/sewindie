import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import prisma from '@/lib/prisma'
import PatternSorter from '../components/PatternSorter'
import PatternFilters from '../components/PatternFilters'
import PatternSearch from '../components/PatternSearch'
import PatternCard from '../components/PatternCard'
import PaginationControls from '@/components/PaginationControls'
import { Metadata } from 'next'

type Pattern = {
  id: number;
  name: string;
  thumbnail_url: string | null;
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

type FilterOption = {
  id: number;
  name: string;
}

type SortOption = 'name_asc' | 'name_desc' | 'designer_asc' | 'designer_desc'

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PatternsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;

  const search = typeof resolvedSearchParams.search === 'string' ? resolvedSearchParams.search : '';
  const sort = (resolvedSearchParams.sort as SortOption) || 'name_asc';
  const page = parseInt(typeof resolvedSearchParams.page === 'string' ? resolvedSearchParams.page : '1', 10);
  const perPage = parseInt(typeof resolvedSearchParams.perPage === 'string' ? resolvedSearchParams.perPage : '40', 10);

  const ensureArray = (value: string | string[] | undefined): string[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return [];
  };

  const categoryIds = ensureArray(resolvedSearchParams.category);
  const attributeIds = ensureArray(resolvedSearchParams.attribute);
  const formatIds = ensureArray(resolvedSearchParams.format);
  const audienceIds = ensureArray(resolvedSearchParams.audience);
  const fabricTypeIds = ensureArray(resolvedSearchParams.fabricType);
  const designerIds = ensureArray(resolvedSearchParams.designer);

  let orderBy: { [key: string]: 'asc' | 'desc' } | { designer: { name: 'asc' | 'desc' } } = { name: 'asc' }

  switch (sort) {
    case 'name_desc':
      orderBy = { name: 'desc' }
      break
    case 'designer_asc':
      orderBy = { designer: { name: 'asc' } }
      break
    case 'designer_desc':
      orderBy = { designer: { name: 'desc' } }
      break
    default:
      orderBy = { name: 'asc' }
  }

  const where: any = {}

  if (categoryIds.length > 0) {
    where.PatternCategory = {
      some: {
        category_id: { in: categoryIds.map(Number) }
      }
    }
  }

  if (attributeIds.length > 0) {
    where.PatternAttribute = {
      some: {
        attribute_id: { in: attributeIds.map(Number) }
      }
    }
  }

  if (audienceIds.length > 0) {
    where.PatternAudience = {
      some: {
        audience_id: { in: audienceIds.map(Number) }
      }
    }
  }

  if (fabricTypeIds.length > 0) {
    where.PatternFabricType = {
      some: {
        fabrictype_id: { in: fabricTypeIds.map(Number) }
      }
    }
  }

  if (designerIds.length > 0) {
    where.designer_id = { in: designerIds.map(Number) }
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { designer: { name: { contains: search, mode: 'insensitive' } } },
    ]
  }

  try {
    console.log('Fetching data from database...');
    const [patterns, categories, attributes, formats, audiences, fabricTypes, designers, totalPatterns] = await Promise.all([
      prisma.pattern.findMany({
        where,
        orderBy,
        include: {
          designer: {
            select: { id: true, name: true }
          },
          PatternCategory: {
            include: {
              category: true
            }
          },
          PatternAttribute: {
            include: {
              attribute: true
            }
          },
          PatternAudience: {
            include: {
              audience: true
            }
          },
          PatternFabricType: {
            include: {
              fabricType: true
            }
          }
        },
        skip: (page - 1) * perPage,
        take: perPage === -1 ? undefined : perPage,
      }),
      prisma.category.findMany({ select: { id: true, name: true } }),
      prisma.attribute.findMany({ select: { id: true, name: true } }),
      prisma.format.findMany({ select: { id: true, name: true } }),
      prisma.audience.findMany({ select: { id: true, name: true } }),
      prisma.fabricType.findMany({ select: { id: true, name: true } }),
      prisma.designer.findMany({ select: { id: true, name: true } }),
      prisma.pattern.count({ where })
    ]);

    console.log(`Fetched ${patterns.length} patterns`);
    console.log(`Total patterns: ${totalPatterns}`);

    const totalPages = perPage === -1 ? 1 : Math.ceil(totalPatterns / perPage);

    return (
      <div className="container-fluid mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Patterns</h1>
        <PatternSearch initialSearch={search} />
        <div className="row">
          <div className="col-md-3">
            <PatternFilters
              categories={categories}
              attributes={attributes}
              formats={formats}
              audiences={audiences}
              fabricTypes={fabricTypes}
              designers={designers}
            />
          </div>
          <div className="col-md-9">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <PatternSorter />
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                perPage={perPage}
                totalItems={totalPatterns}
                basePath="/patterns"
              />
            </div>
            <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-4">
              {patterns.map((pattern: Pattern) => (
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
            <div className="mt-4">
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                perPage={perPage}
                totalItems={totalPatterns}
                basePath="/patterns"
              />
            </div>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error in PatternsPage:', error);
    return <div>An error occurred while loading the patterns. Please try again later.</div>;
  }
}

export const metadata: Metadata = {
  title: 'Patterns | SewIndie',
  description: 'Browse and filter sewing patterns',
}