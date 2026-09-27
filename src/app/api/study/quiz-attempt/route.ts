import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hashQuestion } from "@/lib/quiz";

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { classId?: string; topic?: string; question?: string; isCorrect?: boolean } | null;
  const topic = body?.topic?.trim();
  const question = body?.question?.trim();
  const classId = body?.classId ?? null;
  const isCorrect = body?.isCorrect;
  if (!topic || !question || typeof isCorrect !== "boolean") {
    return NextResponse.json({ error: "Topic, question, and isCorrect are required." }, { status: 400 });
  }

  const questionHash = hashQuestion(userId, classId, topic, question);
  // findFirst (not findUnique) because the compound unique index can't be queried with a null classId.
  const existing = await prisma.quizAttempt.findFirst({
    where: { userId, classId, topic, questionHash },
  });

  if (existing) {
    await prisma.quizAttempt.update({
      where: { id: existing.id },
      data: {
        timesCorrect: existing.timesCorrect + (isCorrect ? 1 : 0),
        timesIncorrect: existing.timesIncorrect + (isCorrect ? 0 : 1),
        lastResult: isCorrect,
        lastSeenAt: new Date(),
      },
    });
  } else {
    await prisma.quizAttempt.create({
      data: {
        userId,
        classId,
        topic,
        question,
        questionHash,
        timesCorrect: isCorrect ? 1 : 0,
        timesIncorrect: isCorrect ? 0 : 1,
        lastResult: isCorrect,
      },
    });
  }

  return NextResponse.json({ success: true });
}
