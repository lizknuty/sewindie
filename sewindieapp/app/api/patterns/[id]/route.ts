import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const patternId = Number.parseInt(params.id, 10)
    if (isNaN(patternId)) {
      return NextResponse.json({ error: "Invalid pattern ID" }, { status: 400 })
    }

    const pattern = await prisma.pattern.findUnique({
      where: { id: patternId },
      include: {
        designer: { select: { id: true, name: true } },
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

    return NextResponse.json({ success: true, pattern })
  } catch (error) {
    console.error(`Error fetching pattern ${params.id}:`, error)
    return NextResponse.json({ success: false, error: "Failed to fetch pattern" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    const patternId = Number.parseInt(params.id, 10)
    if (isNaN(patternId)) {
      return NextResponse.json({ error: "Invalid pattern ID" }, { status: 400 })
    }

    const data = await request.json()
    const { categories, audiences, fabricTypes, suggestedFabrics, attributes, formats, ...patternData } = data

    await prisma.$transaction(async (tx) => {
      await tx.pattern.update({
        where: { id: patternId },
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
        },
      })

      const updateM2M = async (model: any, relationField: string, foreignKey: string, ids: number[] | undefined) => {
        if (ids === undefined) return
        await model.deleteMany({ where: { [relationField]: patternId } })
        if (ids.length > 0) {
          await model.createMany({
            data: ids.map((id: number) => ({
              [relationField]: patternId,
              [foreignKey]: id,
            })),
          })
        }
      }

      await updateM2M(tx.patternCategory, "pattern_id", "category_id", categories)
      await updateM2M(tx.patternAudience, "pattern_id", "audience_id", audiences)
      await updateM2M(tx.patternFabricType, "pattern_id", "fabrictype_id", fabricTypes)
      await updateM2M(tx.patternSuggestedFabric, "pattern_id", "suggestedfabric_id", suggestedFabrics)
      await updateM2M(tx.patternAttribute, "pattern_id", "attribute_id", attributes)
      await updateM2M(tx.patternFormat, "pattern_id", "format_id", formats)
    })

    const updatedPattern = await prisma.pattern.findUnique({
      where: { id: patternId },
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

    return NextResponse.json({ success: true, pattern: updatedPattern })
  } catch (error) {
    console.error(`Error updating pattern ${params.id}:`, error)
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ success: false, error: `Failed to update pattern: ${errorMessage}` }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    const patternId = Number.parseInt(params.id, 10)
    if (isNaN(patternId)) {
      return NextResponse.json({ error: "Invalid pattern ID" }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.patternCategory.deleteMany({ where: { pattern_id: patternId } })
      await tx.patternAudience.deleteMany({ where: { pattern_id: patternId } })
      await tx.patternFabricType.deleteMany({ where: { pattern_id: patternId } })
      await tx.patternSuggestedFabric.deleteMany({ where: { pattern_id: patternId } })
      await tx.patternAttribute.deleteMany({ where: { pattern_id: patternId } })
      await tx.patternFormat.deleteMany({ where: { pattern_id: patternId } })
      await tx.favorite.deleteMany({ where: { patternId: patternId } })
      await tx.rating.deleteMany({ where: { patternId: patternId } })
      await tx.pattern.delete({ where: { id: patternId } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`Error deleting pattern ${params.id}:`, error)
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ success: false, error: `Failed to delete pattern: ${errorMessage}` }, { status: 500 })
  }
}
