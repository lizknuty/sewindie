import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/options"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { redirect } from "next/navigation"

export default async function MyAccountPage() {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    redirect("/login")
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">My Account</h1>
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" type="text" value={session.user.name || "N/A"} readOnly />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={session.user.email || "N/A"} readOnly />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Input id="role" type="text" value={session.user.role || "N/A"} readOnly />
          </div>
          <div className="flex flex-col space-y-2">
            <Button asChild>
              <Link href="/my-account/change-password">Change Password</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/my-account/favorites">View Favorites</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/my-account/ratings">View My Ratings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
