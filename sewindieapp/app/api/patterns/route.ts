import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"

export async function GET() {
  try {
    const patterns = await prisma.pattern.findMany({
      orderBy: { name: "asc" },
      include: {
        designer: { select: { id: true, name: true } },
        PatternCategory: {
          include: {
            category: true,
          },
        },
        PatternAudience: {
          include: {
            audience: true,
          },
        },
        PatternFabricType: {
          include: {
            fabricType: true,
          },
        },
      },
    })
    return NextResponse.json({ success: true, patterns })
  } catch (error) {
    console.error("Error fetching patterns:", error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    const data = await request.json()

    if (!data.name || !data.designer_id || !data.url) {
      return NextResponse.json({ error: "Name, designer_id, and url are required" }, { status: 400 })
    }

    const { categories, audiences, fabricTypes, suggestedFabrics, attributes, formats, ...patternData } = data

    const pattern = await prisma.pattern.create({
      data: {
        name: patternData.name,
        designer_id: patternData.designer_id,
        url: patternData.url,
        thumbnail_url: patternData.thumbnail_url || null,
        yardage: patternData.yardage || null,
        sizes: patternData.sizes || null,
        language: patternData.language || null,
        difficulty: patternData.difficulty || null,
        release_date: patternData.release_date ? new Date(patternData.release_date) : null,
        PatternCategory: {
          create: categories?.map((categoryId: number) => ({
            category: { connect: { id: categoryId } },
          })),
        },
        PatternAudience: {
          create: audiences?.map((audienceId: number) => ({
            audience: { connect: { id: audienceId } },
          })),
        },
        PatternFabricType: {
          create: fabricTypes?.map((fabricTypeId: number) => ({
            fabricType: { connect: { id: fabricTypeId } },
          })),
        },
        PatternSuggestedFabric: {
          create: suggestedFabrics?.map((suggestedFabricId: number) => ({
            suggestedFabric: { connect: { id: suggestedFabricId } },
          })),
        },
        PatternAttribute: {
          create: attributes?.map((attributeId: number) => ({
            attribute: { connect: { id: attributeId } },
          })),
        },
        PatternFormat: {
          create: formats?.map((formatId: number) => ({
            Format: { connect: { id: formatId } },
          })),
        },
      },
      include: {
        designer: true,
        PatternCategory: { include: { category: true } },
        PatternAudience: { include: { audience: true } },
        PatternFabricType: { include: { fabricType: true } },
        PatternSuggestedFabric: { include: { suggestedFabric: true } },
        PatternAttribute: { include: { attribute: true } },
        PatternFormat: { include: { Format: true } },
      },
    })

    return NextResponse.json({ success: true, pattern }, { status: 201 })
  } catch (error) {
    console.error("Error creating pattern:", error)
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ success: false, error: `Failed to create pattern: ${errorMessage}` }, { status: 500 })
  }
}
