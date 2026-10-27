"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bot, MessageSquareText, Plus, SendHorizontal, Trash2 } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import { useToast } from "@/components/ui/Toast";
import { cn, normalizeMathDelimiters } from "@/lib/utils";

interface ConversationSummary { id: string; title: string; updatedAt: string }
interface Message { id: string; role: "user" | "assistant"; content: string }

const suggestions = [
  "What's due this week, and what should I start first?",
  "Make me a study plan for my next exam.",
  "Explain a tricky concept from one of my classes.",
  "Quiz me with 3 questions on something I'm studying.",
];

// No typography plugin is installed, so style the markdown elements directly.
const markdownComponents: Components = {
  p: ({ node: _node, ...props }) => <p {...props} className="my-2 first:mt-0 last:mb-0" />,
  ul: ({ node: _node, ...props }) => <ul {...props} className="my-2 list-disc space-y-1 pl-5 marker:text-indigo-500" />,
  ol: ({ node: _node, ...props }) => <ol {...props} className="my-2 list-decimal space-y-1 pl-5 marker:text-indigo-500" />,
  h1: ({ node: _node, ...props }) => <h3 {...props} className="mb-1 mt-3 text-base font-bold text-slate-900" />,
  h2: ({ node: _node, ...props }) => <h3 {...props} className="mb-1 mt-3 text-base font-bold text-slate-900" />,
  h3: ({ node: _node, ...props }) => <h4 {...props} className="mb-1 mt-3 font-semibold text-slate-900" />,
  strong: ({ node: _node, ...props }) => <strong {...props} className="font-semibold text-slate-900" />,
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 underline" />,
  pre: ({ node: _node, ...props }) => <pre {...props} className="my-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100" />,
  code: ({ node: _node, className, ...props }) => <code {...props} className={cn(className ?? "rounded bg-slate-100 px-1 py-0.5 text-[0.85em] text-slate-800")} />,
  table: ({ node: _node, ...props }) => <div className="my-2 overflow-x-auto"><table {...props} className="w-full border-collapse text-left text-xs" /></div>,
  th: ({ node: _node, ...props }) => <th {...props} className="border border-slate-200 bg-slate-50 px-2 py-1 font-semibold" />,
  td: ({ node: _node, ...props }) => <td {...props} className="border border-slate-200 px-2 py-1" />,
};

export default function ChatPage() {
  const { toast: showToast } = useToast();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Temporary ids for messages shown before the server has saved them.
  const localIdRef = useRef(0);

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/chat");
    if (response.ok) setConversations(await response.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function openConversation(id: string) {
    if (isStreaming || id === activeId) return;
    setActiveId(id);
    setIsLoadingConversation(true);
    const response = await fetch(`/api/chat?id=${encodeURIComponent(id)}`);
    setIsLoadingConversation(false);
    if (!response.ok) {
      showToast("Unable to load that conversation.", "error");
      return;
    }
    const data = (await response.json()) as { messages: Message[] };
    setMessages(data.messages);
  }

  function startNewChat() {
    if (isStreaming) return;
    setActiveId(null);
    setMessages([]);
    inputRef.current?.focus();
  }

  async function deleteConversation(id: string) {
    const response = await fetch(`/api/chat?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) {
      showToast("Unable to delete that conversation.", "error");
      return;
    }
    setConversations((current) => current.filter((c) => c.id !== id));
    if (id === activeId) startNewChat();
  }

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    const localId = ++localIdRef.current;
    const assistantId = `assistant-${localId}`;
    setMessages((current) => [
      ...current,
      { id: `user-${localId}`, role: "user", content: message },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, message }),
      });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Unable to reach the assistant.");
      }

      const newId = response.headers.get("X-Conversation-Id");
      if (newId) setActiveId(newId);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        const content = reply;
        setMessages((current) => current.map((m) => (m.id === assistantId ? { ...m, content } : m)));
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to reach the assistant.", "error");
      setMessages((current) => current.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
      void loadConversations();
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  return (
    <div className="grid h-[calc(100vh-11rem)] min-h-112 gap-4 lg:h-[calc(100vh-9rem)] lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm lg:flex">
        <div className="border-b border-slate-200 p-3">
          <button type="button" onClick={startNewChat} disabled={isStreaming} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60">
            <Plus className="h-4 w-4" /> New chat
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {conversations.length === 0 ? <p className="px-2 py-4 text-center text-xs text-slate-500">Your conversations will appear here.</p> : null}
          {conversations.map((conversation) => (
            <div key={conversation.id} className={cn("group flex items-center gap-1 rounded-xl", conversation.id === activeId ? "bg-indigo-50" : "hover:bg-slate-50")}>
              <button type="button" onClick={() => void openConversation(conversation.id)} className="min-w-0 flex-1 px-3 py-2 text-left">
                <p className={cn("truncate text-sm", conversation.id === activeId ? "font-semibold text-indigo-700" : "text-slate-700")}>{conversation.title}</p>
                <p className="text-xs text-slate-400">{formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}</p>
              </button>
              <button type="button" onClick={() => void deleteConversation(conversation.id)} disabled={isStreaming} aria-label={`Delete ${conversation.title}`} className="mr-1 rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 p-3 lg:hidden">
          <select
            value={activeId ?? ""}
            onChange={(event) => (event.target.value ? void openConversation(event.target.value) : startNewChat())}
            disabled={isStreaming}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            aria-label="Conversation"
          >
            <option value="">New chat</option>
            {conversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.title}</option>)}
          </select>
          <button type="button" onClick={startNewChat} disabled={isStreaming} aria-label="New chat" className="rounded-xl bg-indigo-600 p-2 text-white disabled:opacity-60">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoadingConversation ? (
            <p className="text-center text-sm text-slate-500">Loading conversation...</p>
          ) : messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <MessageSquareText className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Ask your study assistant</h2>
              <p className="mt-1 text-sm text-slate-600">It knows your classes, assignments, and schedule, and can explain topics or plan your week.</p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => void sendMessage(suggestion)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm text-white">{message.content}</div>
                  </div>
                ) : (
                  <div key={message.id} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-md bg-slate-100 px-4 py-2.5 text-sm leading-relaxed text-slate-700">
                      {message.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
                          {normalizeMathDelimiters(message.content)}
                        </ReactMarkdown>
                      ) : (
                        <span className="flex gap-1 py-1.5" aria-label="Assistant is thinking">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                        </span>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(input);
          }}
          className="border-t border-slate-200 p-3 sm:p-4"
        >
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={4000}
              placeholder="Ask about your classes, deadlines, or any topic..."
              className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition field-sizing-content focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <button type="submit" disabled={isStreaming || !input.trim()} aria-label="Send message" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
              <SendHorizontal className="h-4 w-4" />
            </button>
          </div>
          <p className="mx-auto mt-1.5 max-w-3xl text-center text-xs text-slate-400">Enter to send, Shift+Enter for a new line. AI can make mistakes, so double-check important dates.</p>
        </form>
      </section>
    </div>
  );
}
