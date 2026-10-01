import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Groq from "groq-sdk";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type StudyMode = "Practice Problems" | "Definitions" | "Flashcards" | "Study Guide Summary" | "Quiz Me" | "Key Concepts";
interface QuizQuestion { question: string; answer: string; explanation: string }

const modes = new Set<StudyMode>(["Practice Problems", "Definitions", "Flashcards", "Study Guide Summary", "Quiz Me", "Key Concepts"]);

const FRIENDLY_ERROR_MESSAGE = "Sorry, we couldn't generate your study session right now. Please try again in a moment.";
const FRIENDLY_QUIZ_ERROR: QuizQuestion[] = [{ question: FRIENDLY_ERROR_MESSAGE, answer: "", explanation: "" }];

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

const modeInstructions: Record<Exclude<StudyMode, "Quiz Me">, string> = {
  "Practice Problems":
    `Generate 5 completely unique, solvable practice problems. For EACH problem, use this exact structure with blank lines as shown:\n\n` +
    `### Problem 1\n\n` +
    `<the problem statement as its own paragraph>\n\n` +
    `<details>\n<summary><strong>Show Solution</strong></summary>\n\n` +
    `<step-by-step solution as a numbered list, ending with a bolded final answer>\n\n` +
    `</details>\n\n` +
    `Repeat this pattern for Problems 2 through 5, each genuinely different in setup and numbers.`,
  Definitions:
    `List 6 key terms for the topic. For EACH term, use this exact structure on a single line:\n\n` +
    `- **<Term Name>** — <a clear 1-3 sentence definition, with an example if helpful>\n\n` +
    `Repeat for all 6 terms, each as its own bullet point in the same format. Do not use "### " headings for this mode.`,
  Flashcards:
    `Generate 8 flashcards. For EACH flashcard, use this exact structure with blank lines as shown:\n\n` +
    `<details>\n<summary><strong>Front:</strong> <the question or term></summary>\n\n` +
    `**Back:** <the answer or definition>\n\n` +
    `</details>\n\n` +
    `Repeat this pattern for all 8 flashcards, each testing a different fact or concept.`,
  "Study Guide Summary":
    `Write a structured study guide with clear "### " headings for each major subtopic, bullet points for key facts, ` +
    `and bold text for important terms or formulas. Include a short worked example where relevant. Do not use <details> tags for this mode.`,
  "Key Concepts":
    `List the 5-7 most important concepts for this topic, ranked by priority. For EACH concept, use this exact structure:\n\n` +
    `### <Concept Name>\n\n` +
    `<a clear 1-3 sentence explanation of why it matters and how it's used>\n\n` +
    `Repeat for each concept.`,
};

function buildPrompt(className: string, studyType: Exclude<StudyMode, "Quiz Me">, topic: string) {
  return (
    `You are a knowledgeable, precise tutor for the college course "${className}". Generate a ${studyType} study set on the specific topic "${topic}". ` +
    `Everything you generate must be directly relevant to "${topic}" within "${className}" — do not drift to unrelated topics.\n\n` +
    `${modeInstructions[studyType]}\n\n` +
    `FORMATTING RULES (follow exactly):\n` +
    `- Output clean GitHub-flavored markdown only.\n` +
    `- Always put a blank line before and after every heading, list, and <details> block. Never run a heading directly into bold text or the next sentence.\n` +
    `- For inline math use single-dollar delimiters like $x^2 + 1$. For standalone equations use double-dollar delimiters like $$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$. Never use \\( \\), \\[ \\], or bare square brackets for math.\n` +
    `- Use "### " for each item's heading (not "#" or "##"), unless the pattern above specifies a different structure (e.g. bullet points) — in that case follow the pattern exactly.\n` +
    `- Use real <details> and <summary> HTML tags exactly as shown when the pattern calls for them, each on their own line with blank lines around the inner content so markdown still renders inside.\n` +
    `- Do not add any introduction, conclusion, or meta-commentary — output only the requested items.\n\n` +
    `Generate a fresh, unique set, different from any previous session. Seed: ${Math.random().toString(36).slice(2)}-${Date.now()}.`
  );
}

async function generateContent(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY is not set.");
    return FRIENDLY_ERROR_MESSAGE;
  }

  try {
    const groq = new Groq({ apiKey });
    const result = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
    });
    const text = result.choices[0]?.message?.content ?? "";
    return normalizeMathDelimiters(text.trim()) || FRIENDLY_ERROR_MESSAGE;
  } catch (error) {
    console.error("Groq generation failed:", error);
    return FRIENDLY_ERROR_MESSAGE;
  }
}

