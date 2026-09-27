import { addMinutes } from "date-fns";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseSessionBody(body: unknown, partial = false) {
  if (!body || typeof body !== "object") return { error: "A request body is required." };
  const input = body as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const topic = typeof input.topic === "string" ? input.topic.trim() : "";
  const studyType = typeof input.studyType === "string" && input.studyType.trim() ? input.studyType.trim() : "Focus Session";
  const scheduledDate = parseDate(input.scheduledDate);
  const durationMinutes = Number(input.durationMinutes);

  if (!partial && !title) return { error: "Session title is required." };
  if (!partial && !topic) return { error: "Topic is required." };
  if (partial && input.title !== undefined && !title) return { error: "Session title is required." };
  if (partial && input.topic !== undefined && !topic) return { error: "Topic is required." };
  if (input.scheduledDate !== undefined && !scheduledDate) return { error: "A valid scheduled date is required." };
  if (!partial && !scheduledDate) return { error: "A valid scheduled date is required." };
  if (input.durationMinutes !== undefined && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440)) return { error: "Duration must be a whole number between 1 and 1440 minutes." };
  if (!partial && (!Number.isInteger(durationMinutes) || durationMinutes < 1)) return { error: "Duration must be at least 1 minute." };

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = title;
  if (input.topic !== undefined) data.topic = topic;
  if (input.studyType !== undefined) data.studyType = studyType;
  if (input.scheduledDate !== undefined) data.scheduledDate = scheduledDate;
  if (input.durationMinutes !== undefined) data.durationMinutes = durationMinutes;
  if (input.notes !== undefined) data.notes = typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : null;
  if (input.classId !== undefined) data.classId = typeof input.classId === "string" && input.classId ? input.classId : null;
  if (input.isCompleted !== undefined) data.isCompleted = Boolean(input.isCompleted);

  return { data };
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessions = await prisma.studySession.findMany({
    where: { userId },
    include: { class: { select: { id: true, name: true, color: true } } },
    orderBy: { scheduledDate: "asc" },
  });

  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = parseSessionBody(await request.json());
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    const classId = typeof result.data.classId === "string" ? result.data.classId : null;
    const classRecord = classId ? await prisma.class.findFirst({ where: { id: classId, userId } }) : null;
    if (classId && !classRecord) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    const sessionData = result.data as { title: string; topic: string; studyType?: string; scheduledDate: Date; durationMinutes: number; notes?: string | null; isCompleted?: boolean };
    const session = await prisma.studySession.create({ data: { ...sessionData, userId, classId }, include: { class: { select: { id: true, name: true, color: true } } } });
    await prisma.calendarEvent.create({
      data: {
        userId,
        title: session.title,
        description: session.topic,
        startDate: session.scheduledDate,
        endDate: addMinutes(session.scheduledDate, session.durationMinutes),
        type: "study",
        color: classRecord?.color ?? "#8b5cf6",
        studySessionId: session.id,
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create study session." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Session id is required." }, { status: 400 });

  try {
    const existing = await prisma.studySession.findFirst({ where: { id, userId }, include: { calendarEvent: true } });
    if (!existing) return NextResponse.json({ error: "Study session not found." }, { status: 404 });

    const result = parseSessionBody(await request.json(), true);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    if (result.data.classId) {
      const classRecord = await prisma.class.findFirst({ where: { id: result.data.classId as string, userId } });
      if (!classRecord) return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    const session = await prisma.studySession.update({ where: { id }, data: result.data, include: { class: { select: { id: true, name: true, color: true } }, calendarEvent: true } });
    if (existing.calendarEvent) {
      const startDate = (result.data.scheduledDate as Date | undefined) ?? existing.scheduledDate;
      const durationMinutes = (result.data.durationMinutes as number | undefined) ?? existing.durationMinutes;
      await prisma.calendarEvent.update({ where: { id: existing.calendarEvent.id }, data: { title: (result.data.title as string | undefined) ?? existing.title, description: (result.data.topic as string | undefined) ?? existing.topic, startDate, endDate: addMinutes(startDate, durationMinutes) } });
    }
    return NextResponse.json(session);
  } catch {
    return NextResponse.json({ error: "Unable to update study session." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Session id is required." }, { status: 400 });

  const session = await prisma.studySession.findFirst({ where: { id, userId }, include: { calendarEvent: true } });
  if (!session) return NextResponse.json({ error: "Study session not found." }, { status: 404 });
  if (session.calendarEvent) await prisma.calendarEvent.delete({ where: { id: session.calendarEvent.id } });
  await prisma.studySession.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
