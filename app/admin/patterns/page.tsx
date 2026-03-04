import Link from "next/link"
import { Plus } from "lucide-react"
import prisma from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PatternSearch } from "@/components/PatternSearch"
import { PatternFilters } from "@/app/components/PatternFilters"
import { PatternSorter } from "@/app/components/PatternSorter"

interface PatternsPageProps {
  searchParams?: {
    query?: string
    designer?: string
    category?: string
    audience?: string
    fabricType?: string
    format?: string
    difficulty?: string
    sortBy?: string
    sortOrder?: "asc" | "desc"
  }
}

export default async function PatternsPage({ searchParams }: PatternsPageProps) {
  const query = searchParams?.query || ""
  const designerFilter = searchParams?.designer ? Number(searchParams.designer) : undefined
  const categoryFilter = searchParams?.category ? Number(searchParams.category) : undefined
  const audienceFilter = searchParams?.audience ? Number(searchParams.audience) : undefined
  const fabricTypeFilter = searchParams?.fabricType ? Number(searchParams.fabricType) : undefined
  const formatFilter = searchParams?.format ? Number(searchParams.format) : undefined
  const difficultyFilter = searchParams?.difficulty || undefined
  const sortBy = searchParams?.sortBy || "name"
  const sortOrder = searchParams?.sortOrder || "asc"

  const patterns = await prisma.pattern.findMany({
    where: {
      AND: [
        query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { designer: { name: { contains: query, mode: "insensitive" } } },
              ],
            }
          : {},
        designerFilter ? { designerId: designerFilter } : {},
        categoryFilter ? { categoryIds: { has: categoryFilter } } : {},
        audienceFilter ? { audienceId: audienceFilter } : {},
        fabricTypeFilter ? { fabricTypeId: fabricTypeFilter } : {},
        formatFilter ? { formatId: formatFilter } : {},
        difficultyFilter ? { difficulty_level: difficultyFilter } : {},
      ],
    },
    include: {
      designer: {
        select: { name: true },
      },
      categories: {
        select: { name: true },
      },
      audience: {
        select: { name: true },
      },
      fabricType: {
        select: { name: true },
      },
      format: {
        select: { name: true },
      },
    },
    orderBy: {
      [sortBy]: sortOrder,
    },
  })

  const designers = await prisma.designer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
  const categories = await prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
  const audiences = await prisma.audience.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
  const fabricTypes = await prisma.fabricType.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
  const formats = await prisma.format.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })

  const difficultyLevels = [
    { label: "Beginner", value: "Beginner" },
    { label: "Easy", value: "Easy" },
    { label: "Intermediate", value: "Intermediate" },
    { label: "Advanced", value: "Advanced" },
  ]

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Patterns</h1>
        <Button asChild>
          <Link href="/admin/patterns/new">
            <Plus className="mr-2 h-4 w-4" />
            Add New Pattern
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <PatternSearch placeholder="Search patterns or designers..." />
        <PatternFilters
          designers={designers}
          categories={categories}
          audiences={audiences}
          fabricTypes={fabricTypes}
          formats={formats}
          difficultyLevels={difficultyLevels}
        />
        <PatternSorter />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pattern List</CardTitle>
        </CardHeader>
        <CardContent>
          {patterns.length === 0 ? (
            <p>No patterns found matching your criteria.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Designer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Difficulty
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Format
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Audience
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categories
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {patterns.map((pattern) => (
                    <tr key={pattern.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{pattern.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pattern.designer.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {pattern.difficulty_level || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {pattern.format?.name || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {pattern.audience?.name || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {pattern.categories.map((cat) => cat.name).join(", ") || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/admin/patterns/${pattern.id}/edit`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