// Some models ignore the $/$$ instruction and use LaTeX's \(\)/\[\] delimiters instead,
// which remark-math doesn't recognize, so normalize them here regardless of what the model outputs.
function normalizeMathDelimiters(text: string): string {
  return text
    .replace(/\\\[/g, "$$$$")
    .replace(/\\\]/g, "$$$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");
}

async function getQuizHistory(userId: string, classId: string | null, topic: string) {
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId, classId, topic },
    orderBy: { lastSeenAt: "desc" },
    take: 40,
  });
  const mastered = attempts.filter((attempt) => attempt.lastResult && attempt.timesCorrect >= 1).slice(0, 8);
  const missed = attempts.filter((attempt) => !attempt.lastResult || attempt.timesIncorrect > attempt.timesCorrect).slice(0, 8);
  return { mastered, missed };
}

function buildQuizPrompt(className: string, topic: string, mastered: { question: string }[], missed: { question: string }[]) {
  const masteredList = mastered.length ? mastered.map((item) => `- ${item.question}`).join("\n") : "(none yet)";
  const missedList = missed.length ? missed.map((item) => `- ${item.question}`).join("\n") : "(none yet)";

  return (
    `You are a knowledgeable, precise tutor for the college course "${className}". Generate a Quiz Me study set on the specific topic "${topic}". ` +
    `Everything must be directly relevant to "${topic}" within "${className}" — do not drift to unrelated topics.\n\n` +
    `The student has already mastered these questions — mostly avoid repeating them verbatim, but a rare repeat is fine:\n${masteredList}\n\n` +
    `The student previously got these questions wrong — prioritize asking these again or similar questions testing the same idea:\n${missedList}\n\n` +
    `Generate exactly 5 quiz questions as a JSON object with one key, "questions", whose value is an array of 5 objects. ` +
    `Each object must have exactly these keys: "question" (the quiz question as a string), "answer" (the correct answer as a short string), and "explanation" (a 1-2 sentence explanation of why it's correct). ` +
    `For inline math use single-dollar delimiters like $x^2 + 1$. For standalone equations use double-dollar delimiters. Never use \\( \\), \\[ \\], or bare square brackets for math.\n` +
    `Output ONLY the raw JSON object — no markdown code fences, no commentary, no extra keys.\n\n` +
    `Generate a fresh, unique set. Seed: ${Math.random().toString(36).slice(2)}-${Date.now()}.`
  );
}

async function generateQuizQuestions(prompt: string): Promise<QuizQuestion[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY is not set.");
    return FRIENDLY_QUIZ_ERROR;
  }

  try {
    const groq = new Groq({ apiKey });
    const result = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const raw = result.choices[0]?.message?.content ?? "";
    const parsed = parseQuizJson(raw);
    if (!parsed) return FRIENDLY_QUIZ_ERROR;
    return parsed.map((item) => ({
      question: normalizeMathDelimiters(String(item.question ?? "").trim()),
      answer: normalizeMathDelimiters(String(item.answer ?? "").trim()),
      explanation: normalizeMathDelimiters(String(item.explanation ?? "").trim()),
    }));
  } catch (error) {
    console.error("Groq quiz generation failed:", error);
    return FRIENDLY_QUIZ_ERROR;
  }
}

function parseQuizJson(raw: string): QuizQuestion[] | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const data = JSON.parse(cleaned);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.questions)) return data.questions;
    return null;
  } catch (error) {
    console.error("Failed to parse quiz JSON:", error, cleaned);
    return null;
  }
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { className?: string; studyType?: StudyMode; topic?: string; classId?: string } | null;
  const className = body?.className?.trim();
  const studyType = body?.studyType;
  const topic = body?.topic?.trim();
  const classId = body?.classId ?? null;
  if (!className || !studyType || !modes.has(studyType)) return NextResponse.json({ error: "Class name and a valid study type are required." }, { status: 400 });
  if (!topic) return NextResponse.json({ error: "A topic is required to generate a study session." }, { status: 400 });

  if (studyType === "Quiz Me") {
    const { mastered, missed } = await getQuizHistory(userId, classId, topic);
    const prompt = buildQuizPrompt(className, topic, mastered, missed);
    const questions = await generateQuizQuestions(prompt);
    return NextResponse.json({ className, studyType, topic, generatedAt: new Date().toISOString(), questions });
  }

  const prompt = buildPrompt(className, studyType, topic);
  const content = await generateContent(prompt);

  return NextResponse.json({ className, studyType, topic, prompt, generatedAt: new Date().toISOString(), content });
}
