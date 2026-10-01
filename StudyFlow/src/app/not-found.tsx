import Link from "next/link";

export default function NotFound() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="max-w-md text-center"><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">404</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Page not found</h1><p className="mt-2 text-sm text-slate-600">The page you requested does not exist.</p><Link href="/dashboard" className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Back to dashboard</Link></div></main>;
}
