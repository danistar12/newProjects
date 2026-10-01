import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const eventTypes = new Set(["class", "assignment", "study", "personal"]);

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateEventBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return { error: "A request body is required." };
  }

  const input = body as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const startDate = parseDate(input.startDate);
  const endDate = parseDate(input.endDate);
  const type = typeof input.type === "string" ? input.type : "";

  if (!title) return { error: "Title is required." };
  if (!startDate || !endDate) return { error: "Valid start and end dates are required." };
  if (endDate <= startDate) return { error: "End date must be after start date." };
  if (!eventTypes.has(type)) return { error: "Invalid event type." };

  return {
    data: {
      title,
      description: typeof input.description === "string" && input.description.trim() ? input.description.trim() : null,
      startDate,
      endDate,
      type,
      color: typeof input.color === "string" && input.color.trim() ? input.color : "#6366f1",
    },
  };
}

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const month = new URL(request.url).searchParams.get("month");
  const where: { userId: string; startDate?: { gte: Date; lt: Date } } = { userId };

  if (month) {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) return NextResponse.json({ error: "month must use YYYY-MM format." }, { status: 400 });

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const startDate = new Date(year, monthIndex, 1);
    const endDate = new Date(year, monthIndex + 1, 1);

    if (startDate.getMonth() !== monthIndex || Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Invalid month." }, { status: 400 });
    }

    where.startDate = { gte: startDate, lt: endDate };
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json(events);
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = validateEventBody(await request.json());
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    const event = await prisma.calendarEvent.create({
      data: { ...result.data, userId },
    });

    return NextResponse.json(event, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create event." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Event id is required." }, { status: 400 });

  try {
    const existing = await prisma.calendarEvent.findFirst({ where: { id, userId } });
    if (!existing) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    const result = validateEventBody(await request.json());
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: result.data,
    });

    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ error: "Unable to update event." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Event id is required." }, { status: 400 });

  const deleted = await prisma.calendarEvent.deleteMany({ where: { id, userId } });
  if (deleted.count === 0) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  return NextResponse.json({ success: true });
}
