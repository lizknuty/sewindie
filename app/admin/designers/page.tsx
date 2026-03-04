import Link from "next/link"
import { Plus } from "lucide-react"
import prisma from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DesignerSearch } from "@/components/DesignerSearch"

interface DesignersPageProps {
  searchParams?: {
    query?: string
  }
}

export default async function DesignersPage({ searchParams }: DesignersPageProps) {
  const query = searchParams?.query || ""

  const designers = await prisma.designer.findMany({
    where: query
      ? {
          OR: [{ name: { contains: query, mode: "insensitive" } }],
        }
      : {},
    orderBy: {
      name: "asc",
    },
  })

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Designers</h1>
        <Button asChild>
          <Link href="/admin/designers/new">
            <Plus className="mr-2 h-4 w-4" />
            Add New Designer
          </Link>
        </Button>
      </div>

      <div className="mb-6">
        <DesignerSearch placeholder="Search designers..." />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Designer List</CardTitle>
        </CardHeader>
        <CardContent>
          {designers.length === 0 ? (
            <p>No designers found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Website
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {designers
