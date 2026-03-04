import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import ContributionsTable from "@/app/admin/contributions/components/ContributionsTable"
import prisma from "@/lib/prisma"

export default async function ContributionsPage() {
  const contributions = await prisma.contribution.findMany({
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      pattern: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Contributions</h1>
      <Card>
        <CardHeader>
          <CardTitle>Pending Contributions</CardTitle>
        </CardHeader>
        <CardContent>
          <ContributionsTable contributions={contributions} />
        </CardContent>
      </Card>
    </div>
  )
}
