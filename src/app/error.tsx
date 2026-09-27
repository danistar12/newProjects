"use client";

import { useEffect } from "react";

import Button from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("StudyFlow application error", error);
  }, []);

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="max-w-md text-center"><h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1><p className="mt-2 text-sm text-slate-600">StudyFlow could not finish loading this page.</p><Button className="mt-6" onClick={() => reset()}>Try again</Button></div></main>;
}
