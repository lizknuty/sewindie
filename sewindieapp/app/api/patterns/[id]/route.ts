import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!params.id) {
    return NextResponse.json({ error: "Invalid pattern ID" }, { status: 400 })
  }

  try {
    const patternId = Number.parseInt(params.id, 10)

    if (isNaN(patternId)) {
      return NextResponse.json({ error: "Invalid pattern ID format" }, { status: 400 })
    }

    const pattern = await prisma.pattern.findUnique({
      where: {
        id: patternId,
      },
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
            Format: true,
          },
        },
      },
    })

    if (!pattern) {
      return NextResponse.json({ success: false, error: "Pattern not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, pattern })
  } catch (error) {
    console.error("Error fetching pattern:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch pattern" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const patternId = Number.parseInt(params.id, 10)

    if (isNaN(patternId)) {
      return NextResponse.json({ error: "Invalid pattern ID format" }, { status: 400 })
    }

    // Get request body
    const data = await request.json()

    // Validate required fields
    if (!data.name || !data.designer_id || !data.url) {
      return NextResponse.json({ error: "Name, designer_id, and url are required" }, { status: 400 })
    }

    // Check if pattern exists
    const existingPattern = await prisma.pattern.findUnique({
      where: {
        id: patternId,
      },
      include: {
        PatternCategory: true,
        PatternAudience: true,
        PatternFabricType: true,
        PatternSuggestedFabric: true,
        PatternAttribute: true,
        PatternFormat: true,
      },
    })

    if (!existingPattern) {
      return NextResponse.json({ error: "Pattern not found" }, { status: 404 })
    }

    // Extract relationship data
    const { categories, audiences, fabricTypes, suggestedFabrics, attributes, formats, ...patternData } = data

    // Update pattern with transaction to handle relationships
    const pattern = await prisma.$transaction(async (tx) => {
      // Delete existing relationships if new ones are provided
      if (categories) {
        await tx.patternCategory.deleteMany({
          where: { pattern_id: patternId },
        })
      }

      if (audiences) {
        await tx.patternAudience.deleteMany({
          where: { pattern_id: patternId },
        })
      }

      if (fabricTypes) {
        await tx.patternFabricType.deleteMany({
          where: { pattern_id: patternId },
        })
      }

      if (suggestedFabrics) {
        await tx.patternSuggestedFabric.deleteMany({
          where: { pattern_id: patternId },
        })
      }

      if (attributes) {
        await tx.patternAttribute.deleteMany({
          where: { pattern_id: patternId },
        })
      }

      if (formats) {
        await tx.patternFormat.deleteMany({
          where: { pattern_id: patternId },
        })
      }

      // Update the pattern
      const updatedPattern = await tx.pattern.update({
        where: {
          id: patternId,
        },
        data: {
          name: patternData.name,
          designer_id: patternData.designer_id,
          url: patternData.url,
          thumbnail_url: patternData.thumbnail_url || null,
          yardage: patternData.yardage || null,
          sizes: patternData.sizes || null,
          language: patternData.language || null,
          // Remove the description field as it doesn't exist in the schema
        },
      })

      // Create new relationships
      if (categories && categories.length > 0) {
        await Promise.all(
          categories.map((categoryId: number) =>
            tx.patternCategory.create({
              data: {
                pattern_id: patternId,
                category_id: categoryId,
              },
            }),
          ),
        )
      }

      if (audiences && audiences.length > 0) {
        await Promise.all(
          audiences.map((audienceId: number) =>
            tx.patternAudience.create({
              data: {
                pattern_id: patternId,
                audience_id: audienceId,
              },
            }),
          ),
        )
      }

      if (fabricTypes && fabricTypes.length > 0) {
        await Promise.all(
          fabricTypes.map((fabricTypeId: number) =>
            tx.patternFabricType.create({
              data: {
                pattern_id: patternId,
                fabrictype_id: fabricTypeId,
              },
            }),
          ),
        )
      }

      if (suggestedFabrics && suggestedFabrics.length > 0) {
        await Promise.all(
          suggestedFabrics.map((suggestedFabricId: number) =>
            tx.patternSuggestedFabric.create({
              data: {
                pattern_id: patternId,
                suggestedfabric_id: suggestedFabricId,
              },
            }),
          ),
        )
      }

      if (attributes && attributes.length > 0) {
        await Promise.all(
          attributes.map((attributeId: number) =>
            tx.patternAttribute.create({
              data: {
                pattern_id: patternId,
                attribute_id: attributeId,
              },
            }),
          ),
        )
      }

      if (formats && formats.length > 0) {
        await Promise.all(
          formats.map((formatId: number) =>
            tx.patternFormat.create({
              data: {
                pattern_id: patternId,
                format_id: formatId,
              },
            }),
          ),
        )
      }

      return updatedPattern
    })

    // Fetch the updated pattern with all relationships
    const updatedPattern = await prisma.pattern.findUnique({
      where: { id: patternId },
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
            Format: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, pattern: updatedPattern })
  } catch (error) {
    console.error("Error updating pattern:", error)
    return NextResponse.json({ success: false, error: "Failed to update pattern" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const patternId = Number.parseInt(params.id, 10)

    if (isNaN(patternId)) {
      return NextResponse.json({ error: "Invalid pattern ID format" }, { status: 400 })
    }

    // Check if pattern exists
    const existingPattern = await prisma.pattern.findUnique({
      where: {
        id: patternId,
      },
    })

    if (!existingPattern) {
      return NextResponse.json({ error: "Pattern not found" }, { status: 404 })
    }

    // Delete pattern with transaction to handle relationships
    await prisma.$transaction(async (tx) => {
      // Delete related records first
      await tx.patternCategory.deleteMany({
        where: { pattern_id: patternId },
      })

      await tx.patternAudience.deleteMany({
        where: { pattern_id: patternId },
      })

      await tx.patternFabricType.deleteMany({
        where: { pattern_id: patternId },
      })

      await tx.patternSuggestedFabric.deleteMany({
        where: { pattern_id: patternId },
      })

      await tx.patternAttribute.deleteMany({
        where: { pattern_id: patternId },
      })

      await tx.patternFormat.deleteMany({
        where: { pattern_id: patternId },
      })

      // Delete the pattern
      await tx.pattern.delete({
        where: {
          id: patternId,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting pattern:", error)
    return NextResponse.json({ success: false, error: "Failed to delete pattern" }, { status: 500 })
  }
}
