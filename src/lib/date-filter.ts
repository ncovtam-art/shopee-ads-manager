export type Period = "today" | "yesterday" | "7d" | "30d" | "this_month" | "last_month" | "all" | "custom";

export function getDateRange(period: Period, customFrom?: string, customTo?: string): { from: string | null; to: string | null; label: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (period) {
    case "today": return { from: fmt(now), to: fmt(now), label: "Hôm nay" };
    case "yesterday": { const y = new Date(now); y.setDate(y.getDate() - 1); return { from: fmt(y), to: fmt(y), label: "Hôm qua" }; }
    case "7d": { const d = new Date(now); d.setDate(d.getDate() - 7); return { from: fmt(d), to: fmt(now), label: "7 ngày" }; }
    case "30d": { const d = new Date(now); d.setDate(d.getDate() - 30); return { from: fmt(d), to: fmt(now), label: "30 ngày" }; }
    case "this_month": { const d = new Date(now.getFullYear(), now.getMonth(), 1); return { from: fmt(d), to: fmt(now), label: "Tháng này" }; }
    case "last_month": { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return { from: fmt(d), to: fmt(e), label: "Tháng trước" }; }
    case "custom": return { from: customFrom || null, to: customTo || null, label: "Tùy chỉnh" };
    default: return { from: null, to: null, label: "Tất cả" };
  }
}
