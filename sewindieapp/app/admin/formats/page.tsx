import { redirect } from "next/navigation"

export default function FormatsPage() {
  redirect("/admin/metadata?tab=formats")
}
