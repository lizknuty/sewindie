import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import prisma from '@/lib/prisma'
import PatternSorter from '../components/PatternSorter'
import PatternFilters from '../components/PatternFilters'
import PatternSearch from '../components/PatternSearch'
import PatternCard from '../components/PatternCard'
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

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function PatternsPage({ searchParams }: PageProps) {
  const search = searchParams.search as string ?? '';
  const sort = (searchParams.sort as SortOption) ?? 'name_asc';

  const ensureArray = (value: string | string[] | undefined): string[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return [];
  };

  const categoryIds = ensureArray(searchParams.category);
  const attributeIds = ensureArray(searchParams.attribute);
  const formatIds = ensureArray(searchParams.format);
  const audienceIds = ensureArray(searchParams.audience);
  const fabricTypeIds = ensureArray(searchParams.fabricType);
  const designerIds = ensureArray(searchParams.designer);

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
    const [patterns, categories, attributes, formats, audiences, fabricTypes, designers] = await Promise.all([
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
        }
      }),
      prisma.category.findMany({ select: { id: true, name: true } }),
      prisma.attribute.findMany({ select: { id: true, name: true } }),
      prisma.format.findMany({ select: { id: true, name: true } }),
      prisma.audience.findMany({ select: { id: true, name: true } }),
      prisma.fabricType.findMany({ select: { id: true, name: true } }),
      prisma.designer.findMany({ select: { id: true, name: true } })
    ]);

    console.log(`Fetched ${patterns.length} patterns`);
    console.log(`Fetched ${designers.length} designers`);

    if (patterns.length === 0) {
      console.log('No patterns found. Database query result:', patterns);
    }

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
            <PatternSorter />
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