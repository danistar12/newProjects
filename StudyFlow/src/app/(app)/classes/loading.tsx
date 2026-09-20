import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]"><Skeleton variant="card" className="h-96" /><Skeleton variant="card" className="h-96" /></div>;
}
