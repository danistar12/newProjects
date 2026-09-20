import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-500 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        {children}
      </div>
    </main>
  );
}
