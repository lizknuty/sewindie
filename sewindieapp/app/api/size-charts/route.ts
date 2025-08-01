import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"
import { Decimal } from "@prisma/client/runtime/library"

// Helper function to convert string to Decimal or null
const toDecimal = (value: string | number | null | undefined): Decimal | null => {
  if (value === null || value === undefined || value === "") {
    return null
  }
  const num = Number(value)
  return isNaN(num) ? null : new Decimal(num)
}

export async function GET(request: NextRequest) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  try {
    const sizeCharts = await prisma.sizeChart.findMany({
      include: {
        Designer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        label: "asc",
      },
    })
    return NextResponse.json(sizeCharts)
  } catch (error) {
    console.error("Error fetching size charts:", error)
    return NextResponse.json({ error: "Failed to fetch size charts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  try {
    const body = await request.json()
    const { label, designer_id, measurement_unit, rows } = body

    if (!label || !designer_id || !measurement_unit || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const newSizeChart = await prisma.$transaction(async (tx) => {
      const sizeChart = await tx.sizeChart.create({
        data: {
          label,
          designer_id,
          measurement_unit,
        },
      })

      if (rows.length > 0) {
        await tx.sizeChartRow.createMany({
          data: rows.map((row: any) => ({
            size_chart_id: sizeChart.id,
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
        })
      }

      return sizeChart
    })

    return NextResponse.json(newSizeChart, { status: 201 })
  } catch (error) {
    console.error("Error creating size chart:", error)
    return NextResponse.json({ error: (error as Error).message || "Failed to create size chart" }, { status: 500 })
  }
}
