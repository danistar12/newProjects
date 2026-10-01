import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return <div className="space-y-4"><Skeleton variant="card" className="h-36" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Skeleton variant="card" /><Skeleton variant="card" /><Skeleton variant="card" /><Skeleton variant="card" /></div></div>;
}
