import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]"><Skeleton variant="card" className="h-[34rem]" /><Skeleton variant="card" className="h-[34rem]" /></div>;
}
