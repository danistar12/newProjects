import { addHours } from "date-fns";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const assignmentTypes = new Set(["Homework", "Quiz", "Exam", "Midterm", "Final", "Lab", "Project", "Discussion Post", "Extra Credit", "Other"]);

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseAssignmentBody(body: unknown, partial = false) {
  if (!body || typeof body !== "object") return { error: "A request body is required." };
  const input = body as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const assignmentType = typeof input.assignmentType === "string" ? input.assignmentType : "";
  const dueDate = parseDate(input.dueDate);
  const grade = typeof input.grade === "string" && input.grade.trim() ? input.grade.trim() : null;

  if (!partial && !title) return { error: "Assignment title is required." };
  if (!partial && !dueDate) return { error: "A valid due date is required." };
  if (!partial && !assignmentTypes.has(assignmentType)) return { error: "A valid assignment type is required." };
  if (partial && input.title !== undefined && !title) return { error: "Assignment title is required." };
  if (partial && input.dueDate !== undefined && !dueDate) return { error: "A valid due date is required." };
  if (partial && input.assignmentType !== undefined && !assignmentTypes.has(assignmentType)) return { error: "A valid assignment type is required." };

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = title;
  if (input.assignmentType !== undefined) data.assignmentType = assignmentType;
  if (input.description !== undefined) data.description = typeof input.description === "string" && input.description.trim() ? input.description.trim() : null;
  if (input.dueDate !== undefined) data.dueDate = dueDate;
  if (input.grade !== undefined) data.grade = grade;
  if (input.isCompleted !== undefined) data.isCompleted = Boolean(input.isCompleted);
  if (input.classId !== undefined) data.classId = typeof input.classId === "string" ? input.classId : "";

  return { data };
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = parseAssignmentBody(await request.json());
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    const classId = typeof result.data.classId === "string" ? result.data.classId : "";
    const classRecord = await prisma.class.findFirst({ where: { id: classId, userId } });
    if (!classRecord) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    const assignment = await prisma.assignment.create({ data: result.data as { classId: string; title: string; assignmentType: string; description: string | null; dueDate: Date }, include: { class: true } });
    const dueDate = assignment.dueDate;
    await prisma.calendarEvent.create({
      data: {
        userId,
        title: assignment.title,
        description: assignment.description,
        startDate: dueDate,
        endDate: addHours(dueDate, 1),
        type: "assignment",
        color: classRecord.color,
        assignmentId: assignment.id,
      },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create assignment." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Assignment id is required." }, { status: 400 });

  try {
    const existing = await prisma.assignment.findFirst({ where: { id, class: { is: { userId } } }, include: { class: true, calendarEvent: true } });
    if (!existing) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });

    const result = parseAssignmentBody(await request.json(), true);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    delete result.data.classId;

    const updateData = result.data as { title?: string; assignmentType?: string; description?: string | null; dueDate?: Date; grade?: string | null; isCompleted?: boolean };
    const updated = await prisma.assignment.update({ where: { id }, data: updateData, include: { class: true, calendarEvent: true } });
    if (existing.calendarEvent) {
      const baseTitle = (updateData.title ?? existing.title).replace(/\s+✓$/, "");
      await prisma.calendarEvent.update({ where: { id: existing.calendarEvent.id }, data: { title: updateData.isCompleted === true || (updateData.isCompleted === undefined && existing.isCompleted) ? `${baseTitle} ✓` : baseTitle, description: updateData.description ?? existing.description, startDate: updateData.dueDate ?? existing.dueDate, endDate: addHours(updateData.dueDate ?? existing.dueDate, 1), color: existing.class.color } });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Unable to update assignment." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Assignment id is required." }, { status: 400 });

  const assignment = await prisma.assignment.findFirst({ where: { id, class: { is: { userId } }, }, include: { calendarEvent: true } });
  if (!assignment) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });

  if (assignment.calendarEvent) await prisma.calendarEvent.delete({ where: { id: assignment.calendarEvent.id } });
  await prisma.assignment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
