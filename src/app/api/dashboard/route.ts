import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { endOfWeek, startOfWeek } from "date-fns";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const nextSevenDays = new Date(now);
  nextSevenDays.setDate(now.getDate() + 7);

  const [classCount, incompleteAssignmentsCount, upcomingStudySessionsCount, completedStudySessions, upcomingEvents, upcomingAssignments, todaysSchedule, todaysStudySessions, nextExamEvent] = await Promise.all([
    prisma.class.count({ where: { userId } }),
    prisma.assignment.count({
      where: {
        class: { is: { userId } },
        isCompleted: false,
      },
    }),
    prisma.studySession.count({
      where: {
        userId,
        isCompleted: false,
        scheduledDate: {
          gte: now,
          lte: nextSevenDays,
        },
      },
    }),
    prisma.studySession.findMany({
      where: {
        userId,
        isCompleted: true,
        scheduledDate: { gte: startOfWeek(now), lte: endOfWeek(now) },
      },
      select: { durationMinutes: true },
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId,
        startDate: { gte: now },
      },
      orderBy: { startDate: "asc" },
      take: 3,
    }),
    prisma.assignment.findMany({
      where: {
        class: { is: { userId } },
        isCompleted: false,
        dueDate: { gte: now },
      },
      orderBy: { dueDate: "asc" },
      take: 3,
      include: { class: true },
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId,
        startDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.studySession.findMany({
      where: {
        userId,
        scheduledDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      orderBy: { scheduledDate: "asc" },
    }),
    prisma.calendarEvent.findFirst({
      where: {
        userId,
        type: "assignment",
        startDate: { gte: now },
      },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const daysUntilNextExam = nextExamEvent
    ? Math.max(0, Math.ceil((new Date(nextExamEvent.startDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return NextResponse.json({
    stats: {
      classes: classCount,
      assignmentsDue: incompleteAssignmentsCount,
      studySessionsThisWeek: upcomingStudySessionsCount,
      completedStudyMinutesThisWeek: completedStudySessions.reduce((total, studySession) => total + studySession.durationMinutes, 0),
      daysUntilNextExam,
    },
    upcomingAssignments: upcomingAssignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      dueDate: assignment.dueDate,
      className: assignment.class.name,
      classColor: assignment.class.color,
      classId: assignment.classId,
    })),
    upcomingEvents: upcomingEvents.map((event) => ({
      id: event.id,
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      type: event.type,
      color: event.color ?? "#6366f1",
    })),
    todaysSchedule: todaysSchedule.map((event) => ({
      id: event.id,
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      type: event.type,
      color: event.color ?? "#6366f1",
    })),
    todaysStudySessions: todaysStudySessions.map((session) => ({
      id: session.id,
      title: session.title,
      topic: session.topic,
      scheduledDate: session.scheduledDate,
      durationMinutes: session.durationMinutes,
    })),
  });
}
