"use client";
import { useState, useEffect } from "react";
import { BarChart3, Download, RefreshCw, Search, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCompact } from "@/lib/finance";

type PagePnl = { name: string; adSpend: number; gmv: number; commission: number; orders: number; profit: number; roi: number|null; roas: number|null };
type SortKey = "name" | "adSpend" | "commission" | "profit" | "roi";

export default function ReportsPage() {
  const supabase = createClient();
  const [data, setData] = useState<PagePnl[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("profit");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [filterStatus, setFilterStatus] = useState<"all"|"profit"|"loss">("all");

  useEffect(() => { fetchPnl(); }, []);

  const fetchPnl = async () => {
    setLoading(true);
    const { data: summaryData } = await supabase.rpc("get_page_summary");
    if (summaryData) {
      const rows: PagePnl[] = summaryData.map((s: any) => {
        const ad = Number(s.total_ad_spend); const gmv = Number(s.total_gmv); const comm = Number(s.total_commission); const orders = Number(s.total_orders);
        const profit = comm - ad;
        return { name: s.page_name, adSpend: ad, gmv, commission: comm, orders, profit, roi: ad > 0 ? Math.round((profit / ad) * 1000) / 10 : null, roas: ad > 0 ? Math.round((comm / ad) * 100) / 100 : null };
      });
      setData(rows);
    }
    setLoading(false);
  };

  const filtered = data.filter(r => { if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false; if (filterStatus === "profit" && r.profit <= 0) return false; if (filterStatus === "loss" && r.profit >= 0) return false; return true; })
    .sort((a, b) => { const av = a[sortBy] ?? -Infinity; const bv = b[sortBy] ?? -Infinity; if (typeof av === "string" && typeof bv === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av); return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number); });

  const totals = filtered.reduce((a, r) => ({ ad: a.ad + r.adSpend, gmv: a.gmv + r.gmv, comm: a.comm + r.commission, orders: a.orders + r.orders, profit: a.profit + r.profit }), { ad: 0, gmv: 0, comm: 0, orders: 0, profit: 0 });
  const totalRoi = totals.ad > 0 ? Math.round(((totals.comm - totals.ad) / totals.ad) * 1000) / 10 : 0;
  const toggleSort = (key: SortKey) => { if (sortBy === key) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortBy(key); setSortDir("desc"); } };
  const profitCount = data.filter(r => r.profit > 0).length;
  const lossCount = data.filter(r => r.profit < 0).length;

  const exportCsv = () => {
    const h = ["Page","Chi Ads","GMV","Hoa hồng","Đơn","Lợi nhuận","ROI%","ROAS"];
    const rows = filtered.map(r => [r.name, r.adSpend, r.gmv, r.commission, r.orders, r.profit, r.roi ?? "", r.roas ?? ""]);
    const csv = [h, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `pnl-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4"><div><h1 className="text-lg font-bold">Báo cáo P&L</h1><p className="text-xs text-[var(--muted-foreground)] mt-0.5">Tổng hợp theo Page</p></div>
        <div className="flex items-center gap-1.5"><button onClick={fetchPnl} className="p-1.5 rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"><RefreshCw size={12} /></button><button onClick={exportCsv} disabled={!filtered.length} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[var(--accent)] text-white text-[11px] font-semibold hover:opacity-90 disabled:opacity-50"><Download size={11} /> CSV</button></div></div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-3">
        {[{ l: "CHI ADS", v: formatCompact(totals.ad), c: "#ef4444" }, { l: "GMV", v: formatCompact(totals.gmv), c: "#3b82f6" }, { l: "HOA HỒNG", v: formatCompact(totals.comm), c: "#6366f1" }, { l: "LỢI NHUẬN", v: formatCompact(totals.profit), c: totals.profit >= 0 ? "#22c55e" : "#ef4444" }, { l: "ROI", v: totalRoi + "%", c: totalRoi >= 0 ? "#22c55e" : "#ef4444" }].map((m, i) => (
          <div key={i} className="glass-card rounded-lg p-3 border border-[var(--border)]"><div className="text-[10px] text-[var(--muted-foreground)] mb-0.5">{m.l}</div><div className="font-mono text-lg font-bold" style={{ color: m.c }}>{m.v}</div></div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-0.5 glass-card border border-[var(--border)] rounded-md p-0.5">
          {[{k:"all" as const, l:`Tất cả (${data.length})`}, {k:"profit" as const, l:`Lãi (${profitCount})`}, {k:"loss" as const, l:`Lỗ (${lossCount})`}].map(f => (
            <button key={f.k} onClick={() => setFilterStatus(f.k)} className={`px-2.5 py-1 rounded text-[10px] font-medium ${filterStatus===f.k?"bg-[var(--accent)] text-white":"text-[var(--muted-foreground)]"}`}>{f.l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 glass-card border border-[var(--border)] rounded-md px-2 py-1.5 flex-1 max-w-xs"><Search size={11} className="text-[var(--muted-foreground)]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm page..." className="bg-transparent text-xs outline-none flex-1" /></div>
      </div>

      {loading ? <div className="glass-card rounded-xl border border-[var(--border)] p-8 text-center text-xs text-[var(--muted-foreground)]">Đang tải...</div> : filtered.length === 0 ? <div className="glass-card rounded-xl border border-[var(--border)] p-8 text-center"><BarChart3 size={24} className="text-[var(--muted-foreground)] mx-auto mb-2" /><div className="text-xs text-[var(--muted-foreground)]">Chưa có dữ liệu.</div></div> : (
        <div className="glass-card rounded-2xl border border-[var(--border)] overflow-hidden"><div className="overflow-x-auto">
          <table className="w-full min-w-[750px]"><thead><tr className="border-b border-[var(--border)]">
            {[{k:"name" as SortKey,l:"PAGE",a:"left"},{k:null,l:"CHI ADS",a:"right"},{k:null,l:"GMV",a:"right"},{k:"commission" as SortKey,l:"HOA HỒNG",a:"right"},{k:null,l:"ĐƠN",a:"right"},{k:"profit" as SortKey,l:"LỢI NHUẬN",a:"right"},{k:"roi" as SortKey,l:"ROI",a:"right"},{k:null,l:"ROAS",a:"right"}].map((col,i) => (
              <th key={i} onClick={() => col.k && toggleSort(col.k)} className={`px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase ${col.a==="right"?"text-right":"text-left"} ${col.k?"cursor-pointer hover:text-[var(--foreground)]":""}`}>{col.l}{col.k===sortBy&&(sortDir==="desc"?" ↓":" ↑")}</th>
            ))}
          </tr></thead><tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-b border-[var(--border)] row-hover"><td className="px-3 py-2"><div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${r.profit>0?"bg-green-400":r.profit<0?"bg-red-400":"bg-gray-400"}`} /><span className="text-xs font-medium">{r.name}</span></div></td><td className="px-3 py-2 text-right font-mono text-xs text-red-400">{r.adSpend>0?formatCompact(r.adSpend):"—"}</td><td className="px-3 py-2 text-right font-mono text-xs">{r.gmv>0?formatCompact(r.gmv):"—"}</td><td className="px-3 py-2 text-right font-mono text-xs text-indigo-400">{r.commission>0?formatCompact(r.commission):"—"}</td><td className="px-3 py-2 text-right font-mono text-xs text-[var(--muted-foreground)]">{r.orders||"—"}</td><td className="px-3 py-2 text-right"><span className={`font-mono text-xs font-bold ${r.profit>0?"text-green-400":r.profit<0?"text-red-400":"text-[var(--muted-foreground)]"}`}>{r.profit!==0?(r.profit>0?"+":"")+formatCompact(r.profit):"—"}</span></td><td className="px-3 py-2 text-right">{r.roi!=null?<span className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${r.roi>=0?"bg-green-500/10 text-green-400":"bg-red-500/10 text-red-400"}`}>{r.roi>0?"+":""}{r.roi}%</span>:<span className="text-[10px] text-[var(--muted-foreground)]">—</span>}</td><td className="px-3 py-2 text-right font-mono text-[10px] text-[var(--muted-foreground)]">{r.roas!=null?r.roas.toFixed(2)+"x":"—"}</td></tr>
            ))}
          </tbody><tfoot><tr className="border-t-2 border-[var(--border)] bg-[var(--muted)]"><td className="px-3 py-2 text-xs font-bold">TỔNG ({filtered.length})</td><td className="px-3 py-2 text-right font-mono text-xs font-bold text-red-400">{formatCompact(totals.ad)}</td><td className="px-3 py-2 text-right font-mono text-xs font-bold">{formatCompact(totals.gmv)}</td><td className="px-3 py-2 text-right font-mono text-xs font-bold text-indigo-400">{formatCompact(totals.comm)}</td><td className="px-3 py-2 text-right font-mono text-xs font-bold">{totals.orders}</td><td className="px-3 py-2 text-right font-mono text-xs font-bold" style={{ color: totals.profit>=0?"#22c55e":"#ef4444" }}>{totals.profit>0?"+":""}{formatCompact(totals.profit)}</td><td className="px-3 py-2 text-right"><span className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${totalRoi>=0?"bg-green-500/10 text-green-400":"bg-red-500/10 text-red-400"}`}>{totalRoi>0?"+":""}{totalRoi}%</span></td><td /></tr></tfoot>
          </table></div>
          <div className="px-3 py-2 border-t border-[var(--border)] text-[10px] text-[var(--muted-foreground)] text-right">© 2026 Minh Tâm · 0877 260 675</div>
        </div>
      )}
    </div>
  );
}
