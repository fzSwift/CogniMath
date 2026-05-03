import type { ReactNode } from "react";

export function Card({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <div id={id} className={["rounded-xl border border-slate-200 bg-white p-4 shadow-sm", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
