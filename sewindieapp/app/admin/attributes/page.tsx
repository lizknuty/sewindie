import { redirect } from "next/navigation"

export default function AttributesPage() {
  redirect("/admin/metadata?tab=attributes")
}
