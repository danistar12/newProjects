import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface CardProps {
  title?: string;
  className?: string;
  children: ReactNode;
}

export default function Card({ title, className, children }: CardProps) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {title ? (
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </div>
  );
}
