import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return <div className="space-y-4"><Skeleton variant="line" className="h-10" /><Skeleton variant="card" className="h-[32rem]" /></div>;
}
