// Finance service — tất cả công thức tài chính dùng chung
// Dùng cho Dashboard, P&L, Page, Campaign, Export

export function formatVND(n: number): string {
  if (n === 0) return "0 ₫";
  return n.toLocaleString("vi-VN") + " ₫";
}

export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + " tỷ";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "tr";
  if (Math.abs(n) >= 1e3) return Math.round(n / 1e3) + "k";
  return n.toLocaleString("vi-VN");
}

export function formatPercent(n: number | null): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return (n > 0 ? "+" : "") + n.toFixed(1) + "%";
}

export function formatROAS(n: number | null): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return n.toFixed(2) + "x";
}

export type FinanceMetrics = {
  adSpend: number;
  gmv: number;
  commission: number;
  orders: number;
  profit: number;
  roi: number | null;
  commissionRoas: number | null;
  gmvRoas: number | null;
  cpa: number | null;
};

export function calculateMetrics(
  adSpend: number,
  gmv: number,
  commission: number,
  orders: number,
): FinanceMetrics {
  const profit = commission - adSpend;
  const roi = adSpend > 0 ? (profit / adSpend) * 100 : null;
  const commissionRoas = adSpend > 0 ? commission / adSpend : null;
  const gmvRoas = adSpend > 0 ? gmv / adSpend : null;
  const cpa = orders > 0 ? adSpend / orders : null;

  return { adSpend, gmv, commission, orders, profit, roi, commissionRoas, gmvRoas, cpa };
}

export function profitStatus(profit: number, adSpend: number): "profit" | "loss" | "breakeven" | "no-data" {
  if (adSpend === 0 && profit === 0) return "no-data";
  if (profit > 0) return "profit";
  if (profit < 0) return "loss";
  return "breakeven";
}

export function profitColor(status: string): string {
  switch (status) {
    case "profit": return "#22c55e";
    case "loss": return "#ef4444";
    case "breakeven": return "#f59e0b";
    default: return "#6b7280";
  }
}

export function parseVNNumber(val: string): number {
  if (!val) return 0;
  const cleaned = val.toString().replace(/,/g, "").replace(/\s/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// Find column by partial match (case-insensitive)
export function findColumn(row: Record<string, unknown>, patterns: string[]): string {
  const keys = Object.keys(row);
  for (const pattern of patterns) {
    const p = pattern.toLowerCase();
    const found = keys.find(k => k.toLowerCase().includes(p));
    if (found && row[found] !== undefined && row[found] !== "") return String(row[found]);
  }
  return "";
}
