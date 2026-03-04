import { PrismaClient } from "@prisma/client"
import { notFound } from "next/navigation"
import SizeChartForm from "../../components/SizeChartForm"

const prisma = new PrismaClient()

// Helper function to convert Decimal to string for serialization
function toDecimal(value: any): string | null {
  if (value === null || value === undefined) {
    return null
  }
  return value.toString()
}

export default async function EditSizeChartPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  try {
    // Fetch the size chart with its rows and designer
    const sizeChart = await prisma.sizeChart.findUnique({
      where: { id: Number.parseInt(id) },
      include: {
        SizeChartRow: true,
        Designer: true,
      },
    })

    if (!sizeChart) {
      notFound()
    }

    // Fetch all designers for the dropdown
    const designers = await prisma.designer.findMany({
      orderBy: { name: "asc" },
    })

    // Convert the size chart data to be serializable
    const serializableSizeChart = {
      id: sizeChart.id,
      label: sizeChart.label,
      designer_id: sizeChart.designer_id,
      measurement_unit: sizeChart.measurement_unit,
      SizeChartRow: sizeChart.SizeChartRow.map((row) => ({
        id: row.id,
        size_label: row.size_label,
        upper_bust_min: toDecimal(row.upper_bust_min),
        upper_bust_max: toDecimal(row.upper_bust_max),
        full_bust_min: toDecimal(row.full_bust_min),
        full_bust_max: toDecimal(row.full_bust_max),
        chest_min: toDecimal(row.chest_min),
        chest_max: toDecimal(row.chest_max),
        under_bust_min: toDecimal(row.under_bust_min),
        under_bust_max: toDecimal(row.under_bust_max),
        waist_min: toDecimal(row.waist_min),
        waist_max: toDecimal(row.waist_max),
        preferred_waist_min: toDecimal(row.preferred_waist_min),
        preferred_waist_max: toDecimal(row.preferred_waist_max),
        side_waist_length_min: toDecimal(row.side_waist_length_min),
        side_waist_length_max: toDecimal(row.side_waist_length_max),
        waist_to_hip_length_min: toDecimal(row.waist_to_hip_length_min),
        waist_to_hip_length_max: toDecimal(row.waist_to_hip_length_max),
        high_hip_min: toDecimal(row.high_hip_min),
        high_hip_max: toDecimal(row.high_hip_max),
        hip_min: toDecimal(row.hip_min),
        hip_max: toDecimal(row.hip_max),
        thigh_min: toDecimal(row.thigh_min),
        thigh_max: toDecimal(row.thigh_max),
        calf_min: toDecimal(row.calf_min),
        calf_max: toDecimal(row.calf_max),
        inseam_min: toDecimal(row.inseam_min),
        inseam_max: toDecimal(row.inseam_max),
        crotch_length_min: toDecimal(row.crotch_length_min),
        crotch_length_max: toDecimal(row.crotch_length_max),
        arm_length_min: toDecimal(row.arm_length_min),
        arm_length_max: toDecimal(row.arm_length_max),
        upper_arm_min: toDecimal(row.upper_arm_min),
        upper_arm_max: toDecimal(row.upper_arm_max),
        height_min: toDecimal(row.height_min),
        height_max: toDecimal(row.height_max),
      })),
      Designer: sizeChart.Designer,
    }

    return (
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h1>Edit Size Chart</h1>
            </div>
            <SizeChartForm sizeChart={serializableSizeChart} designers={designers} />
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error("Error fetching size chart:", error)
    notFound()
  }
}
