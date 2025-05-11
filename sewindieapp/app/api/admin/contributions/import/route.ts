import { type NextRequest, NextResponse } from "next/server"
import { checkModeratorAccess } from "@/lib/admin-middleware"
import prisma from "@/lib/prisma"
import { updateContributionStatus } from "@/lib/google-sheets"

export async function POST(request: NextRequest) {
  try {
    // Check moderator access
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    // Get request body
    const data = await request.json()
    const { contribution } = data

    if (!contribution) {
      return NextResponse.json({ error: "Contribution data is required" }, { status: 400 })
    }

    // Check if designer exists or create a new one
    let designerId = ""
    if (contribution.designer && !contribution.designer.includes("not_listed")) {
      // Try to find existing designer by name
      const existingDesigner = await prisma.designer.findFirst({
        where: {
          name: {
            equals: contribution.designer,
            mode: "insensitive",
          },
        },
      })

      if (existingDesigner) {
        designerId = existingDesigner.id
      } else {
        // Create new designer
        const newDesigner = await prisma.designer.create({
          data: {
            name: contribution.designer,
          },
        })
        designerId = newDesigner.id
      }
    } else {
      return NextResponse.json({ error: "Valid designer information is required" }, { status: 400 })
    }

    // Parse categories
    const categoryNames = contribution.categories
      .split(",")
      .map((cat: string) => cat.trim())
      .filter((cat: string) => cat)

    // Create pattern with transaction to handle relationships
    const pattern = await prisma.$transaction(async (tx) => {
      // Create the pattern
      const newPattern = await tx.pattern.create({
        data: {
          name: contribution.name,
          designer_id: designerId,
          description: `Sizes: ${contribution.sizes}\nRequired Notions: ${contribution.requiredNotions}\nTotal Yardage: ${contribution.totalYardage}`,
          difficulty_level: "BEGINNER", // Default
          price: contribution.price && contribution.price !== "Free" ? Number.parseFloat(contribution.price) : null,
          is_free: contribution.price === "Free",
        },
      })

      // Process categories
      for (const categoryName of categoryNames) {
        // Find or create category
        let category = await tx.category.findFirst({
          where: {
            name: {
              equals: categoryName,
              mode: "insensitive",
            },
          },
        })

        if (!category) {
          category = await tx.category.create({
            data: {
              name: categoryName,
            },
          })
        }

        // Create pattern-category relationship
        await tx.patternCategory.create({
          data: {
            pattern_id: newPattern.id,
            category_id: category.id,
          },
        })
      }

      // Process audience
      if (contribution.audience) {
        const audience = await tx.audience.findFirst({
          where: {
            name: {
              equals: contribution.audience,
              mode: "insensitive",
            },
          },
        })

        if (audience) {
          await tx.patternAudience.create({
            data: {
              pattern_id: newPattern.id,
              audience_id: audience.id,
            },
          })
        }
      }

      // Process suggested fabrics
      if (contribution.suggestedFabrics) {
        const fabricNames = contribution.suggestedFabrics
          .split(",")
          .map((fabric: string) => fabric.trim())
          .filter((fabric: string) => fabric)

        for (const fabricName of fabricNames) {
          let suggestedFabric = await tx.suggestedFabric.findFirst({
            where: {
              name: {
                equals: fabricName,
                mode: "insensitive",
              },
            },
          })

          if (!suggestedFabric) {
            suggestedFabric = await tx.suggestedFabric.create({
              data: {
                name: fabricName,
              },
            })
          }

          await tx.patternSuggestedFabric.create({
            data: {
              pattern_id: newPattern.id,
              suggested_fabric_id: suggestedFabric.id,
            },
          })
        }
      }

      return newPattern
    })

    // Update contribution status in Google Sheets
    await updateContributionStatus(contribution.rowIndex, "Imported")

    return NextResponse.json({ success: true, pattern })
  } catch (error) {
    console.error("Error importing contribution:", error)
    return NextResponse.json({ success: false, error: "Failed to import contribution" }, { status: 500 })
  }
}
