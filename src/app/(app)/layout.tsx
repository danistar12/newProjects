"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";
import Skeleton from "@/components/ui/Skeleton";

function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pageTitle = pathname === "/calendar" ? "Calendar" : pathname === "/classes" ? "Class Manager" : pathname === "/study" ? "Study Helper" : "Dashboard";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading...
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className={`${sidebarOpen ? "block" : "hidden"} fixed inset-0 z-30 bg-slate-900/40 lg:hidden`} />

      <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:static lg:block`}>
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={pageTitle} onMenuClick={() => setSidebarOpen((open) => !open)} />
        <main className="flex-1 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8"><Suspense fallback={<div className="space-y-4"><Skeleton variant="line" className="h-8 w-48" /><Skeleton variant="card" className="h-48" /></div>}>{children}</Suspense></main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </SessionProvider>
  );
}
