"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Edit3, Plus, Trash2, X } from "lucide-react";

import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type ViewMode = "month" | "week";
type EventType = "class" | "assignment" | "study" | "personal";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  type: EventType;
  color: string | null;
}

interface EventForm {
  title: string;
  type: EventType;
  startDate: string;
  endDate: string;
  description: string;
  color: string;
}

const colors = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Green", value: "#22c55e" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" },
  { name: "Sky", value: "#0ea5e9" },
];

const eventLabels: Record<EventType, string> = {
  class: "Class",
  assignment: "Assignment",
  study: "Study Session",
  personal: "Personal",
};

const blankForm: EventForm = {
  title: "",
  type: "personal",
  startDate: "",
  endDate: "",
  description: "",
  color: colors[0].value,
};

function toInputDateTime(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function getInitialForm(date = new Date()): EventForm {
  const start = new Date(date);
  start.setMinutes(0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    ...blankForm,
    startDate: toInputDateTime(start),
    endDate: toInputDateTime(end),
  };
}

function formatEventTime(event: CalendarEvent) {
  return `${format(parseISO(event.startDate), "MMM d, yyyy h:mm a")} - ${format(parseISO(event.endDate), "h:mm a")}`;
}

function eventOverlapsDay(event: CalendarEvent, day: Date) {
  const start = startOfDay(day).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  const eventStart = parseISO(event.startDate).getTime();
  const eventEnd = parseISO(event.endDate).getTime();
  return eventStart < end && eventEnd > start;
}

export default function CalendarPage() {
  const { toast: showToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<EventForm>(getInitialForm());
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);

  const monthStart = startOfMonth(currentDate);
  const monthDays = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(endOfMonth(currentDate)) }),
    [currentDate, monthStart],
  );
  const weekDays = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) }),
    [currentDate],
  );
  const visibleDays = view === "month" ? monthDays : weekDays;

  const loadEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/calendar?month=${format(currentDate, "yyyy-MM")}`);
      if (!response.ok) throw new Error("Unable to load calendar events.");
      setEvents(await response.json());
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load calendar events.";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [currentDate]);

  const eventsForDay = (day: Date) => events.filter((event) => eventOverlapsDay(event, day));

  const openCreate = (day = new Date()) => {
    setEditingEvent(null);
    setForm(getInitialForm(day));
    setSelectedEvent(null);
    setShowForm(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      type: event.type,
      startDate: toInputDateTime(parseISO(event.startDate)),
      endDate: toInputDateTime(parseISO(event.endDate)),
      description: event.description ?? "",
      color: event.color ?? colors[0].value,
    });
    setSelectedEvent(null);
    setShowForm(true);
  };

  const submitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    const startDate = new Date(form.startDate);
    const endDate = new Date(form.endDate);
    if (!form.startDate || !form.endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setError("Start and end dates are required.");
      return;
    }
    if (endDate <= startDate) {
      setError("End must be after start.");
      return;
    }

    const response = await fetch(editingEvent ? `/api/calendar?id=${editingEvent.id}` : "/api/calendar", {
      method: editingEvent ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, startDate: startDate.toISOString(), endDate: endDate.toISOString() }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      const message = result?.error ?? "Unable to save event.";
      setError(message);
      showToast(message, "error");
      return;
    }

    setShowForm(false);
    showToast(editingEvent ? "Event updated." : "Event created.", "success");
    await loadEvents();
  };

  const deleteEvent = async (event: CalendarEvent) => {
    if (!window.confirm(`Delete ${event.title}?`)) return;
    const response = await fetch(`/api/calendar?id=${event.id}`, { method: "DELETE" });
    if (response.ok) {
      showToast("Event deleted.", "success");
      setSelectedEvent(null);
      await loadEvents();
    }
  };

  const movePeriod = (direction: number) => {
    setCurrentDate((date) => (view === "month" ? (direction > 0 ? addMonths(date, 1) : subMonths(date, 1)) : direction > 0 ? addWeeks(date, 1) : subWeeks(date, 1)));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => movePeriod(-1)} aria-label="Previous period" title="Previous period">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => movePeriod(1)} aria-label="Next period" title="Next period">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h1 className="ml-2 text-xl font-bold text-slate-900">{format(currentDate, "MMMM yyyy")}</h1>
          <Button variant="secondary" size="sm" className="ml-2" onClick={() => setCurrentDate(new Date())}>Today</Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {(["month", "week"] as ViewMode[]).map((mode) => (
              <button key={mode} type="button" onClick={() => setView(mode)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium capitalize", view === mode ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
                {mode}
              </button>
            ))}
          </div>
          <Button onClick={() => openCreate()}>
            <Plus className="mr-2 h-4 w-4" /> Add Event
          </Button>
        </div>
      </div>

      {error && !showForm ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {view === "month" ? (
          <div className="grid grid-cols-7">
            {(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]).map((day) => <div key={day} className="border-b border-slate-200 px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{day}</div>)}
            {monthDays.map((day) => {
              const dayEvents = eventsForDay(day);
              const hiddenCount = dayEvents.length - 3;
              return (
                <button key={day.toISOString()} type="button" onClick={() => { setSelectedDay(day); setShowAllEvents(false); }} className={cn("min-h-32 border-b border-r border-slate-100 p-2 text-left align-top transition hover:bg-indigo-50/50", !isSameMonth(day, currentDate) && "bg-slate-50/70 text-slate-400")}>
                  <span className={cn("mb-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", isToday(day) && "bg-indigo-600 text-white", !isToday(day) && isSameMonth(day, currentDate) ? "text-slate-700" : "text-slate-400")}>{format(day, "d")}</span>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => <span key={event.id} onClick={(click) => { click.stopPropagation(); setSelectedEvent(event); }} className="block truncate rounded px-1.5 py-1 text-[11px] font-medium text-white" style={{ backgroundColor: event.color ?? colors[0].value }}>{event.title}</span>)}
                    {hiddenCount > 0 ? <span className="block px-1 text-[11px] font-semibold text-indigo-600" onClick={(click) => { click.stopPropagation(); setSelectedDay(day); setShowAllEvents(true); }}>+{hiddenCount} more</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[72px_repeat(7,minmax(110px,1fr))] border-b border-slate-200">
                <div />
                {weekDays.map((day) => <div key={day.toISOString()} className={cn("border-l border-slate-100 px-2 py-3 text-center", isToday(day) && "bg-indigo-50")}><p className="text-xs uppercase text-slate-500">{format(day, "EEE")}</p><p className={cn("mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", isToday(day) && "bg-indigo-600 text-white")}>{format(day, "d")}</p></div>)}
              </div>
              <div className="grid grid-cols-[72px_repeat(7,minmax(110px,1fr))]">
                <div className="relative h-[900px]">{Array.from({ length: 16 }, (_, index) => <span key={index} className="absolute right-2 text-[10px] text-slate-400" style={{ top: `${index * 60 - 7}px` }}>{format(new Date(2020, 0, 1, index + 7), "h a")}</span>)}</div>
                {weekDays.map((day) => <div key={day.toISOString()} className="relative h-[900px] border-l border-slate-100 bg-[linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[length:100%_60px]">{eventsForDay(day).map((event) => { const start = parseISO(event.startDate); const end = parseISO(event.endDate); const startMinutes = Math.max(0, start.getHours() * 60 + start.getMinutes() - 7 * 60); const duration = Math.max(30, (end.getTime() - start.getTime()) / 60000); return <button key={event.id} type="button" onClick={() => setSelectedEvent(event)} className="absolute left-1 right-1 overflow-hidden rounded-md p-1.5 text-left text-[11px] font-medium text-white shadow-sm" style={{ top: `${(startMinutes / 60) * 60}px`, height: `${Math.max(28, (duration / 60) * 60)}px`, backgroundColor: event.color ?? colors[0].value }}><span className="block truncate">{event.title}</span><span className="block truncate opacity-80">{format(start, "h:mm a")}</span></button>; })}</div>)}
              </div>
            </div>
          </div>
        )}
        {!loading && events.length === 0 ? <div className="border-t border-slate-100 p-4"><EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No events this month" description="Add an event to start filling your calendar." action={<Button size="sm" onClick={() => openCreate()}><Plus className="mr-2 h-4 w-4" /> Add Event</Button>} /></div> : null}
        {loading ? <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Updating calendar...</div> : null}
      </div>

      {selectedEvent ? <div className="fixed inset-0 z-40" onClick={() => setSelectedEvent(null)}><div className="absolute right-4 top-24 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{selectedEvent.title}</h3><span className="mt-2 inline-block rounded-full px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: selectedEvent.color ?? colors[0].value }}>{eventLabels[selectedEvent.type]}</span></div><button type="button" onClick={() => setSelectedEvent(null)} aria-label="Close event details"><X className="h-4 w-4 text-slate-400" /></button></div><p className="mt-3 flex gap-2 text-sm text-slate-600"><Clock3 className="h-4 w-4 shrink-0" />{formatEventTime(selectedEvent)}</p>{selectedEvent.description ? <p className="mt-3 text-sm text-slate-600">{selectedEvent.description}</p> : null}<div className="mt-4 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => openEdit(selectedEvent)}><Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit</Button><Button variant="outline" size="sm" className="text-red-600" onClick={() => deleteEvent(selectedEvent)}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete</Button></div></div></div> : null}

      <Modal open={!!selectedDay} title={selectedDay ? `Events on ${format(selectedDay, "MMMM d, yyyy")}` : ""} onClose={() => setSelectedDay(null)}>
        <div className="space-y-3">{selectedDay && eventsForDay(selectedDay).length ? eventsForDay(selectedDay).map((event) => <button key={event.id} type="button" onClick={() => { setSelectedDay(null); setSelectedEvent(event); }} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: event.color ?? colors[0].value }} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{event.title}</span><span className="block text-xs text-slate-500">{format(parseISO(event.startDate), "h:mm a")} · {eventLabels[event.type]}</span></span></button>) : <p className="text-sm text-slate-600">No events scheduled for this day.</p>}<Button className="w-full" onClick={() => { const day = selectedDay ?? new Date(); setSelectedDay(null); openCreate(day); }}><Plus className="mr-2 h-4 w-4" /> Add event for this day</Button></div>
      </Modal>

      <Modal open={showForm} title={editingEvent ? "Edit Event" : "Add Event"} onClose={() => setShowForm(false)}>
        <form className="space-y-4" onSubmit={submitEvent}>
          {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          <div><label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="event-title">Title *</label><input id="event-title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500" /></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="event-type">Type</label><select id="event-type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as EventType })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="class">Class</option><option value="assignment">Assignment</option><option value="study">Study Session</option><option value="personal">Personal</option></select></div>
          <div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="event-start">Start</label><input id="event-start" type="datetime-local" required value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div><div><label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="event-end">End</label><input id="event-end" type="datetime-local" required value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="event-description">Description</label><textarea id="event-description" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
          <div><p className="mb-2 text-sm font-medium text-slate-700">Color</p><div className="flex gap-3">{colors.map((color) => <button key={color.value} type="button" title={color.name} aria-label={color.name} onClick={() => setForm({ ...form, color: color.value })} className={cn("h-8 w-8 rounded-full border-2 border-transparent", form.color === color.value && "ring-2 ring-slate-900 ring-offset-2")} style={{ backgroundColor: color.value }} />)}</div></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit">{editingEvent ? "Save Changes" : "Create Event"}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
