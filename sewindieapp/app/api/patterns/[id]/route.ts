import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let id
  try {
    const paramsData = await params
    id = paramsData.id
    const pattern = await prisma.pattern.findUnique({
      where: { id: Number(id) },
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

    if (!pattern) {
      return NextResponse.json({ success: false, error: "Pattern not found" }, { status: 404 })
    }

    return NextResponse.json(pattern)
  } catch (error) {
    console.error(`Error fetching pattern ${id}:`, error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let id
  try {
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    const paramsData = await params
    id = paramsData.id
    const requestData = await request.json()

    // Destructure and explicitly ignore any 'id' from the request body.
    const {
      id: bodyId,
      categories,
      audiences,
      fabricTypes,
      suggestedFabrics,
      attributes,
      formats,
      ...patternData
    } = requestData

    const updatedPattern = await prisma.pattern.update({
      where: { id: Number(id) },
      data: {
        ...patternData,
        release_date: patternData.release_date ? new Date(patternData.release_date) : null,
        PatternCategory: {
          deleteMany: {},
          create: categories?.map((categoryId: number) => ({
            category: { connect: { id: categoryId } },
          })),
        },
        PatternAudience: {
          deleteMany: {},
          create: audiences?.map((audienceId: number) => ({
            audience: { connect: { id: audienceId } },
          })),
        },
        PatternFabricType: {
          deleteMany: {},
          create: fabricTypes?.map((fabricTypeId: number) => ({
            fabricType: { connect: { id: fabricTypeId } },
          })),
        },
        PatternSuggestedFabric: {
          deleteMany: {},
          create: suggestedFabrics?.map((suggestedFabricId: number) => ({
            suggestedFabric: { connect: { id: suggestedFabricId } },
          })),
        },
        PatternAttribute: {
          deleteMany: {},
          create: attributes?.map((attributeId: number) => ({
            attribute: { connect: { id: attributeId } },
          })),
        },
        PatternFormat: {
          deleteMany: {},
          create: formats?.map((formatId: number) => ({
            Format: { connect: { id: formatId } },
          })),
        },
      },
    })

    return NextResponse.json({ success: true, pattern: updatedPattern })
  } catch (error) {
    console.error(`Error updating pattern ${id}:`, error)
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ success: false, error: `Failed to update pattern: ${errorMessage}` }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let id
  try {
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    const paramsData = await params
    id = paramsData.id

    // Transaction to delete pattern and its relations
    await prisma.$transaction([
      prisma.patternCategory.deleteMany({ where: { pattern_id: Number(id) } }),
      prisma.patternAudience.deleteMany({ where: { pattern_id: Number(id) } }),
      prisma.patternFabricType.deleteMany({ where: { pattern_id: Number(id) } }),
      prisma.patternSuggestedFabric.deleteMany({ where: { pattern_id: Number(id) } }),
      prisma.patternAttribute.deleteMany({ where: { pattern_id: Number(id) } }),
      prisma.patternFormat.deleteMany({ where: { pattern_id: Number(id) } }),
      prisma.favorite.deleteMany({ where: { patternId: Number(id) } }),
      prisma.rating.deleteMany({ where: { patternId: Number(id) } }),
      prisma.pattern.delete({ where: { id: Number(id) } }),
    ])

    return NextResponse.json({ success: true, message: "Pattern deleted successfully" })
  } catch (error) {
    console.error(`Error deleting pattern ${id}:`, error)
    return NextResponse.json({ success: false, error: "Failed to delete pattern" }, { status: 500 })
  }
}
