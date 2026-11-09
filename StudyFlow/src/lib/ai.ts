import Groq from "groq-sdk";

// Shared LLM access for the study generator and the chat assistant.
// Defaults to a free local model served by Ollama (https://ollama.com).
// Set AI_PROVIDER="groq" (plus GROQ_API_KEY) to use Groq's hosted models instead.

export type ChatRole = "system" | "user" | "assistant";
export interface ChatMessage { role: ChatRole; content: string }

const provider = process.env.AI_PROVIDER === "groq" ? "groq" : "ollama";
const ollamaUrl = (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/$/, "");
const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3";
const groqModel = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set.");
  return new Groq({ apiKey });
}

async function ollamaRequest(messages: ChatMessage[], options: { stream: boolean; json?: boolean }) {
  let response: Response;
  try {
    response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        messages,
        stream: options.stream,
        ...(options.json ? { format: "json" } : {}),
        options: { num_ctx: 8192 },
      }),
    });
  } catch {
    throw new Error(`Could not reach Ollama at ${ollamaUrl}. Is the Ollama app running?`);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Ollama request failed (${response.status}): ${detail}`);
  }
  return response;
}

// Returns the full response text.
export async function complete(messages: ChatMessage[], options: { json?: boolean } = {}): Promise<string> {
  if (provider === "groq") {
    const result = await getGroq().chat.completions.create({
      model: groqModel,
      messages,
      ...(options.json ? { response_format: { type: "json_object" as const } } : {}),
    });
    return result.choices[0]?.message?.content ?? "";
  }

  const response = await ollamaRequest(messages, { stream: false, json: options.json });
  const data = (await response.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}

// Yields response text in chunks as the model produces it.
export async function* streamChat(messages: ChatMessage[]): AsyncGenerator<string> {
  if (provider === "groq") {
    const stream = await getGroq().chat.completions.create({ model: groqModel, messages, stream: true });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
    return;
  }

  // Ollama streams newline-delimited JSON objects.
  const response = await ollamaRequest(messages, { stream: true });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const data = JSON.parse(line) as { message?: { content?: string }; error?: string };
      if (data.error) throw new Error(data.error);
      if (data.message?.content) yield data.message.content;
    }
  }
}
