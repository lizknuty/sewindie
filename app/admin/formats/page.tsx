import Link from "next/link"
import { Plus } from "lucide-react"
import prisma from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function FormatsPage() {
  const formats = await prisma.format.findMany({
    orderBy: {
      name: "asc",
    },
  })

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Formats</h1>
        <Button asChild>
          <Link href="/admin/formats/new">
            <Plus className="mr-2 h-4 w-4" />
            Add New Format
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Formats List</CardTitle>
        </CardHeader>
        <CardContent>
          {formats.length === 0 ? (
            <p>No formats found.</p>
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {formats.map((format) => (
                    <tr key={format.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{format.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format.description || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/admin/formats/${format.id}/edit`}
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
