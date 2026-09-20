"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addDays,
  format,
  isBefore,
  isWithinInterval,
  parseISO,
} from "date-fns";
import {
  Check,
  ClipboardList,
  Edit3,
  GraduationCap,
  Plus,
  Trash2,
} from "lucide-react";

import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type ClassForm = {
  name: string;
  instructor: string;
  room: string;
  credits: string;
  color: string;
};
type AssignmentType =
  | "Homework"
  | "Quiz"
  | "Exam"
  | "Midterm"
  | "Final"
  | "Lab"
  | "Project"
  | "Discussion Post"
  | "Extra Credit"
  | "Other";
type AssignmentForm = {
  title: string;
  assignmentType: AssignmentType;
  description: string;
  dueDate: string;
  grade: string;
};
type AssignmentSort = "dueDate" | "type";

interface Assignment {
  id: string;
  classId: string;
  title: string;
  assignmentType: AssignmentType;
  description: string | null;
  dueDate: string;
  isCompleted: boolean;
  grade: string | null;
}

interface ClassRecord {
  id: string;
  name: string;
  color: string;
  instructor: string | null;
  room: string | null;
  credits: number | null;
  assignments: Assignment[];
}

const classColors = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#0ea5e9",
];
const emptyClassForm: ClassForm = {
  name: "",
  instructor: "",
  room: "",
  credits: "",
  color: classColors[0],
};
const assignmentTypes: AssignmentType[] = [
  "Homework",
  "Quiz",
  "Exam",
  "Midterm",
  "Final",
  "Lab",
  "Project",
  "Discussion Post",
  "Extra Credit",
  "Other",
];
const emptyAssignmentForm: AssignmentForm = {
  title: "",
  assignmentType: "Homework",
  description: "",
  dueDate: "",
  grade: "",
};

const assignmentTypeStyles: Record<AssignmentType, string> = {
  Homework: "bg-blue-100 text-blue-700",
  Quiz: "bg-green-100 text-green-700",
  Exam: "bg-red-100 text-red-700",
  Midterm: "bg-orange-100 text-orange-700",
  Final: "bg-purple-100 text-purple-700",
  Lab: "bg-cyan-100 text-cyan-700",
  Project: "bg-indigo-100 text-indigo-700",
  "Discussion Post": "bg-pink-100 text-pink-700",
  "Extra Credit": "bg-emerald-100 text-emerald-700",
  Other: "bg-slate-100 text-slate-700",
};

function dueDateTone(dueDate: string, completed: boolean) {
  if (completed) return "text-slate-400";
  const date = parseISO(dueDate);
  if (isBefore(date, new Date())) return "text-red-600";
  if (
    isWithinInterval(date, { start: new Date(), end: addDays(new Date(), 3) })
  )
    return "text-orange-600";
  return "text-slate-500";
}

function formatGrade(grade: string | null) {
  if (!grade) return null;
  return /^\d+(\.\d+)?$/.test(grade) ? `${grade}%` : grade;
}

function toDateTimeInput(value: string) {
  return format(parseISO(value), "yyyy-MM-dd'T'HH:mm");
}

