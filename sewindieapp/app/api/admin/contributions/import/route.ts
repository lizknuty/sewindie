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
    let designerId = 0 // Initialize as number
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
        designerId = existingDesigner.id // This is a number
      } else {
        // Create new designer
        const newDesigner = await prisma.designer.create({
          data: {
            name: contribution.designer,
            url: "", // Add the required url field with an empty string
          },
        })
        designerId = newDesigner.id // This is a number
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
      // Create the pattern with only fields that exist in the schema
      const newPattern = await tx.pattern.create({
        data: {
          name: contribution.name,
          designer_id: designerId,
          sizes: contribution.sizes || null,
          url: contribution.pattern_url || "", // Add the required url field
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
              suggestedfabric_id: suggestedFabric.id, // Corrected field name
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
