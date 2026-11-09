import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Some models ignore the $/$$ instruction and use LaTeX's \(\)/\[\] delimiters instead,
// which remark-math doesn't recognize, so normalize them here regardless of what the model outputs.
export function normalizeMathDelimiters(text: string): string {
  return text
    .replace(/\\\[/g, "$$$$")
    .replace(/\\\]/g, "$$$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");
}
