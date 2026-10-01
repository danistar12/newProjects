"use client";

import { Menu } from "lucide-react";

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  const currentDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button type="button" className="hidden" onClick={onMenuClick} aria-label="Toggle sidebar"><Menu className="h-5 w-5" /></button>

          <div>
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-slate-500 sm:inline">{currentDate}</span>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
            SF
          </div>
        </div>
      </div>
    </header>
  );
}
