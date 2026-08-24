import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import SizeChartForm from "../components/SizeChartForm"
import { prisma } from "@/lib/prisma"

export default async function NewSizeChartPage() {
  const designers = await prisma.designer.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  })

  return (
    <div className="admin-form-page">
      <header className="admin-form-header">
        <Link href="/admin/size-charts" className="admin-form-back">
          <ArrowLeft size={15} />
          Back to Size Charts
        </Link>
        <h1 className="admin-form-title">Create Size Chart</h1>
        <p className="admin-form-subtitle">Define the sizes and body measurements for a designer&apos;s chart.</p>
      </header>
      <SizeChartForm designers={designers} />
    </div>
  )
}
