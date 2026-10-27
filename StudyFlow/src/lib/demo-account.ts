// Client-safe demo constants. Seeding logic lives in "@/lib/demo" (server only).
export const DEMO_EMAIL = "demo@studyflow.app";
export const DEMO_NAME = "Demo Student";

export function isDemoEmail(email?: string | null) {
  return email?.toLowerCase() === DEMO_EMAIL;
}
