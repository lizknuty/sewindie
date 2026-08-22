import { redirect } from "next/navigation"

export default function CategoriesPage() {
  redirect("/admin/metadata?tab=categories")
}
