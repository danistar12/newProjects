import { cn } from "@/lib/utils";

interface SkeletonProps {
  variant?: "line" | "card" | "avatar";
  className?: string;
}

export default function Skeleton({ variant = "line", className }: SkeletonProps) {
  return <div aria-hidden="true" className={cn("animate-pulse bg-slate-200", variant === "line" && "h-4 w-full rounded", variant === "card" && "h-28 w-full rounded-xl", variant === "avatar" && "h-10 w-10 rounded-full", className)} />;
}
