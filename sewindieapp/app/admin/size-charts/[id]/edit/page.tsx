import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import SizeChartForm from "@/admin/size-charts/components/SizeChartForm"

type PageProps = {
  params: { id: string }
}

export default async function EditSizeChartPage({ params }: PageProps) {
  const sizeChartId = Number.parseInt(params.id, 10)

  if (isNaN(sizeChartId)) {
    notFound()
  }

  const sizeChart = await prisma.sizeChart.findUnique({
    where: { id: sizeChartId },
    include: {
      SizeChartRow: {
        orderBy: {
          id: "asc",
        },
      },
    },
  })

  if (!sizeChart) {
    notFound()
  }

  const designers = await prisma.designer.findMany({
    orderBy: {
      name: "asc",
    },
  })

  // Convert Decimal values to string for client component serialization
  const serializableSizeChart = {
    ...sizeChart,
    SizeChartRow: sizeChart.SizeChartRow.map((row) => ({
      ...row,
      upper_bust_min: row.upper_bust_min?.toString() || null,
      upper_bust_max: row.upper_bust_max?.toString() || null,
      full_bust_min: row.full_bust_min?.toString() || null,
      full_bust_max: row.full_bust_max?.toString() || null,
      chest_min: row.chest_min?.toString() || null,
      chest_max: row.chest_max?.toString() || null,
      under_bust_min: row.under_bust_min?.toString() || null,
      under_bust_max: row.under_bust_max?.toString() || null,
      waist_min: row.waist_min?.toString() || null,
      waist_max: row.waist_max?.toString() || null,
      preferred_waist_min: row.preferred_waist_min?.toString() || null,
      preferred_waist_max: row.preferred_waist_max?.toString() || null,
      side_waist_length_min: row.side_waist_length_min?.toString() || null,
      side_waist_length_max: row.side_waist_length_max?.toString() || null,
      waist_to_hip_length_min: row.waist_to_hip_length_min?.toString() || null,
      waist_to_hip_length_max: row.waist_to_hip_length_max?.toString() || null,
      high_hip_min: row.high_hip_min?.toString() || null,
      high_hip_max: row.high_hip_max?.toString() || null,
      hip_min: row.hip_min?.toString() || null,
      hip_max: row.hip_max?.toString() || null,
      thigh_min: row.thigh_min?.toString() || null,
      thigh_max: row.thigh_max?.toString() || null,
      calf_min: row.calf_min?.toString() || null,
      calf_max: row.calf_max?.toString() || null,
      inseam_min: row.inseam_min?.toString() || null,
      inseam_max: row.inseam_max?.toString() || null,
      crotch_length_min: row.crotch_length_min?.toString() || null,
      crotch_length_max: row.crotch_length_max?.toString() || null,
      arm_length_min: row.arm_length_min?.toString() || null,
      arm_length_max: row.arm_length_max?.toString() || null,
      upper_arm_min: row.upper_arm_min?.toString() || null,
      upper_arm_max: row.upper_arm_max?.toString() || null,
      height_min: row.height_min?.toString() || null,
      height_max: row.height_max?.toString() || null,
    })),
  }

  return (
    <div className="container my-4">
      <h1 className="mb-4">Edit Size Chart</h1>
      <SizeChartForm sizeChart={serializableSizeChart} designers={designers} />
    </div>
  )
}
