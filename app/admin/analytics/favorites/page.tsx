import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import prisma from "@/lib/prisma"

export default async function FavoritesAnalyticsPage() {
  const favoriteCounts = await prisma.favorite.groupBy({
    by: ["patternId"],
    _count: {
      patternId: true,
    },
    orderBy: {
      _count: {
        patternId: "desc",
      },
    },
    take: 10, // Get top 10 most favorited patterns
  })

  const patterns = await prisma.pattern.findMany({
    where: {
      id: {
        in: favoriteCounts.map((f) => f.patternId),
      },
    },
    select: {
      id: true,
      name: true,
      designer: {
        select: {
          name: true,
        },
      },
    },
  })

  const chartData = favoriteCounts.map((fav) => {
    const pattern = patterns.find((p) => p.id === fav.patternId)
    return {
      name: `${pattern?.name || "Unknown"} by ${pattern?.designer?.name || "N/A"}`,
      favorites: fav._count.patternId,
    }
  })

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Favorite Patterns Analytics</h1>
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Most Favorited Patterns</CardTitle>
          <CardDescription>Number of times each pattern has been favorited.</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p>No favorite data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={chartData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="favorites" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
