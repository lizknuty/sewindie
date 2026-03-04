import Link from "next/link"
import { Plus } from "lucide-react"
import prisma from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function SuggestedFabricsPage() {
  const suggestedFabrics = await prisma.suggestedFabric.findMany({
    orderBy: {
      name: "asc",
    },
  })

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Suggested Fabrics</h1>
        <Button asChild>
          <Link href="/admin/suggested-fabrics/new">
            <Plus className="mr-2 h-4 w-4" />
            Add New Suggested Fabric
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suggested Fabrics List</CardTitle>
        </CardHeader>
        <CardContent>
          {suggestedFabrics.length === 0 ? (
            <p>No suggested fabrics found.</p>
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
                  {suggestedFabrics.map((fabric) => (
                    <tr key={fabric.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{fabric.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {fabric.description || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/admin/suggested-fabrics/${fabric.id}/edit`}
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
