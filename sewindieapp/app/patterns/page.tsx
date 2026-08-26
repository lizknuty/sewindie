import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import PatternSorter from '@/components/PatternSorter'
import PatternFilters from '@/components/PatternFilters'
import PatternCard from '@/components/PatternCard'
import PaginationControls from '@/components/PaginationControls'
import BrowseHero from '@/components/BrowseHero'
import CategoryTiles from '@/components/CategoryTiles'
import ActiveFilterChips from '@/components/ActiveFilterChips'
import PatternViewToggle from '@/components/PatternViewToggle'
import PatternListRow from '@/components/PatternListRow'
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
  // Already fetched for the filter joins; the list view surfaces them as
  // per-row metadata instead of leaving them unused.
  PatternFabricType: { fabricType: { id: number; name: string } }[];
  PatternAudience: { audience: { id: number; name: string } }[];
}

type ViewMode = 'grid' | 'list'

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
  // Anything other than an explicit 'list' falls back to grid, so a malformed
  // ?view= value renders the default rather than nothing.
  const view: ViewMode = resolvedSearchParams.view === 'list' ? 'list' : 'grid';

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

  // The Format checkboxes wrote to the URL but nothing consumed formatIds, so
  // the filter silently did nothing. PatternFormat mirrors the other joins.
  if (formatIds.length > 0) {
    where.PatternFormat = {
      some: {
        format_id: { in: formatIds.map(Number) }
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
      // Counts drive the quick-search tiles, so the featured categories come
      // from the data rather than a hardcoded list of ids that could rot.
      prisma.category.findMany({
        select: { id: true, name: true, _count: { select: { PatternCategory: true } } },
      }),
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

    // Flatten the relation count once so the client components don't have to
    // know about Prisma's _count shape.
    const categoryOptions = categories.map((c) => ({
      id: c.id,
      name: c.name,
      count: c._count.PatternCategory,
    }));

    const categoriesByName = [...categoryOptions].sort((a, b) => a.name.localeCompare(b.name));
    const popularCategories = [...categoryOptions].sort((a, b) => b.count - a.count).slice(0, 7);

    // The tiles are a discovery shortcut, so an empty category would only be a
    // dead end. The sidebar still lists every category.
    const browsableCategories = categoriesByName.filter((c) => c.count > 0);

    const filterOptionMap = {
      category: categoriesByName,
      attribute: attributes,
      format: formats,
      audience: audiences,
      fabricType: fabricTypes,
      designer: designers,
    };

    return (
      <div className="patterns-page">
        <BrowseHero
          title="Find your next sewing project."
          lede="Search thousands of independent sewing patterns."
          initialSearch={search}
          searchPlaceholder="Search patterns, designers, or keywords..."
          searchLabel="Search patterns or designers"
          searchInputId="pattern-search-input"
          imageSrc="/patterns-hero.png"
        />

        <div className="patterns-shell">
          <CategoryTiles popular={popularCategories} all={browsableCategories} />

          <ActiveFilterChips options={filterOptionMap} />

          <div className="patterns-body">
            <div className="patterns-filters">
              <PatternFilters
                categories={categoriesByName}
                attributes={attributes}
                formats={formats}
                audiences={audiences}
                fabricTypes={fabricTypes}
                designers={designers}
              />
            </div>

            <div className="patterns-results">
              <div className="patterns-toolbar">
                <p className="patterns-count">
                  {totalPatterns.toLocaleString()} {totalPatterns === 1 ? 'pattern' : 'patterns'}
                </p>
                <div className="patterns-toolbar-controls">
                  <PatternSorter />
                  <PatternViewToggle view={view} />
                </div>
              </div>

              {patterns.length === 0 ? (
                <div className="patterns-empty">
                  <p className="patterns-empty-title">No patterns match these filters</p>
                  <p className="patterns-empty-text">
                    Try clearing a filter or searching for a different designer or pattern name.
                  </p>
                </div>
              ) : (
                <>
                  {view === 'list' ? (
                    <div className="prow-list">
                      {patterns.map((pattern: Pattern) => (
                        <PatternListRow
                          key={pattern.id}
                          id={pattern.id}
                          name={pattern.name}
                          thumbnail_url={pattern.thumbnail_url}
                          designer={pattern.designer}
                          categories={pattern.PatternCategory.map((pc) => pc.category)}
                          fabricTypes={pattern.PatternFabricType.map((pf) => pf.fabricType)}
                          audiences={pattern.PatternAudience.map((pa) => pa.audience)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="pcard-grid">
                      {patterns.map((pattern: Pattern) => (
                        <PatternCard
                          key={pattern.id}
                          id={pattern.id}
                          name={pattern.name}
                          thumbnail_url={pattern.thumbnail_url}
                          designer={pattern.designer}
                          patternCategories={pattern.PatternCategory}
                        />
                      ))}
                    </div>
                  )}

                  <div className="patterns-pager-row">
                    <PaginationControls
                      currentPage={page}
                      totalPages={totalPages}
                      perPage={perPage}
                      totalItems={totalPatterns}
                      basePath="/patterns"
                    />
                  </div>
                </>
              )}
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
