import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"
import { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const sizeCharts = await prisma.sizeChart.findMany({
      include: {
        Designer: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { SizeChartRow: true },
        },
      },
      orderBy: {
        label: "asc",
      },
    })
    return NextResponse.json(sizeCharts)
  } catch (error) {
    console.error("Error fetching size charts:", error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    const body = await request.json()
    const { label, designer_id, measurement_unit, rows } = body

    if (!label || !designer_id || !measurement_unit) {
      return NextResponse.json({ error: "Label, designer, and measurement unit are required" }, { status: 400 })
    }

    const newSizeChart = await prisma.$transaction(async (tx) => {
      const createdSizeChart = await tx.sizeChart.create({
        data: {
          label,
          designer_id: Number(designer_id),
          measurement_unit,
        },
      })

      if (rows && rows.length > 0) {
        await tx.sizeChartRow.createMany({
          data: rows.map((row: any) => ({
            size_chart_id: createdSizeChart.id,
            size_label: row.size_label,
            upper_bust_min: row.upper_bust_min ? new Prisma.Decimal(row.upper_bust_min) : null,
            upper_bust_max: row.upper_bust_max ? new Prisma.Decimal(row.upper_bust_max) : null,
            full_bust_min: row.full_bust_min ? new Prisma.Decimal(row.full_bust_min) : null,
            full_bust_max: row.full_bust_max ? new Prisma.Decimal(row.full_bust_max) : null,
            chest_min: row.chest_min ? new Prisma.Decimal(row.chest_min) : null,
            chest_max: row.chest_max ? new Prisma.Decimal(row.chest_max) : null,
            waist_min: row.waist_min ? new Prisma.Decimal(row.waist_min) : null,
            waist_max: row.waist_max ? new Prisma.Decimal(row.waist_max) : null,
            hip_min: row.hip_min ? new Prisma.Decimal(row.hip_min) : null,
            hip_max: row.hip_max ? new Prisma.Decimal(row.hip_max) : null,
            inseam_min: row.inseam_min ? new Prisma.Decimal(row.inseam_min) : null,
            inseam_max: row.inseam_max ? new Prisma.Decimal(row.inseam_max) : null,
            height_min: row.height_min ? new Prisma.Decimal(row.height_min) : null,
            height_max: row.height_max ? new Prisma.Decimal(row.height_max) : null,
          })),
        })
      }
      return createdSizeChart
    })

    return NextResponse.json(newSizeChart, { status: 201 })
  } catch (error) {
    console.error("Error creating size chart:", error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A size chart with this label already exists for this designer." },
        { status: 409 },
      )
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ success: false, error: `Failed to create size chart: ${errorMessage}` }, { status: 500 })
  }
}
