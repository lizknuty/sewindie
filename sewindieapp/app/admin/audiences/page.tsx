import { redirect } from "next/navigation"

export default function AudiencesPage() {
  redirect("/admin/metadata?tab=audiences")
}
