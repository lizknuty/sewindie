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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  // params is directly available as an object in Route Handlers, no need to await
  const sizeChartId = Number.parseInt(params.id, 10)

  if (isNaN(sizeChartId)) {
    return NextResponse.json({ error: "Invalid Size Chart ID" }, { status: 400 })
  }

  try {
    const sizeChart = await prisma.sizeChart.findUnique({
      where: { id: sizeChartId },
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
      return NextResponse.json({ error: "Size Chart not found" }, { status: 404 })
    }

    return NextResponse.json(sizeChart)
  } catch (error) {
    console.error("Error fetching size chart:", error)
    return NextResponse.json({ error: "Failed to fetch size chart" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  // params is directly available as an object in Route Handlers, no need to await
  const sizeChartId = Number.parseInt(params.id, 10)

  if (isNaN(sizeChartId)) {
    return NextResponse.json({ error: "Invalid Size Chart ID" }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { label, designer_id, measurement_unit, rows } = body

    if (!label || !designer_id || !measurement_unit || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const updatedSizeChart = await prisma.$transaction(async (tx) => {
      const existingSizeChart = await tx.sizeChart.findUnique({
        where: { id: sizeChartId },
        include: { SizeChartRow: true },
      })

      if (!existingSizeChart) {
        throw new Error("Size Chart not found")
      }

      // Update main size chart details
      const sizeChart = await tx.sizeChart.update({
        where: { id: sizeChartId },
        data: {
          label,
          designer_id,
          measurement_unit,
        },
      })

      // Determine rows to create, update, and delete
      const existingRowIds = new Set(existingSizeChart.SizeChartRow.map((row) => row.id))
      const incomingRowIds = new Set(rows.map((row: any) => row.id).filter(Boolean))

      const rowsToDelete = existingSizeChart.SizeChartRow.filter((row) => !incomingRowIds.has(row.id)).map(
        (row) => row.id,
      )

      const rowsToCreate = rows.filter((row: any) => !row.id)
      const rowsToUpdate = rows.filter((row: any) => incomingRowIds.has(row.id))

      // Delete removed rows
      if (rowsToDelete.length > 0) {
        await tx.sizeChartRow.deleteMany({
          where: {
            id: {
              in: rowsToDelete,
            },
          },
        })
      }

      // Create new rows
      if (rowsToCreate.length > 0) {
        await tx.sizeChartRow.createMany({
          data: rowsToCreate.map((row: any) => ({
            size_chart_id: sizeChart.id,
            size_label: row.size_label,
            upper_bust_min: toDecimal(row.upper_bust_min),
            upper_bust_max: toDecimal(row.upper_bust_max),
            full_bust_min: toDecimal(row.full_bust_min),
            full_bust_max: toDecimal(row.full_bust_max),
            chest_min: toDecimal(row.chest_min),
            chest_max: toDecimal(row.chest_max),
            waist_min: toDecimal(row.waist_min),
            waist_max: toDecimal(row.waist_max),
            hip_min: toDecimal(row.hip_min),
            hip_max: toDecimal(row.hip_max),
            inseam_min: toDecimal(row.inseam_min),
            inseam_max: toDecimal(row.inseam_max),
            height_min: toDecimal(row.height_min),
            height_max: toDecimal(row.height_max),
          })),
        })
      }

      // Update existing rows
      for (const row of rowsToUpdate) {
        await tx.sizeChartRow.update({
          where: { id: row.id },
          data: {
            size_label: row.size_label,
            upper_bust_min: toDecimal(row.upper_bust_min),
            upper_bust_max: toDecimal(row.upper_bust_max),
            full_bust_min: toDecimal(row.full_bust_min),
            full_bust_max: toDecimal(row.full_bust_max),
            chest_min: toDecimal(row.chest_min),
            chest_max: toDecimal(row.chest_max),
            waist_min: toDecimal(row.waist_min),
            waist_max: toDecimal(row.waist_max),
            hip_min: toDecimal(row.hip_min),
            hip_max: toDecimal(row.hip_max),
            inseam_min: toDecimal(row.inseam_min),
            inseam_max: toDecimal(row.inseam_max),
            height_min: toDecimal(row.height_min),
            height_max: toDecimal(row.height_max),
          },
        })
      }

      return sizeChart
    })

    return NextResponse.json(updatedSizeChart)
  } catch (error) {
    console.error("Error updating size chart:", error)
    return NextResponse.json({ error: (error as Error).message || "Failed to update size chart" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  // params is directly available as an object in Route Handlers, no need to await
  const sizeChartId = Number.parseInt(params.id, 10)

  if (isNaN(sizeChartId)) {
    return NextResponse.json({ error: "Invalid Size Chart ID" }, { status: 400 })
  }

  try {
    await prisma.sizeChart.delete({
      where: { id: sizeChartId },
    })
    return NextResponse.json({ message: "Size Chart deleted successfully" })
  } catch (error) {
    console.error("Error deleting size chart:", error)
    return NextResponse.json({ error: "Failed to delete size chart" }, { status: 500 })
  }
}
