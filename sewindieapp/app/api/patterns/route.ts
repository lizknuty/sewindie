import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"
import { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const searchQuery = searchParams.get("search")
    const sortQuery = searchParams.get("sort")
    const categoryIds = searchParams.getAll("category").map(Number)
    const attributeIds = searchParams.getAll("attribute").map(Number)
    const formatIds = searchParams.getAll("format").map(Number)
    const audienceIds = searchParams.getAll("audience").map(Number)
    const fabricTypeIds = searchParams.getAll("fabricType").map(Number)
    const designerIds = searchParams.getAll("designer").map(Number)
    const whereClause: Prisma.PatternWhereInput = {}
    const orderByClause: Prisma.PatternOrderByWithRelationInput = {}

    if (searchQuery) {
      whereClause.OR = [
        {
          name: {
            contains: searchQuery,
            mode: "insensitive",
          },
        },
        {
          designer: {
            name: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
        },
      ]
    }

    if (categoryIds.length > 0) {
      whereClause.PatternCategory = {
        some: {
          category_id: {
            in: categoryIds,
          },
        },
      }
    }
    if (attributeIds.length > 0) {
      whereClause.PatternAttribute = {
        some: {
          attribute_id: {
            in: attributeIds,
          },
        },
      }
    }
    if (formatIds.length > 0) {
      whereClause.PatternFormat = {
        some: {
          format_id: {
            in: formatIds,
          },
        },
      }
    }
    if (audienceIds.length > 0) {
      whereClause.PatternAudience = {
        some: {
          audience_id: {
            in: audienceIds,
          },
        },
      }
    }
    if (fabricTypeIds.length > 0) {
      whereClause.PatternFabricType = {
        some: {
          fabrictype_id: {
            // Corrected from fabricType_id to fabrictype_id
            in: fabricTypeIds,
          },
        },
      }
    }
    if (designerIds.length > 0) {
      whereClause.designer_id = {
        in: designerIds,
      }
    }

    switch (sortQuery) {
      case "name_asc":
        orderByClause.name = "asc"
        break
      case "name_desc":
        orderByClause.name = "desc"
        break
      case "designer_asc":
        orderByClause.designer = { name: "asc" }
        break
      case "designer_desc":
        orderByClause.designer = { name: "desc" }
        break
      default:
        orderByClause.name = "asc" // Default sort
        break
    }

    const patterns = await prisma.pattern.findMany({
      where: whereClause,
      orderBy: orderByClause,
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
    if (!body.name || !body.designer_id || !body.url) {
      return NextResponse.json({ error: "Name, designer_id, and url are required" }, { status: 400 })
    }

    // Step 1: Create the Pattern with an explicitly constructed data object.
    const newPattern = await prisma.pattern.create({
      data: {
        name: body.name,
        url: body.url,
        designer_id: Number(body.designer_id),
        thumbnail_url: body.thumbnail_url || null,
        yardage: body.yardage || null,
        // sizes: body.sizes || null, // Removed
        language: body.language || null,
        difficulty: body.difficulty || null,
        release_date: body.release_date ? new Date(body.release_date) : null,
      },
    })

    // Step 2: Update the new pattern to connect all its many-to-many relationships.
    const updatedPatternWithRelations = await prisma.pattern.update({
      where: { id: newPattern.id },
      data: {
        PatternCategory: {
          create: body.categories?.map((id: number) => ({ category: { connect: { id } } })),
        },
        PatternAudience: {
          create: body.audiences?.map((id: number) => ({ audience: { connect: { id } } })),
        },
        PatternFabricType: {
          create: body.fabricTypes?.map((id: number) => ({ fabricType: { connect: { id } } })),
        },
        PatternSuggestedFabric: {
          create: body.suggestedFabrics?.map((id: number) => ({ suggestedFabric: { connect: { id } } })),
        },
        PatternAttribute: {
          create: body.attributes?.map((id: number) => ({ attribute: { connect: { id } } })),
        },
        PatternFormat: {
          create: body.formats?.map((id: number) => ({ Format: { connect: { id } } })),
        },
        PatternSizeChart: {
          // Added for size charts
          create: body.sizeCharts?.map((id: number) => ({ SizeChart: { connect: { id } } })),
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
