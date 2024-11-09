import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import prisma from '@/lib/prisma'
import PatternSorter from '../components/PatternSorter'
import PatternFilters from '../components/PatternFilters'
import PatternSearch from '../components/PatternSearch'
import { Metadata } from 'next'
import { ReadonlyURLSearchParams } from 'next/navigation'

type Pattern = {
  id: number;
  name: string;
  thumbnail_url: string | null;
  designer: {
    id: number;
    name: string;
  };
  audience: string | null;
  fabric_type: string | null;
}

type FilterOption = {
  id: number;
  name: string;
}

type SortOption = 'name_asc' | 'name_desc' | 'designer_asc' | 'designer_desc'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PatternsPage({ searchParams: rawSearchParams }: PageProps) {
  const searchParams = await rawSearchParams;
  const search = searchParams?.search ?? '';
  const sort = (searchParams?.sort as SortOption) ?? 'name_asc';

  const ensureArray = (value: string | string[] | undefined): string[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return [];
  };

  const categoryIds = ensureArray(searchParams?.category);
  const attributeIds = ensureArray(searchParams?.attribute);
  const formatIds = ensureArray(searchParams?.format);
  const audienceFilters = ensureArray(searchParams?.audience);
  const fabricTypeFilters = ensureArray(searchParams?.fabricType);
  const designerIds = ensureArray(searchParams?.designer);

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
    where.categories = {
      some: {
        id: { in: categoryIds.map(Number) }
      }
    }
  }

  if (attributeIds.length > 0) {
    where.attributes = {
      some: {
        id: { in: attributeIds.map(Number) }
      }
    }
  }

  if (formatIds.length > 0) {
    where.formats = {
      some: {
        id: { in: formatIds.map(Number) }
      }
    }
  }

  if (audienceFilters.length > 0) {
    where.audience = { in: audienceFilters }
  }

  if (fabricTypeFilters.length > 0) {
    where.fabric_type = { in: fabricTypeFilters }
  }

  if (designerIds.length > 0) {
    where.designer = {
      id: { in: designerIds.map(Number) }
    }
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { designer: { name: { contains: search, mode: 'insensitive' } } },
    ]
  }

  try {
    const [patterns, categories, attributes, formats, uniqueAudiences, uniqueFabricTypes, designers] = await Promise.all([
      prisma.pattern.findMany({
        where,
        orderBy,
        include: {
          designer: {
            select: { id: true, name: true }
          }
        }
      }),
      prisma.category.findMany({ select: { id: true, name: true } }),
      prisma.attribute.findMany({ select: { id: true, name: true } }),
      prisma.format.findMany({ select: { id: true, name: true } }),
      prisma.pattern.findMany({
        select: { audience: true },
        distinct: ['audience'],
        where: { audience: { not: null } }
      }),
      prisma.pattern.findMany({
        select: { fabric_type: true },
        distinct: ['fabric_type'],
        where: { fabric_type: { not: null } }
      }),
      prisma.designer.findMany({ select: { id: true, name: true } })
    ]);

    const audiences = uniqueAudiences.map(a => a.audience).filter((a): a is string => a !== null)
    const fabricTypes = uniqueFabricTypes.map(f => f.fabric_type).filter((f): f is string => f !== null)

    return (
      <div className="container-fluid mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Patterns</h1>
        <PatternSearch initialSearch={Array.isArray(search) ? search[0] || '' : search} />
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
              {patterns.map((pattern) => (
                <div key={pattern.id} className="col">
                  <div className="card h-100 bg-white">
                    <div className="card-body d-flex flex-column">
                      <div className="mb-3" style={{ width: '150px', height: '150px', position: 'relative', margin: '0 auto' }}>
                        {pattern.thumbnail_url ? (
                          <Image
                            src={pattern.thumbnail_url}
                            alt={`${pattern.name} thumbnail`}
                            fill
                            sizes="150px"
                            style={{ objectFit: 'contain' }}
                          />
                        ) : (
                          <div className="w-100 h-100 bg-light d-flex justify-content-center align-items-center">
                            <span className="text-muted fs-6">No image</span>
                          </div>
                        )}
                      </div>
                      <h2 className="card-title h5 text-center mb-2">
                        <Link href={`/patterns/${pattern.id}`} className="text-decoration-none">
                          {pattern.name}
                        </Link>
                      </h2>
                      <p className="card-text text-center mt-auto">
                        <Link href={`/designers/${pattern.designer.id}`} className="text-muted text-decoration-none">
                          {pattern.designer.name}
                        </Link>
                      </p>
                    </div>
                  </div>
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