import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label className="block text-sm font-medium text-slate-700">{label}</label>
      ) : null}

      <input
        className={cn(
          "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100",
          error ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-100" : "",
          className,
        )}
        {...props}
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
