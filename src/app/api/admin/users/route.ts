import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"

export async function GET() {
    const users = await prisma.user.findMany()
    return NextResponse.json(users)
}

export async function POST(req: Request) {
    const body = await req.json()
    const hashed = await bcrypt.hash(body.password, 10)

    const user = await prisma.user.create({
        data: {
            email: body.email,
            password: hashed,
            role: body.role,
        },
    })

    return NextResponse.json(user)
}
