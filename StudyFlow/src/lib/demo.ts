import { randomUUID } from "crypto";
import { addDays, addHours, addMinutes, setHours, startOfDay } from "date-fns";
import bcrypt from "bcryptjs";

import { DEMO_EMAIL, DEMO_NAME } from "@/lib/demo-account";
import { prisma } from "@/lib/prisma";

// Dates are relative to "now" so the demo always has overdue, due-today and
// upcoming work no matter when it is opened.
function at(dayOffset: number, hour: number, minute = 0) {
  return addMinutes(setHours(startOfDay(addDays(new Date(), dayOffset)), hour), minute);
}

const demoClasses = [
  { key: "calc", name: "Calculus II", color: "#6366f1", instructor: "Dr. Ramirez", room: "Math 214", credits: 4 },
  { key: "bio", name: "Intro to Biology", color: "#22c55e", instructor: "Prof. Okafor", room: "Science 102", credits: 3 },
  { key: "cs", name: "Data Structures", color: "#0ea5e9", instructor: "Dr. Chen", room: "Eng 330", credits: 3 },
  { key: "hist", name: "World History", color: "#f97316", instructor: "Prof. Lindqvist", room: "Humanities 18", credits: 3 },
] as const;

type ClassKey = (typeof demoClasses)[number]["key"];

const demoAssignments: Array<{ cls: ClassKey; title: string; type: string; description?: string; due: Date; done?: boolean; grade?: string }> = [
  { cls: "calc", title: "Problem Set 5: Integration by Parts", type: "Homework", due: at(-9, 23, 59), done: true, grade: "94%" },
  { cls: "calc", title: "Quiz 3: Trig Substitution", type: "Quiz", due: at(-4, 10), done: true, grade: "88%" },
  { cls: "calc", title: "Problem Set 6: Partial Fractions", type: "Homework", description: "Section 7.4, problems 1-29 odd.", due: at(-1, 23, 59) },
  { cls: "calc", title: "Midterm Exam", type: "Midterm", description: "Covers chapters 6-7. One page of notes allowed.", due: at(6, 9) },
  { cls: "calc", title: "Problem Set 7: Improper Integrals", type: "Homework", due: at(12, 23, 59) },
  { cls: "bio", title: "Lab 4: Enzyme Activity", type: "Lab", due: at(-6, 17), done: true, grade: "A-" },
  { cls: "bio", title: "Cell Respiration Reading Quiz", type: "Quiz", due: at(0, 11) },
  { cls: "bio", title: "Lab 5: Photosynthesis Report", type: "Lab", description: "Include graphs of O2 output vs. light intensity.", due: at(3, 17) },
  { cls: "bio", title: "Genetics Unit Exam", type: "Exam", due: at(15, 10) },
  { cls: "cs", title: "Project 2: Linked List Library", type: "Project", due: at(-3, 23, 59), done: true, grade: "97/100" },
  { cls: "cs", title: "Discussion: Big-O in the Real World", type: "Discussion Post", due: at(1, 23, 59) },
  { cls: "cs", title: "Project 3: Binary Search Tree", type: "Project", description: "Insert, delete, in-order traversal, and unit tests.", due: at(9, 23, 59) },
  { cls: "cs", title: "Hash Table Worksheet", type: "Homework", due: at(4, 23, 59) },
  { cls: "hist", title: "Primary Source Analysis", type: "Homework", due: at(-2, 23, 59), done: true, grade: "B+" },
  { cls: "hist", title: "Industrial Revolution Essay", type: "Project", description: "1500-2000 words, Chicago style citations.", due: at(8, 23, 59) },
  { cls: "hist", title: "Extra Credit: Museum Visit Reflection", type: "Extra Credit", due: at(20, 23, 59) },
];

const demoSessions: Array<{ cls: ClassKey | null; title: string; topic: string; type: string; when: Date; minutes: number; done?: boolean; notes?: string }> = [
  { cls: "calc", title: "Integration techniques review", topic: "Integration by parts", type: "Practice Problems", when: at(-5, 19), minutes: 50, done: true, notes: "Still slow on choosing u and dv. Try LIATE." },
  { cls: "bio", title: "Respiration flashcards", topic: "Cellular respiration", type: "Flashcards", when: at(-2, 20), minutes: 25, done: true },
  { cls: "cs", title: "BST deep dive", topic: "Binary search trees", type: "Key Concepts", when: at(-1, 18), minutes: 45, done: true },
  { cls: "bio", title: "Pre-quiz cram", topic: "Cellular respiration", type: "Quiz Me", when: at(0, 8), minutes: 25 },
  { cls: "calc", title: "Midterm prep: partial fractions", topic: "Partial fractions", type: "Practice Problems", when: at(1, 17), minutes: 50 },
  { cls: "hist", title: "Essay outline", topic: "Industrial Revolution", type: "Study Guide Summary", when: at(2, 15), minutes: 60 },
  { cls: "cs", title: "Hashing vocab", topic: "Hash tables", type: "Definitions", when: at(3, 19), minutes: 25 },
  { cls: "calc", title: "Midterm practice exam", topic: "Chapters 6-7", type: "Quiz Me", when: at(5, 16), minutes: 90 },
];

