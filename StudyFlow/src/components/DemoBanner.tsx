"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { RotateCcw, Sparkles } from "lucide-react";

export default function DemoBanner() {
  const [isResetting, setIsResetting] = useState(false);

  async function handleReset() {
    setIsResetting(true);
    await signIn("demo", { redirect: false });
    // Full reload so every page refetches the freshly seeded data.
    window.location.reload();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 sm:px-6 lg:px-8">
      <p className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0" />
        You&apos;re exploring demo mode. Changes are saved but reset on the next demo sign-in.
      </p>
      <button
        type="button"
        onClick={handleReset}
        disabled={isResetting}
        className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
      >
        <RotateCcw className={`h-3.5 w-3.5 ${isResetting ? "animate-spin" : ""}`} />
        {isResetting ? "Resetting..." : "Reset demo data"}
      </button>
    </div>
  );
}
