import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Users, Shirt, Palette, BookOpen, Ruler, Star, BarChart2, FileText } from "lucide-react"

export default function AdminDashboard() {
  const adminSections = [
    {
      title: "Users",
      description: "Manage user accounts and roles.",
      icon: <Users className="h-6 w-6 text-blue-500" />,
      href: "/admin/users",
    },
    {
      title: "Patterns",
      description: "Manage sewing patterns.",
      icon: <Shirt className="h-6 w-6 text-green-500" />,
      href: "/admin/patterns",
    },
    {
      title: "Designers",
      description: "Manage pattern designers.",
      icon: <Palette className="h-6 w-6 text-purple-500" />,
      href: "/admin/designers",
    },
    {
      title: "Categories",
      description: "Manage pattern categories.",
      icon: <BookOpen className="h-6 w-6 text-red-500" />,
      href: "/admin/categories",
    },
    {
      title: "Audiences",
      description: "Manage target audiences for patterns.",
      icon: <Users className="h-6 w-6 text-yellow-500" />,
      href: "/admin/audiences",
    },
    {
      title: "Fabric Types",
      description: "Manage fabric types.",
      icon: <FileText className="h-6 w-6 text-indigo-500" />,
      href: "/admin/fabric-types",
    },
    {
      title: "Formats",
      description: "Manage pattern formats (e.g., PDF, paper).",
      icon: <Ruler className="h-6 w-6 text-pink-500" />,
      href: "/admin/formats",
    },
    {
      title: "Suggested Fabrics",
      description: "Manage suggested fabrics for patterns.",
      icon: <FileText className="h-6 w-6 text-teal-500" />,
      href: "/admin/suggested-fabrics",
    },
    {
      title: "Attributes",
      description: "Manage pattern attributes (e.g., skill level, season).",
      icon: <Star className="h-6 w-6 text-orange-500" />,
      href: "/admin/attributes",
    },
    {
      title: "Size Charts",
      description: "Manage designer size charts.",
      icon: <Ruler className="h-6 w-6 text-cyan-500" />,
      href: "/admin/size-charts",
    },
    {
      title: "Ratings",
      description: "Review and manage user ratings.",
      icon: <Star className="h-6 w-6 text-lime-500" />,
      href: "/admin/ratings",
    },
    {
      title: "Analytics",
      description: "View application analytics.",
      icon: <BarChart2 className="h-6 w-6 text-purple-500" />,
      href: "/admin/analytics",
    },
  ]

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminSections.map((section) => (
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
