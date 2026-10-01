import type { LucideIcon } from "lucide-react";

export interface User {
  id: string;
  name?: string | null;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Class {
  id: string;
  userId: string;
  name: string;
  color: string;
  instructor?: string | null;
  room?: string | null;
  credits?: number | null;
  createdAt: Date;
}

export interface Assignment {
  id: string;
  classId: string;
  title: string;
  assignmentType?: string;
  description?: string | null;
  dueDate: Date;
  isCompleted: boolean;
  grade?: string | null;
  createdAt: Date;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  startDate: Date;
  endDate: Date;
  type: "class" | "assignment" | "study" | "personal";
  color?: string | null;
  createdAt: Date;
}

export interface StudySession {
  id: string;
  userId: string;
  classId?: string | null;
  title: string;
  topic: string;
  studyType?: string;
  scheduledDate: Date;
  durationMinutes: number;
  isCompleted: boolean;
  notes?: string | null;
  createdAt: Date;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface DashboardStat {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}

export interface FocusTimerState {
  isRunning: boolean;
  secondsRemaining: number;
  totalSeconds: number;
  sessionTitle: string;
}

export type { LucideIcon };
