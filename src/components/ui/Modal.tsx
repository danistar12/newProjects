import type { ReactNode } from "react";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}

export default function Modal({ open, title, children, onClose, className }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 sm:p-4">
      <div className={cn("h-full w-full overflow-y-auto border-slate-200 bg-white p-5 shadow-xl sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl sm:border sm:p-6", className)}>
        <div className="mb-4 flex items-center justify-between">
          {title ? <h3 className="text-lg font-semibold text-slate-900">{title}</h3> : <div />}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
