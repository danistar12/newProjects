"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { addDays, endOfWeek, format, isBefore, isWithinInterval, parseISO, startOfDay, startOfWeek, subDays } from "date-fns";
import { Brain, Check, Clock3, Edit3, History, Pause, Play, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type SessionForm = { title: string; topic: string; scheduledDate: string; durationMinutes: string; notes: string; classId: string };
type StudyType = "Practice Problems" | "Definitions" | "Flashcards" | "Study Guide Summary" | "Quiz Me" | "Key Concepts";
interface StudySession { id: string; title: string; topic: string; studyType?: string; scheduledDate: string; durationMinutes: number; notes: string | null; isCompleted: boolean; classId: string | null; class: { id: string; name: string; color: string } | null }
interface ClassOption { id: string; name: string; color: string }
interface TimerState { isRunning: boolean; secondsRemaining: number; sessionTitle: string; startTimestamp: number | null; sessionId: string | null }
type GeneratedContent = string;

const storageKey = "studyflow-focus-timer";
const topicColors = ["bg-indigo-100 text-indigo-700", "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-orange-100 text-orange-700", "bg-sky-100 text-sky-700"];
const blankForm: SessionForm = { title: "", topic: "", scheduledDate: format(addDays(new Date(), 1), "yyyy-MM-dd'T'17:00"), durationMinutes: "25", notes: "", classId: "" };
const studyTypes: Array<{ name: StudyType; description: string; icon: string }> = [
  { name: "Practice Problems", description: "Work through five applied problems.", icon: "?" },
  { name: "Definitions", description: "Master the vocabulary that matters.", icon: "Aa" },
  { name: "Flashcards", description: "Flip through ten active-recall cards.", icon: "F" },
  { name: "Study Guide Summary", description: "Build a concise review guide.", icon: "S" },
  { name: "Quiz Me", description: "Answer one question at a time.", icon: "Q" },
  { name: "Key Concepts", description: "Prioritize the ideas to review.", icon: "K" },
];

function getTopicColor(topic: string) {
  return topicColors[topic.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % topicColors.length];
}

function getTopicPlaceholder(className: string) {
  const name = className.toLowerCase();
  if (/math|calc|algebra|trig|stat/.test(name)) return "e.g. Quadratic Equations, Trigonometry, Polynomials";
  if (/bio|chem|physic|science/.test(name)) return "e.g. Cell Division, Chemical Bonding, Newton's Laws";
  if (/hist/.test(name)) return "e.g. The Cold War, French Revolution, Industrial Revolution";
  if (/psych/.test(name)) return "e.g. Classical Conditioning, Cognitive Bias, Memory Models";
  if (/econ/.test(name)) return "e.g. Supply and Demand, Market Structures, Fiscal Policy";
  if (/comp|program|cs\b|software/.test(name)) return "e.g. Recursion, Sorting Algorithms, Data Structures";
  if (/english|lit|writing/.test(name)) return "e.g. Character Analysis, Thesis Statements, Literary Devices";
  return "e.g. Chapter 3 concepts, Midterm review topics, Key vocabulary";
}

function formatTimer(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function formatStudyTime(minutes: number) {
  return `${Math.floor(minutes / 60)} hrs ${minutes % 60} min`;
}

export default function StudyPage() {
  const { toast: showToast } = useToast();
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState<TimerState>({ isRunning: false, secondsRemaining: 25 * 60, sessionTitle: "Focus session", startTimestamp: null, sessionId: null });
  const [timerDuration, setTimerDuration] = useState(25);
  const [timerHydrated, setTimerHydrated] = useState(false);
  const [toast, setToast] = useState("");
  const [completedOpen, setCompletedOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [form, setForm] = useState<SessionForm>(blankForm);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStudyType, setSelectedStudyType] = useState<StudyType>("Flashcards");
  const [topicInput, setTopicInput] = useState("");
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiSessionStartedAt, setAiSessionStartedAt] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sessionResponse, classResponse] = await Promise.all([fetch("/api/study"), fetch("/api/classes")]);
      if (!sessionResponse.ok || !classResponse.ok) throw new Error("Unable to load study data.");
      setSessions(await sessionResponse.json());
      const classData = await classResponse.json();
      setClasses(classData.map((item: ClassOption) => ({ id: item.id, name: item.name, color: item.color })));
      setSelectedClassId((current) => current || classData[0]?.id || "");
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unable to load study data.";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        const saved = JSON.parse(stored) as TimerState & { durationMinutes?: number };
        const elapsed = saved.isRunning && saved.startTimestamp ? Math.floor((Date.now() - saved.startTimestamp) / 1000) : 0;
        const remaining = Math.max(0, saved.secondsRemaining - elapsed);
        setTimer({ ...saved, secondsRemaining: remaining, isRunning: saved.isRunning && remaining > 0 });
        if (saved.durationMinutes) setTimerDuration(saved.durationMinutes);
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    setTimerHydrated(true);
  }, []);

  useEffect(() => {
    if (!timerHydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ ...timer, durationMinutes: timerDuration }));
  }, [timer, timerDuration, timerHydrated]);

  useEffect(() => {
    if (!timer.isRunning) return;
    const interval = window.setInterval(() => {
      setTimer((current) => {
        if (current.secondsRemaining <= 1) {
          window.clearInterval(interval);
          finishTimer();
          return { ...current, secondsRemaining: 0, isRunning: false, startTimestamp: null };
        }
        return { ...current, secondsRemaining: current.secondsRemaining - 1 };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timer.isRunning]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const upcoming = useMemo(() => sessions.filter((session) => !session.isCompleted && !isBeforeToday(session.scheduledDate)), [sessions]);
  const completed = useMemo(() => sessions.filter((session) => session.isCompleted), [sessions]);
  const thisWeekCompleted = useMemo(() => sessions.filter((session) => session.isCompleted && isWithinInterval(parseISO(session.scheduledDate), { start: startOfWeek(new Date()), end: endOfWeek(new Date()) })), [sessions]);
  const streak = useMemo(() => calculateStreak(sessions), [sessions]);
  const circumference = 2 * Math.PI * 112;
  const timerProgress = Math.max(0, Math.min(1, timer.secondsRemaining / (timerDuration * 60)));
  const ringColor = timer.secondsRemaining <= 300 && timer.isRunning ? "#22c55e" : "#6366f1";

  function isBeforeToday(date: string) {
    return isBefore(parseISO(date), startOfDay(new Date()));
  }

  function finishTimer() {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.35);
    setToast("Session Complete!");
    showToast("Session Complete!", "success");
    void logAiSession();
  }

  async function logAiSession() {
    const selectedClass = classes.find((item) => item.id === selectedClassId);
    if (!selectedClass || !aiSessionStartedAt) return;
    const response = await fetch("/api/study", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: `${selectedStudyType} session`, topic: selectedClass.name, studyType: selectedStudyType, scheduledDate: new Date(aiSessionStartedAt).toISOString(), durationMinutes: timerDuration, classId: selectedClass.id, isCompleted: true }) });
    if (response.ok) {
      showToast("AI study session saved to your history.", "success");
      setAiSessionStartedAt(null);
      await fetchData();
    } else {
      showToast("The timer finished, but the session could not be saved.", "error");
    }
  }

  function startTimer() {
    if (selectedClassId && generated && !aiSessionStartedAt) setAiSessionStartedAt(Date.now());
    setTimer((current) => ({ ...current, isRunning: true, startTimestamp: Date.now() }));
  }

  function pauseTimer() {
    setTimer((current) => ({ ...current, isRunning: false, startTimestamp: null }));
  }

  function resetTimer() {
    setTimer((current) => ({ ...current, isRunning: false, secondsRemaining: timerDuration * 60, startTimestamp: null }));
  }

  function chooseDuration(minutes: number) {
    if (timer.isRunning) return;
    setTimerDuration(minutes);
    setTimer((current) => ({ ...current, secondsRemaining: minutes * 60 }));
  }

  function startSession(session: StudySession) {
    setTimerDuration(session.durationMinutes);
    setTimer({ isRunning: false, secondsRemaining: session.durationMinutes * 60, sessionTitle: session.title, startTimestamp: null, sessionId: session.id });
    window.setTimeout(startTimer, 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function generateStudySet(isRegenerate: boolean) {
    const selectedClass = classes.find((item) => item.id === selectedClassId);
    if (!selectedClass) {
      showToast("Select a class first.", "error");
      return;
    }
    if (!topicInput.trim()) {
      showToast("Enter a topic to study first.", "error");
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch("/api/study/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ className: selectedClass.name, studyType: selectedStudyType, topic: topicInput.trim() }) });
      if (!response.ok) throw new Error("Unable to generate the study session.");
      const result = await response.json();
      setGenerated(result.content);
      if (!isRegenerate) {
        const startedAt = Date.now();
        setAiSessionStartedAt(startedAt);
        setTimer((current) => ({ ...current, isRunning: true, startTimestamp: startedAt, sessionTitle: `${selectedStudyType} · ${selectedClass.name}`, sessionId: null }));
      }
      showToast(isRegenerate ? "Fresh set generated." : "Your AI study session is ready.", "success");
    } catch (generationError) {
      showToast(generationError instanceof Error ? generationError.message : "Unable to generate the study session.", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function startAiSession() {
    await generateStudySet(false);
  }

  async function regenerateStudySet() {
    await generateStudySet(true);
  }

  function openCreate() {
    setEditingSession(null);
    setForm({ ...blankForm, scheduledDate: format(addDays(new Date(), 1), "yyyy-MM-dd'T'17:00") });
    setError("");
    setFormOpen(true);
  }

  function openEdit(session: StudySession) {
    setEditingSession(session);
    setForm({ title: session.title, topic: session.topic, scheduledDate: format(parseISO(session.scheduledDate), "yyyy-MM-dd'T'HH:mm"), durationMinutes: String(session.durationMinutes), notes: session.notes ?? "", classId: session.classId ?? "" });
    setError("");
    setFormOpen(true);
  }

  async function submitSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.topic.trim()) { setError("Title and topic are required."); return; }
    const duration = Number(form.durationMinutes);
    if (!Number.isInteger(duration) || duration < 1) { setError("Duration must be at least 1 minute."); return; }
    const response = await fetch(editingSession ? `/api/study?id=${editingSession.id}` : "/api/study", { method: editingSession ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, durationMinutes: duration, scheduledDate: new Date(form.scheduledDate).toISOString(), classId: form.classId || null }) });
    if (!response.ok) { const result = await response.json().catch(() => null); const message = result?.error ?? "Unable to save session."; setError(message); showToast(message, "error"); return; }
    setFormOpen(false);
    showToast(editingSession ? "Study session updated." : "Study session scheduled.", "success");
    await fetchData();
  }

  async function toggleSession(session: StudySession) {
    await fetch(`/api/study?id=${session.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isCompleted: !session.isCompleted }) });
    showToast(session.isCompleted ? "Session marked upcoming." : "Session completed.", "success");
    await fetchData();
  }

  async function deleteSession(session: StudySession) {
    if (!window.confirm(`Delete ${session.title}?`)) return;
    const response = await fetch(`/api/study?id=${session.id}`, { method: "DELETE" });
    if (response.ok) showToast("Study session deleted.", "success");
    await fetchData();
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Study Helper</h1><p className="mt-1 text-sm text-slate-500">Plan focused study time, then make it count.</p></div>
      {error && !formOpen ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {toast ? <div className="fixed right-4 top-20 z-40 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg">{toast}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.35fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <label htmlFor="study-class" className="mb-2 block text-sm font-semibold text-slate-800">What class are you studying?</label>
            <select id="study-class" value={selectedClassId} onChange={(event) => { setSelectedClassId(event.target.value); setGenerated(null); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
              <option value="">Select a class</option>
              {classes.map((classRecord) => <option key={classRecord.id} value={classRecord.id}>{classRecord.name}</option>)}
            </select>
            <Button className="mt-4 w-full" onClick={startAiSession} disabled={generating || !selectedClassId || !topicInput.trim()}>{generating ? "Generating..." : "Start Session"}</Button>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">Choose a study type</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {studyTypes.map((studyType) => <button key={studyType.name} type="button" onClick={() => setSelectedStudyType(studyType.name)} className={cn("rounded-xl border p-3 text-left transition", selectedStudyType === studyType.name ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50")}><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-sm font-bold text-indigo-700">{studyType.icon}</span><span className="mt-2 block text-sm font-semibold text-slate-900">{studyType.name}</span><span className="mt-1 block text-xs text-slate-500">{studyType.description}</span></button>)}
            </div>
            <div className="mt-3">
              <label htmlFor="study-topic" className="mb-2 block text-sm font-semibold text-slate-800">What topic are you studying?</label>
              <input id="study-topic" required value={topicInput} onChange={(event) => setTopicInput(event.target.value)} placeholder={getTopicPlaceholder(classes.find((item) => item.id === selectedClassId)?.name ?? "")} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            </div>
          </div>
        </div>
      </section>

      {generated ? <GeneratedStudyPanel content={generated} regenerating={generating} onRegenerate={regenerateStudySet} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-6 text-white shadow-lg"><div className="flex items-center gap-2 text-sm font-semibold text-indigo-100"><Brain className="h-4 w-4" /> Focus Timer</div><div className="relative mx-auto mt-6 h-72 w-72 max-w-full"><svg className="h-full w-full -rotate-90" viewBox="0 0 256 256"><circle cx="128" cy="128" r="112" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="10" /><circle cx="128" cy="128" r="112" fill="none" stroke={ringColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - timerProgress)} className="transition-[stroke-dashoffset,stroke] duration-500" /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-6xl font-bold tracking-tight">{formatTimer(timer.secondsRemaining)}</span><span className="mt-2 text-xs uppercase tracking-[0.2em] text-indigo-100">{timer.isRunning ? "In focus" : "Ready"}</span></div></div><div className="mx-auto max-w-sm space-y-4"><input value={timer.sessionTitle} disabled={timer.isRunning} onChange={(event) => setTimer({ ...timer, sessionTitle: event.target.value })} className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center text-sm text-white placeholder:text-indigo-200 outline-none focus:border-white/60 disabled:opacity-70" placeholder="What are you studying?" /><div className="flex flex-wrap justify-center gap-2">{[25, 45, 60].map((minutes) => <button key={minutes} type="button" onClick={() => chooseDuration(minutes)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", timerDuration === minutes ? "border-white bg-white text-indigo-700" : "border-white/30 text-indigo-100 hover:bg-white/10")}>{minutes} min{minutes === 25 ? " · Pomodoro" : ""}</button>)}<label className={cn("flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold", ![25, 45, 60].includes(timerDuration) ? "border-white bg-white text-indigo-700" : "border-white/30 text-indigo-100")}><input type="number" min="1" max="240" value={![25, 45, 60].includes(timerDuration) ? timerDuration : ""} onChange={(event) => chooseDuration(Math.max(1, Number(event.target.value) || 1))} className="w-10 bg-transparent text-center outline-none" placeholder="Custom" /> min</label></div><div className="flex justify-center gap-3"><Button size="lg" className="min-w-28 bg-white text-indigo-700 hover:bg-indigo-50" onClick={timer.isRunning ? pauseTimer : startTimer}>{timer.isRunning ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}{timer.isRunning ? "Pause" : "Start"}</Button><Button size="lg" variant="ghost" className="border border-white/30 text-white hover:bg-white/10" onClick={resetTimer}><RotateCcw className="mr-2 h-4 w-4" /> Reset</Button></div></div></section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-bold text-slate-900">Session Planner</h2><p className="mt-1 text-sm text-slate-500">Upcoming sessions ready when you are.</p></div><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Schedule Study Session</Button></div><div className="mt-5">{loading ? <p className="text-sm text-slate-500">Loading sessions...</p> : upcoming.length ? <div className="grid gap-3 md:grid-cols-2">{upcoming.map((session) => <SessionCard key={session.id} session={session} onStart={startSession} onToggle={toggleSession} onEdit={openEdit} onDelete={deleteSession} />)}</div> : <EmptyState icon={<Sparkles className="h-6 w-6" />} title="No upcoming study sessions" description="Schedule your next focused block to keep momentum." action={<Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Schedule Session</Button>} />}</div><div className="mt-6 border-t border-slate-100 pt-4"><button type="button" onClick={() => setCompletedOpen((open) => !open)} className="flex items-center gap-2 text-sm font-semibold text-slate-700">{completedOpen ? "Hide" : "Show"} Completed Sessions <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{completed.length}</span></button>{completedOpen ? <div className="mt-3 space-y-2">{completed.length ? completed.map((session) => <SessionCard key={session.id} session={session} onStart={startSession} onToggle={toggleSession} onEdit={openEdit} onDelete={deleteSession} />) : <EmptyState icon={<History className="h-6 w-6" />} title="No completed sessions" description="Completed focus blocks will appear here." />}</div> : null}</div></section>
      </div>

      <section><div className="mb-3 flex items-center gap-2"><History className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-bold text-slate-900">Study Insights</h2></div><div className="grid gap-4 sm:grid-cols-3"><InsightCard label="Study time this week" value={formatStudyTime(thisWeekCompleted.reduce((total, session) => total + session.durationMinutes, 0))} /><InsightCard label="Sessions completed this week" value={String(thisWeekCompleted.length)} /><InsightCard label="Current study streak" value={`${streak} ${streak === 1 ? "day" : "days"}`} /></div></section>

      <Modal open={formOpen} title={editingSession ? "Edit Study Session" : "Schedule Study Session"} onClose={() => setFormOpen(false)}><form className="space-y-4" onSubmit={submitSession}>{error && formOpen ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}<TextField label="Session Title *" value={form.title} onChange={(value) => setForm({ ...form, title: value })} required /><TextField label="Topic / Subject *" value={form.topic} onChange={(value) => setForm({ ...form, topic: value })} required /><div className="grid gap-3 sm:grid-cols-2"><TextField label="Scheduled Date + Time" type="datetime-local" value={form.scheduledDate} onChange={(value) => setForm({ ...form, scheduledDate: value })} required /><TextField label="Duration (minutes)" type="number" min="1" value={form.durationMinutes} onChange={(value) => setForm({ ...form, durationMinutes: value })} required /></div><div><label className="mb-1 block text-sm font-medium text-slate-700">Class (optional)</label><select value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">No class</option>{classes.map((classRecord) => <option key={classRecord.id} value={classRecord.id}>{classRecord.name}</option>)}</select></div><TextArea label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit">{editingSession ? "Save Changes" : "Schedule Session"}</Button></div></form></Modal>
    </div>
  );
}

function SessionCard({ session, onStart, onToggle, onEdit, onDelete }: { session: StudySession; onStart: (session: StudySession) => void; onToggle: (session: StudySession) => void; onEdit: (session: StudySession) => void; onDelete: (session: StudySession) => void }) {
  return <article className={cn("rounded-xl border border-slate-200 p-4 transition hover:border-indigo-200 hover:shadow-sm", session.isCompleted && "bg-slate-50")}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className={cn("truncate text-sm font-semibold", session.isCompleted ? "text-slate-400 line-through" : "text-slate-900")}>{session.title}</h3><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", getTopicColor(session.topic))}>{session.topic}</span></div><p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{format(parseISO(session.scheduledDate), "EEE, MMM d · h:mm a")} · {session.durationMinutes} min</p><p className="mt-1 text-xs font-medium text-indigo-600">{session.studyType ?? "Focus Session"}</p>{session.class ? <p className="mt-1 text-xs" style={{ color: session.class.color }}>{session.class.name}</p> : null}</div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => onEdit(session)} aria-label={`Edit ${session.title}`} title="Edit session" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><Edit3 className="h-4 w-4" /></button><button type="button" onClick={() => onDelete(session)} aria-label={`Delete ${session.title}`} title="Delete session" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div></div><div className="mt-4 flex items-center justify-between gap-2"><button type="button" onClick={() => onToggle(session)} className={cn("flex h-5 w-5 items-center justify-center rounded border", session.isCompleted ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 hover:border-indigo-500")} aria-label={session.isCompleted ? "Mark session incomplete" : "Mark session complete"}>{session.isCompleted ? <Check className="h-3.5 w-3.5" /> : null}</button>{!session.isCompleted ? <Button size="sm" variant="outline" onClick={() => onStart(session)}><Play className="mr-1.5 h-3.5 w-3.5" /> Start Timer</Button> : <span className="text-xs font-medium text-emerald-600">Completed</span>}</div></article>;
}

function GeneratedStudyPanel({ content, regenerating, onRegenerate }: { content: GeneratedContent; regenerating: boolean; onRegenerate: () => void }) {
  return <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">AI Study Session</p><h2 className="mt-1 text-lg font-bold text-slate-900">Your study set</h2></div></div>
    <div className="prose prose-slate mt-5 max-w-none rounded-2xl border border-slate-200 bg-white p-5 prose-headings:font-bold prose-headings:text-slate-900 prose-strong:text-slate-900 prose-li:marker:text-indigo-500">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{content}</ReactMarkdown>
    </div>
    <div className="mt-4 flex justify-center border-t border-indigo-100 pt-4"><Button variant="outline" size="sm" onClick={onRegenerate} disabled={regenerating}><RotateCcw className="mr-2 h-4 w-4" /> {regenerating ? "Generating..." : "Generate New Set"}</Button></div>
  </section>;
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div>;
}

function TextField({ label, value, onChange, type = "text", required, min }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; min?: string }) {
  return <div><label className="mb-1 block text-sm font-medium text-slate-700">{label}</label><input type={type} required={required} min={min} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></div>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><label className="mb-1 block text-sm font-medium text-slate-700">{label}</label><textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></div>;
}

function calculateStreak(sessions: StudySession[]) {
  const completedDays = new Set(sessions.filter((session) => session.isCompleted).map((session) => format(parseISO(session.scheduledDate), "yyyy-MM-dd")));
  let cursor = startOfDay(new Date());
  if (!completedDays.has(format(cursor, "yyyy-MM-dd"))) cursor = subDays(cursor, 1);
  let count = 0;
  while (completedDays.has(format(cursor, "yyyy-MM-dd"))) {
    count += 1;
    cursor = subDays(cursor, 1);
  }
  return count;
}
