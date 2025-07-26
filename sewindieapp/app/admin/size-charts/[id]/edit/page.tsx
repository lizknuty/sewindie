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
  waist_min: Decimal | null
  waist_max: Decimal | null
  hip_min: Decimal | null
  hip_max: Decimal | null
  inseam_min: Decimal | null
  inseam_max: Decimal | null
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
  waist_min: string | null
  waist_max: string | null
  hip_min: string | null
  hip_max: string | null
  inseam_min: string | null
  inseam_max: string | null
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

export default async function EditSizeChartPage({ params }: { params: { id: string } }) {
  // Await params to ensure it's resolved before accessing properties
  const awaitedParams = await params
  const sizeChartId = Number.parseInt(awaitedParams.id, 10)

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
    // Use the new serializable type here
    ...sizeChart,
    SizeChartRow: sizeChart.SizeChartRow.map((row) => ({
      ...row,
      upper_bust_min: row.upper_bust_min?.toString() || null,
      upper_bust_max: row.upper_bust_max?.toString() || null,
      full_bust_min: row.full_bust_min?.toString() || null,
      full_bust_max: row.full_bust_max?.toString() || null,
      chest_min: row.chest_min?.toString() || null,
      chest_max: row.chest_max?.toString() || null,
      waist_min: row.waist_min?.toString() || null,
      waist_max: row.waist_max?.toString() || null,
      hip_min: row.hip_min?.toString() || null,
      hip_max: row.hip_max?.toString() || null,
      inseam_min: row.inseam_min?.toString() || null,
      inseam_max: row.inseam_max?.toString() || null,
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
