"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  BookMarked,
  Brain,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Clock3,
  ListTodo,
  Plus,
  Sparkles,
  Timer,
} from "lucide-react";

import Button from "@/components/ui/button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import type { DashboardStat } from "@/types";

interface DashboardData {
  stats: {
    classes: number;
    assignmentsDue: number;
    studySessionsThisWeek: number;
    completedStudyMinutesThisWeek: number;
    daysUntilNextExam: number;
  };
  upcomingAssignments: Array<{
    id: string;
    title: string;
    dueDate: string;
    className: string;
    classColor: string;
    classId: string;
  }>;
  upcomingEvents: Array<{
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    type: string;
    color: string;
  }>;
  todaysSchedule: Array<{
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    type: string;
    color: string;
  }>;
  todaysStudySessions: Array<{
    id: string;
    title: string;
    topic: string;
    scheduledDate: string;
    durationMinutes: number;
  }>;
}

const iconMap = {
  classes: BookMarked,
  assignments: ClipboardList,
  study: Brain,
  exam: CalendarCheck,
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<null | "assignment" | "study" | "event">(null);

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true);
      try {
        const response = await fetch("/api/dashboard");
        if (!response.ok) {
          return;
        }
        const json = await response.json();
        setData(json);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const stats: DashboardStat[] = data
    ? [
        { label: "Total Classes", value: data.stats.classes, icon: BookMarked, color: "bg-indigo-100 text-indigo-700" },
        { label: "Assignments Due", value: data.stats.assignmentsDue, icon: ClipboardList, color: "bg-orange-100 text-orange-700" },
        { label: "Study Sessions This Week", value: data.stats.studySessionsThisWeek, icon: Brain, color: "bg-violet-100 text-violet-700" },
        { label: "Study Time Logged", value: formatStudyTime(data.stats.completedStudyMinutesThisWeek), icon: Timer, color: "bg-sky-100 text-sky-700" },
        { label: "Days Until Next Exam", value: data.stats.daysUntilNextExam, icon: CalendarCheck, color: "bg-emerald-100 text-emerald-700" },
      ]
    : [
        { label: "Total Classes", value: "--", icon: BookMarked, color: "bg-indigo-100 text-indigo-700" },
        { label: "Assignments Due", value: "--", icon: ClipboardList, color: "bg-orange-100 text-orange-700" },
        { label: "Study Sessions This Week", value: "--", icon: Brain, color: "bg-violet-100 text-violet-700" },
        { label: "Study Time Logged", value: "--", icon: Timer, color: "bg-sky-100 text-sky-700" },
        { label: "Days Until Next Exam", value: "--", icon: CalendarCheck, color: "bg-emerald-100 text-emerald-700" },
      ];

  const getDueTone = (dueDate: string) => {
    const diffDays = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 2) return "text-red-600";
    if (diffDays <= 5) return "text-orange-600";
    return "text-slate-500";
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 p-6 text-white shadow-sm">
        <p className="text-sm font-medium text-indigo-100">{greeting}, {session?.user?.name ?? "Student"}!</p>
        <h1 className="mt-2 text-3xl font-bold">Here’s your study snapshot</h1>
        <p className="mt-2 text-sm text-indigo-100">{todayLabel}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", color)}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-2xl font-bold text-slate-900">{loading ? "--" : value}</span>
            </div>
            <p className="mt-3 text-sm text-slate-600">{label}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card title="Upcoming Assignments" className="h-full">
          <div className="flex items-center justify-between pb-4">
            <h3 className="text-base font-semibold text-slate-900">Next up</h3>
            <Link href="/classes" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              View All
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="animate-pulse rounded-xl bg-slate-100 p-4">
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-20 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : data?.upcomingAssignments.length ? (
            <div className="space-y-3">
              {data.upcomingAssignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: assignment.classColor }} />
                      <p className="truncate text-sm font-semibold text-slate-900">{assignment.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{assignment.className}</p>
                  </div>
                  <p className={cn("ml-3 text-xs font-medium", getDueTone(assignment.dueDate))}>
                    {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(assignment.dueDate))}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<ListTodo className="h-6 w-6" />}
              title="No upcoming assignments"
              description="You’re all caught up for now."
            />
          )}
        </Card>

        <Card title="Today’s Schedule" className="h-full">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((item) => (
                <div key={item} className="animate-pulse rounded-xl bg-slate-100 p-4">
                  <div className="h-4 w-24 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-20 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : data?.todaysSchedule.length ? (
            <div className="space-y-4">
              {data.todaysSchedule.map((event) => (
                <div key={event.id} className="flex gap-3">
                  <div className="w-1 rounded-full" style={{ backgroundColor: event.color }} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                        {event.type}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(event.startDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - {new Date(event.endDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No events today" description="Enjoy a clear schedule and use the time to recharge." />
          )}
        </Card>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Add Assignment", icon: ClipboardList, modal: "assignment" },
            { label: "Schedule Study Session", icon: Brain, modal: "study" },
            { label: "Add Class Event", icon: CalendarDays, modal: "event" },
          ].map(({ label, icon: Icon, modal }) => (
            <button
              key={label}
              type="button"
              onClick={() => setActiveModal(modal as "assignment" | "study" | "event")}
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </section>

      <Modal open={!!activeModal} title={activeModal ? "Quick Add" : ""} onClose={() => setActiveModal(null)}>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Title</label>
            <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Enter title" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Details</label>
            <textarea className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" rows={4} placeholder="Add details..." />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button onClick={() => setActiveModal(null)}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function formatStudyTime(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
