import type { ReactNode } from "react";
import { formatCompact } from "@/lib/finance";

export function FinanceTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: readonly { color?: string; name?: unknown; value?: unknown }[];
  label?: ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return <div className="glass-card rounded-lg px-3 py-2 text-[11px] shadow-xl border border-[var(--border)]">
    <div className="text-[var(--muted-foreground)] font-medium mb-1">{label}</div>
    {payload.map((item, index) => <div key={index} className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
      <span className="text-[var(--muted-foreground)]">{String(item.name ?? "")}:</span>
      <span className="font-mono font-semibold">{Number.isFinite(Number(item.value)) ? formatCompact(Number(item.value)) : "—"}</span>
    </div>)}
  </div>;
}
