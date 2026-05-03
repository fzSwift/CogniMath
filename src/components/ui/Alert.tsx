import type { ReactNode } from "react";

export function Alert({ variant, children }: { variant: "error" | "info"; children: ReactNode }) {
  const styles =
    variant === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-slate-200 bg-slate-50 text-slate-700";
  return <div className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}
