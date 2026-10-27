import { addDays, format, subDays } from "date-fns";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { streamChat, type ChatMessage } from "@/lib/ai";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Keeps the prompt inside a small local model's context window.
const HISTORY_LIMIT = 20;
const MAX_MESSAGE_LENGTH = 4000;

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function formatDate(date: Date) {
  return format(date, "EEE MMM d, h:mm a");
}

// Summarizes the student's classes and schedule so the assistant can answer
// questions like "what's due this week?" without any tool calls.
async function buildStudentContext(userId: string, name: string | null | undefined) {
  const now = new Date();
  const [classes, assignments, sessions, events] = await Promise.all([
    prisma.class.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.assignment.findMany({
      where: { class: { userId }, dueDate: { gte: subDays(now, 14), lte: addDays(now, 30) } },
      include: { class: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.studySession.findMany({
      where: { userId, scheduledDate: { gte: subDays(now, 7), lte: addDays(now, 14) } },
      include: { class: { select: { name: true } } },
      orderBy: { scheduledDate: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { userId, type: { in: ["personal", "class"] }, startDate: { gte: now, lte: addDays(now, 14) } },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const lines = [`Current date and time: ${format(now, "EEEE, MMMM d, yyyy h:mm a")}.`];
  if (name) lines.push(`Student name: ${name}.`);

  lines.push("", "CLASSES:");
  lines.push(...(classes.length
    ? classes.map((c) => `- ${c.name}${c.instructor ? ` (instructor: ${c.instructor})` : ""}${c.credits ? `, ${c.credits} credits` : ""}`)
    : ["- None added yet."]));

  lines.push("", "ASSIGNMENTS (past 2 weeks through next 30 days):");
  lines.push(...(assignments.length
    ? assignments.map((a) => {
        const status = a.isCompleted ? `completed${a.grade ? `, grade ${a.grade}` : ""}` : a.dueDate < now ? "OVERDUE, not completed" : "not completed";
        return `- [${a.class.name}] ${a.title} (${a.assignmentType}) due ${formatDate(a.dueDate)}: ${status}${a.description ? `. Notes: ${a.description}` : ""}`;
      })
    : ["- None."]));

  lines.push("", "STUDY SESSIONS (past week through next 2 weeks):");
  lines.push(...(sessions.length
    ? sessions.map((s) => `- ${s.title} on "${s.topic}"${s.class ? ` [${s.class.name}]` : ""}, ${s.studyType}, ${formatDate(s.scheduledDate)}, ${s.durationMinutes} min: ${s.isCompleted ? "done" : "planned"}`)
    : ["- None."]));

  lines.push("", "OTHER CALENDAR EVENTS (next 2 weeks):");
  lines.push(...(events.length ? events.map((e) => `- ${e.title}, ${formatDate(e.startDate)} to ${format(e.endDate, "h:mm a")}`) : ["- None."]));

  return lines.join("\n");
}

function buildSystemPrompt(studentContext: string) {
  return (
    "You are StudyFlow's AI study assistant, a friendly and encouraging tutor for a college student. " +
    "You help them understand course material, plan their study time, and stay on top of deadlines.\n\n" +
    "Guidelines:\n" +
    "- Use the student's data below to answer questions about their classes, deadlines, and schedule. Never invent assignments or dates that are not listed.\n" +
    "- When explaining concepts, be clear and concise, and use short examples. Check understanding when helpful.\n" +
    "- When asked for a study plan, base it on real due dates and suggest specific time blocks.\n" +
    "- Format responses in GitHub-flavored markdown. For math, use $...$ inline and $$...$$ for display equations.\n" +
    "- Keep answers focused. Prefer short paragraphs and bullet points over long walls of text.\n\n" +
    `STUDENT DATA:\n${studentContext}`
  );
}

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const conversation = await prisma.chatConversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { createdAt: "asc" }, select: { id: true, role: true, content: true, createdAt: true } } },
    });
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    return NextResponse.json(conversation);
  }

  const conversations = await prisma.chatConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });
  return NextResponse.json(conversations);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { conversationId?: string; message?: string } | null;
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ error: "A message is required." }, { status: 400 });
  if (message.length > MAX_MESSAGE_LENGTH) return NextResponse.json({ error: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters.` }, { status: 400 });

  let conversationId = body?.conversationId;
  if (conversationId) {
    const existing = await prisma.chatConversation.findFirst({ where: { id: conversationId, userId } });
    if (!existing) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  } else {
    const title = message.length > 60 ? `${message.slice(0, 57).trimEnd()}...` : message;
    conversationId = (await prisma.chatConversation.create({ data: { userId, title } })).id;
  }

  await prisma.chatMessage.create({ data: { conversationId, role: "user", content: message } });

  const history = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(await buildStudentContext(userId, session.user?.name)) },
    ...history.reverse().map((m) => ({ role: m.role as ChatMessage["role"], content: m.content })),
  ];

  const encoder = new TextEncoder();
  const savedConversationId = conversationId;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = "";
      try {
        for await (const chunk of streamChat(messages)) {
          reply += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        console.error("Chat generation failed:", error);
        const notice = "\n\n_Sorry, the assistant couldn't finish that response. Make sure the AI model is running and try again._";
        reply += notice;
        controller.enqueue(encoder.encode(notice));
      }
      // Save even partial replies so the conversation stays consistent.
      await prisma.chatMessage.create({ data: { conversationId: savedConversationId, role: "assistant", content: reply.trim() || "_No response._" } });
      await prisma.chatConversation.update({ where: { id: savedConversationId }, data: { updatedAt: new Date() } });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Conversation-Id": savedConversationId,
    },
  });
}

export async function DELETE(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "A conversation id is required." }, { status: 400 });

  const result = await prisma.chatConversation.deleteMany({ where: { id, userId } });
  if (result.count === 0) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
