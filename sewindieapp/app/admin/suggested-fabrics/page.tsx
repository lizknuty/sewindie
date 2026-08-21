import { redirect } from "next/navigation"

export default function SuggestedFabricsPage() {
  redirect("/admin/metadata?tab=suggested-fabrics")
}
