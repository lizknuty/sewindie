import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { Prisma } from "@prisma/client"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const designers = await prisma.designer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    })
    return NextResponse.json(designers)
  } catch (error) {
    console.error("Error fetching designers:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await request.json()

    if (!data.name || !data.url) {
      return NextResponse.json({ error: "Name and Website URL are required" }, { status: 400 })
    }

    const designer = await prisma.designer.create({
      data: {
        name: data.name,
        logo_url: data.logo_url || null,
        url: data.url,
      },
    })

    return NextResponse.json(designer, { status: 201 })
  } catch (error) {
    // Enhanced error logging
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Log detailed Prisma error
      console.error("Prisma Error Code:", error.code)
      console.error("Prisma Error Meta:", error.meta)
      console.error("Prisma Error Message:", error.message)
      return NextResponse.json({ error: `Database error: ${error.code}` }, { status: 500 })
    }
    // Log generic error
    console.error("Error creating designer:", error)
    return NextResponse.json({ error: "Failed to create designer due to an unexpected error." }, { status: 500 })
  }
}