export default function ClassesPage() {
  const { toast: showToast } = useToast();
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classForm, setClassForm] = useState<ClassForm>(emptyClassForm);
  const [assignmentForm, setAssignmentForm] =
    useState<AssignmentForm>(emptyAssignmentForm);
  const [editingClass, setEditingClass] = useState<ClassRecord | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(
    null,
  );
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [assignmentFilter, setAssignmentFilter] = useState<
    AssignmentType | "All"
  >("All");
  const [assignmentSort, setAssignmentSort] =
    useState<AssignmentSort>("dueDate");

  const selectedClass =
    classes.find((item) => item.id === selectedClassId) ?? null;
  const sortAssignments = (assignments: Assignment[]) =>
    [...assignments].sort((left, right) =>
      assignmentSort === "dueDate"
        ? parseISO(left.dueDate).getTime() - parseISO(right.dueDate).getTime()
        : (left.assignmentType ?? "Other").localeCompare(
            right.assignmentType ?? "Other",
          ) ||
          parseISO(left.dueDate).getTime() - parseISO(right.dueDate).getTime(),
    );
  const filterAssignments = (assignments: Assignment[]) =>
    sortAssignments(
      assignments.filter(
        (assignment) =>
          assignmentFilter === "All" ||
          (assignment.assignmentType ?? "Other") === assignmentFilter,
      ),
    );
  const upcoming = filterAssignments(
    selectedClass?.assignments.filter(
      (assignment) => !assignment.isCompleted,
    ) ?? [],
  );
  const completed = filterAssignments(
    selectedClass?.assignments.filter((assignment) => assignment.isCompleted) ??
      [],
  );
  const completedCount =
    selectedClass?.assignments.filter((assignment) => assignment.isCompleted)
      .length ?? 0;
  const totalCount = selectedClass?.assignments.length ?? 0;
  const completionPercentage = totalCount
    ? Math.round((completedCount / totalCount) * 100)
    : 0;

  const loadClasses = async (preferredId?: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/classes");
      if (!response.ok) throw new Error("Unable to load classes.");
      const result: ClassRecord[] = await response.json();
      setClasses(result);
      setSelectedClassId(
        (current) => preferredId ?? current ?? result[0]?.id ?? null,
      );
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load classes.";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const openClassModal = (classRecord?: ClassRecord) => {
    setError("");
    setEditingClass(classRecord ?? null);
    setClassForm(
      classRecord
        ? {
            name: classRecord.name,
            instructor: classRecord.instructor ?? "",
            room: classRecord.room ?? "",
            credits: classRecord.credits?.toString() ?? "",
            color: classRecord.color,
          }
        : emptyClassForm,
    );
    setClassModalOpen(true);
  };

  const openAssignmentModal = (assignment?: Assignment) => {
    if (!selectedClass) return;
    setError("");
    setEditingAssignment(assignment ?? null);
    setAssignmentForm(
      assignment
        ? {
            title: assignment.title,
            assignmentType: assignment.assignmentType ?? "Other",
            description: assignment.description ?? "",
            dueDate: toDateTimeInput(assignment.dueDate),
            grade: assignment.grade ?? "",
          }
        : {
            ...emptyAssignmentForm,
            dueDate: format(addDays(new Date(), 1), "yyyy-MM-dd'T'17:00"),
          },
    );
    setAssignmentModalOpen(true);
  };

  const submitClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!classForm.name.trim()) {
      setError("Class name is required.");
      return;
    }

    const response = await fetch(
      editingClass ? `/api/classes?id=${editingClass.id}` : "/api/classes",
      {
        method: editingClass ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...classForm,
          credits: classForm.credits || null,
        }),
      },
    );
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      const message = result?.error ?? "Unable to save class.";
      setError(message);
      showToast(message, "error");
      return;
    }

    const saved: ClassRecord = await response.json();
    setClassModalOpen(false);
    showToast(editingClass ? "Class updated." : "Class added.", "success");
    await loadClasses(saved.id);
  };

  const submitAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClass) return;
    setError("");
    if (!assignmentForm.title.trim()) {
      setError("Assignment title is required.");
      return;
    }
    if (!assignmentForm.dueDate) {
      setError("Due date is required.");
      return;
    }

    const response = await fetch(
      editingAssignment
        ? `/api/assignments?id=${editingAssignment.id}`
        : "/api/assignments",
      {
        method: editingAssignment ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...assignmentForm,
          classId: selectedClass.id,
          dueDate: new Date(assignmentForm.dueDate).toISOString(),
        }),
      },
    );
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      const message = result?.error ?? "Unable to save assignment.";
      setError(message);
      showToast(message, "error");
      return;
    }

    setAssignmentModalOpen(false);
    showToast(
      editingAssignment ? "Assignment updated." : "Assignment added.",
      "success",
    );
    await loadClasses(selectedClass.id);
  };

  const deleteClass = async (classRecord: ClassRecord) => {
    if (!window.confirm(`Delete ${classRecord.name} and its assignments?`))
      return;
    const response = await fetch(`/api/classes?id=${classRecord.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      showToast("Class deleted.", "success");
      setSelectedClassId(null);
      await loadClasses();
    }
  };

  const deleteAssignment = async (assignment: Assignment) => {
    if (!window.confirm(`Delete ${assignment.title}?`)) return;
    const response = await fetch(`/api/assignments?id=${assignment.id}`, {
      method: "DELETE",
    });
    if (response.ok && selectedClass) {
      showToast("Assignment deleted.", "success");
      await loadClasses(selectedClass.id);
    }
  };

  const toggleAssignment = async (assignment: Assignment) => {
    if (!selectedClass) return;
    await fetch(`/api/assignments?id=${assignment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: !assignment.isCompleted }),
    });
    showToast(
      assignment.isCompleted
        ? "Assignment marked upcoming."
        : "Assignment completed.",
      "success",
    );
    await loadClasses(selectedClass.id);
  };

  const statusLabel = useMemo(
    () => `${completedCount} of ${totalCount} complete`,
    [completedCount, totalCount],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Class Manager</h1>
        <p className="mt-1 text-sm text-slate-500">
          Keep your classes and coursework organized in one place.
        </p>
      </div>
      {error && !classModalOpen && !assignmentModalOpen ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {selectedClass ? (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="assignment-filter"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Filter
            </label>
            <select
              id="assignment-filter"
              value={assignmentFilter}
              onChange={(event) =>
                setAssignmentFilter(
                  event.target.value as AssignmentType | "All",
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="All">All types</option>
              {assignmentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="assignment-sort"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Sort
            </label>
            <select
              id="assignment-sort"
              value={assignmentSort}
              onChange={(event) =>
                setAssignmentSort(event.target.value as AssignmentSort)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="dueDate">Due date</option>
              <option value="type">Assignment type</option>
            </select>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading classes...
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <EmptyState
            icon={<GraduationCap className="h-6 w-6" />}
            title="No classes yet"
            description="Add your first class to get started."
            action={
              <Button onClick={() => openClassModal()}>
                <Plus className="mr-2 h-4 w-4" /> Add Class
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Your Classes</h2>
              <Button
                size="sm"
                onClick={() => openClassModal()}
                aria-label="Add class"
                title="Add class"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {classes.map((classRecord) => (
                <div
                  key={classRecord.id}
                  className={cn(
                    "group rounded-xl border p-3 transition",
                    selectedClassId === classRecord.id
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50",
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      setSelectedClassId(classRecord.id);
                      setCompletedOpen(false);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: classRecord.color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {classRecord.name}
                        </span>
                        <span className="mt-1 block truncate text-xs text-slate-500">
                          {classRecord.instructor || "No instructor"}
                        </span>
                        <span className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                          {classRecord.credits
                            ? `${classRecord.credits} credits`
                            : "Credits not set"}
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">
                            {classRecord.assignments.length}
                          </span>
                        </span>
                      </span>
                    </div>
                  </button>
                  <div className="mt-2 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => openClassModal(classRecord)}
                      aria-label={`Edit ${classRecord.name}`}
                      title="Edit class"
                      className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-indigo-600"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteClass(classRecord)}
                      aria-label={`Delete ${classRecord.name}`}
                      title="Delete class"
                      className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
            {selectedClass ? (
              <>
                <div className="border-b border-slate-200 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1 h-4 w-4 rounded-full"
                        style={{ backgroundColor: selectedClass.color }}
                      />
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">
                          {selectedClass.name}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          {[selectedClass.instructor, selectedClass.room]
                            .filter(Boolean)
                            .join(" · ") || "Class details not set"}
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => openAssignmentModal()}>
                      <Plus className="mr-2 h-4 w-4" /> Add Assignment
                    </Button>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Total assignments
                      </p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {totalCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Completed
                      </p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {completedCount}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
                        <span>Progress</span>
                        <span>{statusLabel}</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${completionPercentage}%`,
                            backgroundColor: selectedClass.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  {totalCount === 0 ? (
                    <EmptyState
                      icon={<ClipboardList className="h-6 w-6" />}
                      title="No assignments yet"
                      description="Add your first assignment to start tracking this class."
                      action={
                        <Button onClick={() => openAssignmentModal()}>
                          <Plus className="mr-2 h-4 w-4" /> Add your first
                          assignment
                        </Button>
                      }
                    />
                  ) : (
                    <div className="space-y-6">
                      <AssignmentGroup
                        title="Upcoming"
                        assignments={upcoming}
                        onToggle={toggleAssignment}
                        onEdit={openAssignmentModal}
                        onDelete={deleteAssignment}
                      />
                      <div>
                        <button
                          type="button"
                          onClick={() => setCompletedOpen((open) => !open)}
                          className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"
                        >
                          {completedOpen ? "Hide" : "Show"} Completed{" "}
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                            {completed.length}
                          </span>
                        </button>
                        {completedOpen ? (
                          <AssignmentGroup
                            title=""
                            assignments={completed}
                            onToggle={toggleAssignment}
                            onEdit={openAssignmentModal}
                            onDelete={deleteAssignment}
                          />
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </section>
        </div>
      )}

      <Modal
        open={classModalOpen}
        title={editingClass ? "Edit Class" : "Add Class"}
        onClose={() => setClassModalOpen(false)}
      >
        <form className="space-y-4" onSubmit={submitClass}>
          {error && classModalOpen ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <TextField
            label="Class Name *"
            value={classForm.name}
            onChange={(value) => setClassForm({ ...classForm, name: value })}
            required
          />
          <TextField
            label="Instructor"
            value={classForm.instructor}
            onChange={(value) =>
              setClassForm({ ...classForm, instructor: value })
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Room"
              value={classForm.room}
              onChange={(value) => setClassForm({ ...classForm, room: value })}
            />
            <TextField
              label="Credits"
              type="number"
              min="0"
              value={classForm.credits}
              onChange={(value) =>
                setClassForm({ ...classForm, credits: value })
              }
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Color</p>
            <div className="flex flex-wrap gap-3">
              {classColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use ${color} class color`}
                  onClick={() => setClassForm({ ...classForm, color })}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 border-transparent",
                    classForm.color === color &&
                      "ring-2 ring-slate-900 ring-offset-2",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <ModalActions
            onCancel={() => setClassModalOpen(false)}
            submitLabel={editingClass ? "Save Changes" : "Add Class"}
          />
        </form>
      </Modal>

      <Modal
        open={assignmentModalOpen}
        title={editingAssignment ? "Edit Assignment" : "Add Assignment"}
        onClose={() => setAssignmentModalOpen(false)}
      >
        <form className="space-y-4" onSubmit={submitAssignment}>
          {error && assignmentModalOpen ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <TextField
            label="Title *"
            value={assignmentForm.title}
            onChange={(value) =>
              setAssignmentForm({ ...assignmentForm, title: value })
            }
            required
          />
          <div>
            <label
              htmlFor="assignment-type"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Assignment Type *
            </label>
            <select
              id="assignment-type"
              required
              value={assignmentForm.assignmentType}
              onChange={(event) =>
                setAssignmentForm({
                  ...assignmentForm,
                  assignmentType: event.target.value as AssignmentType,
                })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Select a type</option>
              {assignmentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <TextAreaField
            label="Description"
            value={assignmentForm.description}
            onChange={(value) =>
              setAssignmentForm({ ...assignmentForm, description: value })
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Due Date"
              type="datetime-local"
              value={assignmentForm.dueDate}
              onChange={(value) =>
                setAssignmentForm({ ...assignmentForm, dueDate: value })
              }
              required
            />
            <TextField
              label="Grade"
              placeholder="A, B+, 94"
              value={assignmentForm.grade}
              onChange={(value) =>
                setAssignmentForm({ ...assignmentForm, grade: value })
              }
            />
          </div>
          <ModalActions
            onCancel={() => setAssignmentModalOpen(false)}
            submitLabel={editingAssignment ? "Save Changes" : "Add Assignment"}
          />
        </form>
      </Modal>
    </div>
  );
}

function AssignmentGroup({
  title,
  assignments,
  onToggle,
  onEdit,
  onDelete,
}: {
  title: string;
  assignments: Assignment[];
  onToggle: (assignment: Assignment) => void;
  onEdit: (assignment: Assignment) => void;
  onDelete: (assignment: Assignment) => void;
}) {
  return (
    <div>
      {title ? (
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h3>
      ) : null}
      {assignments.length ? (
        <div className="divide-y divide-slate-100">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="flex items-center gap-3 py-3">
              <button
                type="button"
                onClick={() => onToggle(assignment)}
                aria-label={
                  assignment.isCompleted
                    ? `Mark ${assignment.title} incomplete`
                    : `Mark ${assignment.title} complete`
                }
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                  assignment.isCompleted
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 hover:border-indigo-500",
                )}
              >
                {assignment.isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : null}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    assignment.isCompleted
                      ? "text-slate-400 line-through"
                      : "text-slate-800",
                  )}
                >
                  {assignment.title}
                </p>
                <span
                  className={cn(
                    "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    assignmentTypeStyles[assignment.assignmentType ?? "Other"],
                  )}
                >
                  {assignment.assignmentType ?? "Other"}
                </span>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    dueDateTone(assignment.dueDate, assignment.isCompleted),
                  )}
                >
                  {format(parseISO(assignment.dueDate), "MMM d, yyyy h:mm a")}
                </p>
              </div>
              {formatGrade(assignment.grade) ? (
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                  {formatGrade(assignment.grade)}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onEdit(assignment)}
                aria-label={`Edit ${assignment.title}`}
                title="Edit assignment"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
              >
                <Edit3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(assignment)}
                aria-label={`Delete ${assignment.title}`}
                title="Delete assignment"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No upcoming assignments.</p>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        type={type}
        required={required}
        min={min}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}

function ModalActions({
  onCancel,
  submitLabel,
}: {
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit">{submitLabel}</Button>
    </div>
  );
}
