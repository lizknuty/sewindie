import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"
import type { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const searchQuery = searchParams.get("search")

    const whereClause: Prisma.DesignerWhereInput = {}

    if (searchQuery) {
      whereClause.OR = [
        {
          name: {
            contains: searchQuery,
            mode: "insensitive",
          },
        },
      ]
    }

    const designers = await prisma.designer.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
    })
    return NextResponse.json({ success: true, designers })
  } catch (error) {
    console.error("Error fetching designers:", error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    const body = await request.json()
    const { name, url, logo_url, email, address, facebook, instagram, pinterest, youtube } = body

    if (!name || !url) {
      return NextResponse.json({ error: "Name and URL are required" }, { status: 400 })
    }

    const designer = await prisma.designer.create({
      data: {
        name,
        url,
        logo_url: logo_url || null,
        email: email || null,
        address: address || null,
        facebook: facebook || null,
        instagram: instagram || null,
        pinterest: pinterest || null,
        youtube: youtube || null,
      },
    })

    return NextResponse.json(designer, { status: 201 })
  } catch (error) {
    console.error("Error creating designer:", error)
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ error: `Failed to create designer: ${errorMessage}` }, { status: 500 })
  }
}
