import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface BadgeProps {
  color?: "indigo" | "green" | "amber" | "red" | "slate";
  children: ReactNode;
}

export default function Badge({ color = "indigo", children }: BadgeProps) {
  const colorMap = {
    indigo: "bg-indigo-100 text-indigo-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", colorMap[color])}>
      {children}
    </span>
  );
}