const demoPersonalEvents = [
  { title: "Office hours: Dr. Chen", description: "Ask about BST deletion edge cases.", start: at(2, 13), hours: 1, color: "#0ea5e9" },
  { title: "Study group (Calc)", description: "Library room 3B", start: at(4, 18), hours: 2, color: "#6366f1" },
  { title: "Shift at campus café", start: at(1, 7), hours: 4, color: "#64748b" },
  { title: "Career fair", start: at(10, 11), hours: 3, color: "#ec4899" },
];

const demoChat = {
  title: "How do I pick u and dv for integration by parts?",
  messages: [
    { role: "user", content: "How do I pick u and dv for integration by parts?" },
    {
      role: "assistant",
      content:
        "Great question, and it's the step most people get stuck on. A handy rule of thumb is **LIATE**: pick $u$ as whichever factor comes first in this list:\n\n" +
        "1. **L**ogarithmic ($\\ln x$)\n2. **I**nverse trig ($\\arctan x$)\n3. **A**lgebraic ($x^2$, $3x$)\n4. **T**rig ($\\sin x$)\n5. **E**xponential ($e^x$)\n\n" +
        "Everything else becomes $dv$. For example, in $\\int x e^x \\, dx$, $x$ is algebraic and $e^x$ is exponential, so $u = x$ and $dv = e^x\\,dx$:\n\n" +
        "$$\\int x e^x \\, dx = x e^x - \\int e^x \\, dx = x e^x - e^x + C$$\n\n" +
        "Your **Calculus II midterm** covers chapters 6-7, so this will definitely show up. Want me to give you a few practice problems?",
    },
  ],
};

// Wipes the demo account's data and refills it with a fresh, date-relative
// semester. Called on every demo sign-in so visitors always start clean.
export async function resetDemoAccount() {
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: DEMO_NAME },
    // Random password: the demo account is only reachable through the demo provider.
    create: { email: DEMO_EMAIL, name: DEMO_NAME, passwordHash: await bcrypt.hash(randomUUID(), 10) },
  });
  const userId = user.id;

  await prisma.$transaction(async (tx) => {
    await tx.chatConversation.deleteMany({ where: { userId } });
    await tx.calendarEvent.deleteMany({ where: { userId } });
    await tx.quizAttempt.deleteMany({ where: { userId } });
    await tx.studySession.deleteMany({ where: { userId } });
    await tx.class.deleteMany({ where: { userId } });

    const classIds = {} as Record<ClassKey, string>;
    const classColors = {} as Record<ClassKey, string>;
    for (const { key, ...data } of demoClasses) {
      const created = await tx.class.create({ data: { ...data, userId } });
      classIds[key] = created.id;
      classColors[key] = created.color;
    }

    for (const item of demoAssignments) {
      const assignment = await tx.assignment.create({
        data: {
          classId: classIds[item.cls],
          title: item.title,
          assignmentType: item.type,
          description: item.description ?? null,
          dueDate: item.due,
          isCompleted: item.done ?? false,
          grade: item.grade ?? null,
        },
      });
      await tx.calendarEvent.create({
        data: {
          userId,
          title: assignment.title,
          description: assignment.description,
          startDate: assignment.dueDate,
          endDate: addHours(assignment.dueDate, 1),
          type: "assignment",
          color: classColors[item.cls],
          assignmentId: assignment.id,
        },
      });
    }

    for (const item of demoSessions) {
      const session = await tx.studySession.create({
        data: {
          userId,
          classId: item.cls ? classIds[item.cls] : null,
          title: item.title,
          topic: item.topic,
          studyType: item.type,
          scheduledDate: item.when,
          durationMinutes: item.minutes,
          isCompleted: item.done ?? false,
          notes: item.notes ?? null,
        },
      });
      await tx.calendarEvent.create({
        data: {
          userId,
          title: session.title,
          description: session.topic,
          startDate: session.scheduledDate,
          endDate: addMinutes(session.scheduledDate, session.durationMinutes),
          type: "study",
          color: item.cls ? classColors[item.cls] : "#8b5cf6",
          studySessionId: session.id,
        },
      });
    }

    for (const event of demoPersonalEvents) {
      await tx.calendarEvent.create({
        data: {
          userId,
          title: event.title,
          description: event.description ?? null,
          startDate: event.start,
          endDate: addHours(event.start, event.hours),
          type: "personal",
          color: event.color,
        },
      });
    }

    const chatStart = at(-1, 21);
    await tx.chatConversation.create({
      data: {
        userId,
        title: demoChat.title,
        createdAt: chatStart,
        messages: {
          create: demoChat.messages.map((message, index) => ({ ...message, createdAt: addMinutes(chatStart, index) })),
        },
      },
    });
  });

  return { id: user.id, email: user.email, name: user.name ?? DEMO_NAME };
}
