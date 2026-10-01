import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function parseClassBody(body: unknown) {
  if (!body || typeof body !== "object") return { error: "A request body is required." };
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const color = typeof input.color === "string" && input.color.trim() ? input.color : "#6366f1";
  const instructor = typeof input.instructor === "string" && input.instructor.trim() ? input.instructor.trim() : null;
  const room = typeof input.room === "string" && input.room.trim() ? input.room.trim() : null;
  const credits = input.credits === "" || input.credits === null || input.credits === undefined ? null : Number(input.credits);

  if (!name) return { error: "Class name is required." };
  if (credits !== null && (!Number.isInteger(credits) || credits < 0)) return { error: "Credits must be a non-negative whole number." };

  return { data: { name, color, instructor, room, credits } };
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const classes = await prisma.class.findMany({
    where: { userId },
    include: { assignments: { orderBy: { dueDate: "asc" } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(classes);
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = parseClassBody(await request.json());
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    const newClass = await prisma.class.create({ data: { ...result.data, userId }, include: { assignments: true } });
    return NextResponse.json(newClass, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create class." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Class id is required." }, { status: 400 });

  try {
    const existing = await prisma.class.findFirst({ where: { id, userId } });
    if (!existing) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    const result = parseClassBody(await request.json());
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    const updated = await prisma.class.update({ where: { id }, data: result.data, include: { assignments: { orderBy: { dueDate: "asc" } } } });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Unable to update class." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Class id is required." }, { status: 400 });

  const deleted = await prisma.class.deleteMany({ where: { id, userId } });
  if (deleted.count === 0) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  return NextResponse.json({ success: true });
}
