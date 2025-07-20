import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"
import { Prisma } from "@prisma/client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const id = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: "Invalid pattern ID" }, { status: 400 })
    }

    const pattern = await prisma.pattern.findUnique({
      where: { id },
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

    return NextResponse.json({ success: true, pattern })
  } catch (error) {
    console.error(`Error fetching pattern:`, error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let id: number | undefined
  try {
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    const resolvedParams = await params
    id = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: "Invalid pattern ID" }, { status: 400 })
    }

    const body = await request.json()
    const {
      name,
      designer_id,
      url,
      thumbnail_url,
      yardage,
      sizes,
      language,
      difficulty,
      release_date,
      categories,
      audiences,
      fabricTypes,
      suggestedFabrics,
      attributes,
      formats,
    } = body

    if (!name || !designer_id || !url) {
      return NextResponse.json({ error: "Name, designer_id, and url are required" }, { status: 400 })
    }

    // --- DEFINITIVE FIX: Use a transaction with simple, explicit steps ---
    const updatedPattern = await prisma.$transaction(async (tx) => {
      // Step 1: Update the scalar fields on the Pattern itself.
      await tx.pattern.update({
        where: { id },
        data: {
          name,
          url,
          designer_id: Number(designer_id),
          thumbnail_url: thumbnail_url || null,
          yardage: yardage || null,
          sizes: sizes || null,
          language: language || null,
          difficulty: difficulty || null,
          release_date: release_date ? new Date(release_date) : null,
        },
      })

      // Step 2: Delete all existing many-to-many relationships.
      await Promise.all([
        tx.patternCategory.deleteMany({ where: { pattern_id: id } }),
        tx.patternAudience.deleteMany({ where: { pattern_id: id } }),
        tx.patternFabricType.deleteMany({ where: { pattern_id: id } }),
        tx.patternSuggestedFabric.deleteMany({ where: { pattern_id: id } }),
        tx.patternAttribute.deleteMany({ where: { pattern_id: id } }),
        tx.patternFormat.deleteMany({ where: { pattern_id: id } }),
      ])

      // Step 3: Create the new many-to-many relationships using createMany.
      await Promise.all([
        categories?.length > 0 &&
          tx.patternCategory.createMany({
            data: categories.map((catId: number) => ({ pattern_id: id!, category_id: catId })),
          }),
        audiences?.length > 0 &&
          tx.patternAudience.createMany({
            data: audiences.map((audId: number) => ({ pattern_id: id!, audience_id: audId })),
          }),
        fabricTypes?.length > 0 &&
          tx.patternFabricType.createMany({
            data: fabricTypes.map((fabId: number) => ({ pattern_id: id!, fabrictype_id: fabId })),
          }),
        suggestedFabrics?.length > 0 &&
          tx.patternSuggestedFabric.createMany({
            data: suggestedFabrics.map((sugId: number) => ({ pattern_id: id!, suggestedfabric_id: sugId })),
          }),
        attributes?.length > 0 &&
          tx.patternAttribute.createMany({
            data: attributes.map((attId: number) => ({ pattern_id: id!, attribute_id: attId })),
          }),
        formats?.length > 0 &&
          tx.patternFormat.createMany({
            data: formats.map((forId: number) => ({ pattern_id: id!, format_id: forId })),
          }),
      ])

      // Step 4: Return the fully updated pattern for the response.
      return tx.pattern.findUnique({ where: { id } })
    })

    return NextResponse.json({ success: true, pattern: updatedPattern })
  } catch (error) {
    console.error(`Error updating pattern ${id ?? "(unknown)"}:`, error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Prisma Error Code:", error.code)
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ success: false, error: `Failed to update pattern: ${errorMessage}` }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let id: number | undefined
  try {
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    const resolvedParams = await params
    id = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: "Invalid pattern ID" }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.patternCategory.deleteMany({ where: { pattern_id: id } })
      await tx.patternAudience.deleteMany({ where: { pattern_id: id } })
      await tx.patternFabricType.deleteMany({ where: { pattern_id: id } })
      await tx.patternSuggestedFabric.deleteMany({ where: { pattern_id: id } })
      await tx.patternAttribute.deleteMany({ where: { pattern_id: id } })
      await tx.patternFormat.deleteMany({ where: { pattern_id: id } })
      await tx.favorite.deleteMany({ where: { patternId: id } })
      await tx.rating.deleteMany({ where: { patternId: id } })
      await tx.pattern.delete({ where: { id } })
    })

    return NextResponse.json({ success: true, message: "Pattern deleted successfully" })
  } catch (error) {
    console.error(`Error deleting pattern ${id ?? "(unknown)"}:`, error)
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ success: false, error: `Failed to delete pattern: ${errorMessage}` }, { status: 500 })
  }
}
