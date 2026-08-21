import { redirect } from "next/navigation"

export default function SizeChartsPage() {
  redirect("/admin/metadata?tab=size-charts")
}
