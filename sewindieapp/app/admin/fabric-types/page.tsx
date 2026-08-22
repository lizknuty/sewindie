import { redirect } from "next/navigation"

export default function FabricTypesPage() {
  redirect("/admin/metadata?tab=fabric-types")
}
