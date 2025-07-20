import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"
import { Prisma } from "@prisma/client"

export async function GET() {
  try {
    const patterns = await prisma.pattern.findMany({
      orderBy: { name: "asc" },
      include: {
        designer: { select: { id: true, name: true } },
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

    // --- DEFINITIVE FIX: TWO-STEP CREATE ---

    // Step 1: Create the Pattern with scalar fields ONLY. This is a simple, reliable operation.
    const newPattern = await prisma.pattern.create({
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

    // Step 2: Update the new pattern to connect all its many-to-many relationships.
    const updatedPatternWithRelations = await prisma.pattern.update({
      where: { id: newPattern.id },
      data: {
        PatternCategory: {
          create: categories?.map((id: number) => ({ category: { connect: { id } } })),
        },
        PatternAudience: {
          create: audiences?.map((id: number) => ({ audience: { connect: { id } } })),
        },
        PatternFabricType: {
          create: fabricTypes?.map((id: number) => ({ fabricType: { connect: { id } } })),
        },
        PatternSuggestedFabric: {
          create: suggestedFabrics?.map((id: number) => ({ suggestedFabric: { connect: { id } } })),
        },
        PatternAttribute: {
          create: attributes?.map((id: number) => ({ attribute: { connect: { id } } })),
        },
        PatternFormat: {
          create: formats?.map((id: number) => ({ Format: { connect: { id } } })),
        },
      },
    })

    return NextResponse.json({ success: true, pattern: updatedPatternWithRelations }, { status: 201 })
  } catch (error) {
    console.error("Error creating pattern:", error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Prisma Error Code:", error.code)
      console.error("Prisma Meta:", error.meta)
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ success: false, error: `Failed to create pattern: ${errorMessage}` }, { status: 500 })
  }
}
