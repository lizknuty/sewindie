import SizeChartForm from "../components/SizeChartForm"
import prisma from "@/lib/prisma"

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
    <div>
      <h1 className="mb-4">Create New Size Chart</h1>
      <SizeChartForm designers={designers} />
    </div>
  )
}
