import type { Metadata } from "next";

export const metadata: Metadata = { title: "Study Helper" };

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
