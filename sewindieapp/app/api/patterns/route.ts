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
    // Check moderator access
    const { authorized, response, session } = await checkModeratorAccess()
    if (!authorized) return response

    // Get request body
    const data = await request.json()

    // Validate required fields
    if (!data.name || !data.designer_id) {
      return NextResponse.json({ error: "Name and designer_id are required" }, { status: 400 })
    }

    // Extract relationship data
    const { categories, audiences, fabricTypes, suggestedFabrics, attributes, formats, ...patternData } = data

    // Create pattern
    const pattern = await prisma.pattern.create({
      data: {
        name: patternData.name,
        designer_id: patternData.designer_id,
        thumbnail_url: patternData.thumbnail_url || null,
        description: patternData.description || null,
        difficulty_level: patternData.difficulty_level || "BEGINNER",
        release_date: patternData.release_date || null,
        price: patternData.price || null,
        // Add relationships if provided
        ...(categories && categories.length > 0
          ? {
              PatternCategory: {
                create: categories.map((categoryId: string) => ({
                  category: { connect: { id: categoryId } },
                })),
              },
            }
          : {}),
        ...(audiences && audiences.length > 0
          ? {
              PatternAudience: {
                create: audiences.map((audienceId: string) => ({
                  audience: { connect: { id: audienceId } },
                })),
              },
            }
          : {}),
        ...(fabricTypes && fabricTypes.length > 0
          ? {
              PatternFabricType: {
                create: fabricTypes.map((fabricTypeId: string) => ({
                  fabricType: { connect: { id: fabricTypeId } },
                })),
              },
            }
          : {}),
        ...(suggestedFabrics && suggestedFabrics.length > 0
          ? {
              PatternSuggestedFabric: {
                create: suggestedFabrics.map((suggestedFabricId: string) => ({
                  suggestedFabric: { connect: { id: suggestedFabricId } },
                })),
              },
            }
          : {}),
        ...(attributes && attributes.length > 0
          ? {
              PatternAttribute: {
                create: attributes.map((attributeId: string) => ({
                  attribute: { connect: { id: attributeId } },
                })),
              },
            }
          : {}),
        ...(formats && formats.length > 0
          ? {
              PatternFormat: {
                create: formats.map((formatId: string) => ({
                  format: { connect: { id: formatId } },
                })),
              },
            }
          : {}),
      },
      include: {
        designer: true,
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
        PatternSuggestedFabric: {
          include: {
            suggestedFabric: true,
          },
        },
        PatternAttribute: {
          include: {
            attribute: true,
          },
        },
        PatternFormat: {
          include: {
            format: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, pattern }, { status: 201 })
  } catch (error) {
    console.error("Error creating pattern:", error)
    return NextResponse.json({ success: false, error: "Failed to create pattern" }, { status: 500 })
  }
}
