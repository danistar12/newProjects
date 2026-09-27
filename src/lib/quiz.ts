import { createHash } from "crypto";

// Normalizes and hashes a question so repeat attempts on the same question
// (even with minor whitespace/casing differences) map to the same history row.
export function hashQuestion(userId: string, classId: string | null, topic: string, question: string) {
  const normalized = `${userId}|${classId ?? ""}|${topic.trim().toLowerCase()}|${question.trim().toLowerCase().replace(/\s+/g, " ")}`;
  return createHash("sha256").update(normalized).digest("hex");
}
