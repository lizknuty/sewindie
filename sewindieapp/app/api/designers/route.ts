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
        url: data.url,
        logo_url: data.logo_url || null,
        email: data.email || null,
        address: data.address || null,
        facebook: data.facebook || null,
        instagram: data.instagram || null,
        pinterest: data.pinterest || null,
        youtube: data.youtube || null,
      },
    })

    return NextResponse.json(designer, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = (error.meta?.target as string[]) || ["unknown field"]
        const message = `A designer with this ${target.join(", ")} already exists.`
        console.error("Unique constraint failed on:", target)
        return NextResponse.json({ error: message }, { status: 409 })
      }
      console.error("Prisma Error Code:", error.code)
      return NextResponse.json({ error: `Database error: ${error.code}` }, { status: 500 })
    }
    console.error("Error creating designer:", error)
    return NextResponse.json({ error: "Failed to create designer due to an unexpected error." }, { status: 500 })
  }
}
