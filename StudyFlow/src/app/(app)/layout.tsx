"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";

import DemoBanner from "@/components/DemoBanner";
import Header from "@/components/Header";
import { isDemoEmail } from "@/lib/demo-account";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";
import Skeleton from "@/components/ui/Skeleton";

function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const pageTitle = pathname === "/calendar" ? "Calendar" : pathname === "/classes" ? "Class Manager" : pathname === "/study" ? "Study Helper" : pathname === "/chat" ? "AI Assistant" : "Dashboard";

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
      {/* Sidebar handles its own responsive layout: desktop column, mobile bottom nav. */}
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {isDemoEmail(session?.user?.email) ? <DemoBanner /> : null}
        <Header title={pageTitle} />
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
