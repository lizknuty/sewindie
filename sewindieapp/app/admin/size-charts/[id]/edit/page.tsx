import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import SizeChartForm from "@/admin/size-charts/components/SizeChartForm"
import type { Decimal } from "@prisma/client/runtime/library"

// Define types that match Prisma's output for SizeChart and SizeChartRow
interface PrismaSizeChartRow {
  id?: number
  size_chart_id?: number
  size_label: string
  upper_bust_min: Decimal | null
  upper_bust_max: Decimal | null
  full_bust_min: Decimal | null
  full_bust_max: Decimal | null
  chest_min: Decimal | null
  chest_max: Decimal | null
  under_bust_min: Decimal | null
  under_bust_max: Decimal | null
  waist_min: Decimal | null
  waist_max: Decimal | null
  preferred_waist_min: Decimal | null
  preferred_waist_max: Decimal | null
  side_waist_length_min: Decimal | null
  side_waist_length_max: Decimal | null
  waist_to_hip_length_min: Decimal | null
  waist_to_hip_length_max: Decimal | null
  high_hip_min: Decimal | null
  high_hip_max: Decimal | null
  hip_min: Decimal | null
  hip_max: Decimal | null
  thigh_min: Decimal | null
  thigh_max: Decimal | null
  calf_min: Decimal | null
  calf_max: Decimal | null
  inseam_min: Decimal | null
  inseam_max: Decimal | null
  crotch_length_min: Decimal | null
  crotch_length_max: Decimal | null
  arm_length_min: Decimal | null
  arm_length_max: Decimal | null
  upper_arm_min: Decimal | null
  upper_arm_max: Decimal | null
  height_min: Decimal | null
  height_max: Decimal | null
}

// New interface for serializable SizeChartRow (all measurements are strings)
interface SerializableSizeChartRow {
  id?: number
  size_label: string
  upper_bust_min: string | null
  upper_bust_max: string | null
  full_bust_min: string | null
  full_bust_max: string | null
  chest_min: string | null
  chest_max: string | null
  under_bust_min: string | null
  under_bust_max: string | null
  waist_min: string | null
  waist_max: string | null
  preferred_waist_min: string | null
  preferred_waist_max: string | null
  side_waist_length_min: string | null
  side_waist_length_max: string | null
  waist_to_hip_length_min: string | null
  waist_to_hip_length_max: string | null
  high_hip_min: string | null
  high_hip_max: string | null
  hip_min: string | null
  hip_max: string | null
  thigh_min: string | null
  thigh_max: string | null
  calf_min: string | null
  calf_max: string | null
  inseam_min: string | null
  inseam_max: string | null
  crotch_length_min: string | null
  crotch_length_max: string | null
  arm_length_min: string | null
  arm_length_max: string | null
  upper_arm_min: string | null
  upper_arm_max: string | null
  height_min: string | null
  height_max: string | null
}

// New interface for serializable SizeChart (using SerializableSizeChartRow)
interface SerializableSizeChart {
  id: number
  label: string
  designer_id: number
  measurement_unit: string
  SizeChartRow: SerializableSizeChartRow[]
  Designer?: {
    id: number
    name: string
  }
}

export default async function EditSizeChartPage({ params }: { params: Promise<{ id: string }> }) {
  // Await params before using it, following the pattern in EditDesignerPage
  const resolvedParams = await params
  const sizeChartId = Number.parseInt(resolvedParams.id, 10)

  if (isNaN(sizeChartId)) {
    notFound()
  }

  const sizeChart = await prisma.sizeChart.findUnique({
    where: {
      id: sizeChartId,
    },
    include: {
      Designer: {
        select: {
          id: true,
          name: true,
        },
      },
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

  // Convert Decimal objects to strings for passing to Client Component
  const serializableSizeChart: SerializableSizeChart = {
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
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Size Chart</h1>
      <SizeChartForm sizeChart={serializableSizeChart} designers={designers} />
    </div>
  )
}
