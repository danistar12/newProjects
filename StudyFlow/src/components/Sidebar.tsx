"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  BookMarked,
  BookOpenText,
  Brain,
  CalendarDays,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/types";

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Classes", href: "/classes", icon: BookMarked },
  { label: "Study Helper", href: "/study", icon: Brain },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = useMemo(() => {
    const name = session?.user?.name ?? session?.user?.email ?? "User";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [session]);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white shadow-xl ring-1 ring-slate-200 lg:shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <BookOpenText className="h-4 w-4" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">StudyFlow</p>
          </div>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-2 px-3 py-4">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
              onClick={() => setMobileOpen(false)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {session?.user?.name ?? "Student"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className="hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside className="hidden w-64 shrink-0 lg:block">
        {sidebarContent}
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white/95 p-2 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden" aria-label="Mobile navigation">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return <Link key={href} href={href} aria-label={label} title={label} className={cn("flex min-h-12 items-center justify-center rounded-xl", isActive ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100")}><Icon className="h-5 w-5" /></Link>;
        })}
      </nav>

      {mobileOpen ? (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden">
          <div className="h-full w-72 max-w-[85vw] bg-white shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      ) : null}
    </>
  );
}
