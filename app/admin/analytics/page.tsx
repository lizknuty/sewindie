import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { BarChart2, Star, Users } from "lucide-react"

export default function AnalyticsDashboard() {
  const analyticsSections = [
    {
      title: "Favorite Patterns",
      description: "View the most favorited patterns.",
      icon: <Star className="h-6 w-6 text-yellow-500" />,
      href: "/admin/analytics/favorites",
    },
    {
      title: "User Ratings",
      description: "Analyze user ratings distribution.",
      icon: <BarChart2 className="h-6 w-6 text-blue-500" />,
      href: "/admin/analytics/ratings",
    },
    {
      title: "User Growth",
      description: "Track new user registrations over time.",
      icon: <Users className="h-6 w-6 text-green-500" />,
      href: "/admin/analytics/users", // Assuming a future page for user growth
    },
  ]

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {analyticsSections.map((section) => (
          <Link key={section.title} href={section.href}>
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">{section.title}</CardTitle>
                {section.icon}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">{section.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
