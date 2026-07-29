"use client";
import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, BarChart3, Download, RefreshCw, Search, AlertTriangle } from "lucide-react";
import { formatCompact, formatVND } from "@/lib/finance";

import { createClient } from "@/lib/supabase";

type CampaignPnl = {
  campaignName: string; pageCode: string; adSpend: number; gmv: number;
  commission: number; orders: number; profit: number; roi: number | null; roas: number | null;
};
type SortKey = "campaignName" | "adSpend" | "commission" | "profit" | "roi";

export default function ReportsPage() {
  const supabase = createClient();
  const [data, setData] = useState<CampaignPnl[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("profit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterStatus, setFilterStatus] = useState<"all" | "profit" | "loss">("all");
  const [period, setPeriod] = useState("30d");

  useEffect(() => { fetchPnl(); }, [period]);

  const fetchPnl = async () => {
    setLoading(true);

    // Fetch with page_id + page name
    const { data: fbRaw } = await supabase.from("fb_ads_data").select("campaign_name, ad_spend, page_id");
    const { data: shopeeRaw } = await supabase.from("shopee_affiliate_data").select("sub_id1, sub_id2, order_value, net_commission, page_id");
    const { data: pagesData } = await supabase.from("pages").select("id, name");

    // Page name map
    const pageNameMap = new Map<string, string>();
    pagesData?.forEach(p => pageNameMap.set(p.id, p.name));

    // FB by campaign — also track page_id
    const fbMap = new Map<string, { spend: number; pageId: string }>();
    fbRaw?.forEach(r => {
      const ex = fbMap.get(r.campaign_name) || { spend: 0, pageId: "" };
      ex.spend += Number(r.ad_spend || 0);
      if (r.page_id && !ex.pageId) ex.pageId = r.page_id;
      fbMap.set(r.campaign_name, ex);
    });

    // Shopee by sub_id2 — also track page_id
    const shopeeMap = new Map<string, { pageId: string; gmv: number; comm: number; orders: number }>();
    shopeeRaw?.forEach(r => {
      const key = r.sub_id2 || "__none__";
      const ex = shopeeMap.get(key) || { pageId: "", gmv: 0, comm: 0, orders: 0 };
      ex.gmv += Number(r.order_value || 0);
      ex.comm += Number(r.net_commission || 0);
      ex.orders += 1;
      if (r.page_id && !ex.pageId) ex.pageId = r.page_id;
      shopeeMap.set(key, ex);
    });

    const allKeys = new Set([...fbMap.keys(), ...shopeeMap.keys()]);
    allKeys.delete("__none__");
    const campaigns: CampaignPnl[] = Array.from(allKeys).map(name => {
      const fb = fbMap.get(name) || { spend: 0, pageId: "" };
      const s = shopeeMap.get(name) || { pageId: "", gmv: 0, comm: 0, orders: 0 };
      const spend = fb.spend;
      const profit = s.comm - spend;
      const pageId = fb.pageId || s.pageId;
      return {
        campaignName: name,
        pageCode: pageId ? pageNameMap.get(pageId) || "" : "",
        adSpend: spend, gmv: s.gmv,
        commission: s.comm, orders: s.orders, profit,
        roi: spend > 0 ? Math.round((profit / spend) * 1000) / 10 : null,
        roas: spend > 0 ? Math.round((s.comm / spend) * 100) / 100 : null,
      };
    });

    setData(campaigns);
    setLoading(false);
  };

  const filtered = data
    .filter(r => {
      if (search && !r.campaignName.toLowerCase().includes(search.toLowerCase()) && !r.pageCode?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus === "profit" && r.profit <= 0) return false;
      if (filterStatus === "loss" && r.profit >= 0) return false;
      return true;
    })
    .sort((a, b) => {
      const av = a[sortBy] ?? -Infinity, bv = b[sortBy] ?? -Infinity;
      if (typeof av === "string" && typeof bv === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

  const totals = filtered.reduce((acc, r) => ({
    adSpend: acc.adSpend + r.adSpend, gmv: acc.gmv + r.gmv, commission: acc.commission + r.commission,
    orders: acc.orders + r.orders, profit: acc.profit + r.profit,
  }), { adSpend: 0, gmv: 0, commission: 0, orders: 0, profit: 0 });

  const totalRoi = totals.adSpend > 0 ? Math.round(((totals.commission - totals.adSpend) / totals.adSpend) * 1000) / 10 : 0;

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(key); setSortDir("desc"); }
  };

  const exportCsv = () => {
    const headers = ["Chiến dịch", "Page", "Chi Ads (₫)", "GMV (₫)", "Hoa hồng (₫)", "Đơn", "Lợi nhuận (₫)", "ROI%", "ROAS"];
    const rows = filtered.map(r => [r.campaignName, r.pageCode || "", r.adSpend, r.gmv, r.commission, r.orders, r.profit, r.roi ?? "", r.roas ?? ""]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `pnl-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const profitCount = data.filter(r => r.profit > 0).length;
  const lossCount = data.filter(r => r.profit < 0).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">Báo cáo P&L</h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Ghép tự động FB Ads ↔ Shopee qua tên chiến dịch = Sub_id2</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5 bg-[var(--card)] border border-[var(--border)] rounded-md p-0.5">
            {[{k:"7d",l:"7D"},{k:"30d",l:"30D"},{k:"90d",l:"90D"},{k:"all",l:"All"}].map(p => (
              <button key={p.k} onClick={() => setPeriod(p.k)} className={`px-2 py-1 rounded text-[10px] font-medium ${period===p.k?"bg-[var(--accent)] text-white":"text-[var(--muted-foreground)]"}`}>{p.l}</button>
            ))}
          </div>
          <button onClick={fetchPnl} className="p-1.5 rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"><RefreshCw size={12} /></button>
          <button onClick={exportCsv} disabled={!filtered.length} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[var(--accent)] text-white text-[11px] font-semibold hover:opacity-90 disabled:opacity-50">
            <Download size={11} /> CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-3">
        {[
          { label: "CHI ADS", value: formatCompact(totals.adSpend), color: "#ef4444" },
          { label: "GMV", value: formatCompact(totals.gmv), color: "#3b82f6" },
          { label: "HOA HỒNG", value: formatCompact(totals.commission), color: "#6366f1" },
          { label: "LỢI NHUẬN", value: formatCompact(totals.profit), color: totals.profit >= 0 ? "#22c55e" : "#ef4444" },
          { label: "ROI", value: totalRoi + "%", color: totalRoi >= 0 ? "#22c55e" : "#ef4444" },
        ].map((m, i) => (
          <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${m.color}80, transparent)` }} />
            <div className="text-[10px] text-[var(--muted-foreground)] mb-0.5">{m.label}</div>
            <div className="font-mono text-lg font-bold" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Scoreboard + Search */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-0.5 bg-[var(--card)] border border-[var(--border)] rounded-md p-0.5">
          {[{k:"all" as const, l:`Tất cả (${data.length})`}, {k:"profit" as const, l:`Lãi (${profitCount})`}, {k:"loss" as const, l:`Lỗ (${lossCount})`}].map(f => (
            <button key={f.k} onClick={() => setFilterStatus(f.k)} className={`px-2.5 py-1 rounded text-[10px] font-medium ${filterStatus===f.k?"bg-[var(--accent)] text-white":"text-[var(--muted-foreground)]"}`}>{f.l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 bg-[var(--card)] border border-[var(--border)] rounded-md px-2 py-1.5 flex-1 max-w-xs">
          <Search size={11} className="text-[var(--muted-foreground)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm chiến dịch..." className="bg-transparent text-xs outline-none flex-1" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center text-xs text-[var(--muted-foreground)]">Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center">
          <BarChart3 size={24} className="text-[var(--muted-foreground)] mx-auto mb-2" />
          <div className="text-xs text-[var(--muted-foreground)]">{data.length === 0 ? "Chưa có dữ liệu. Import FB Ads và Shopee trước." : "Không tìm thấy."}</div>
        </div>
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead><tr className="border-b border-[var(--border)]">
                {[
                  { key: "campaignName" as SortKey, label: "CHIẾN DỊCH", align: "left" },
                  { key: null, label: "PAGE", align: "left" },
                  { key: "adSpend" as SortKey, label: "CHI ADS", align: "right" },
                  { key: null, label: "GMV", align: "right" },
                  { key: "commission" as SortKey, label: "HOA HỒNG", align: "right" },
                  { key: null, label: "ĐƠN", align: "right" },
                  { key: "profit" as SortKey, label: "LỢI NHUẬN", align: "right" },
                  { key: "roi" as SortKey, label: "ROI", align: "right" },
                  { key: null, label: "ROAS", align: "right" },
                ].map((col, i) => (
                  <th key={i} onClick={() => col.key && toggleSort(col.key)}
                    className={`px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase whitespace-nowrap ${col.align === "right" ? "text-right" : "text-left"} ${col.key ? "cursor-pointer hover:text-[var(--foreground)]" : ""}`}>
                    {col.label}{col.key === sortBy && (sortDir === "desc" ? " ↓" : " ↑")}
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                    <td className="px-3 py-2"><div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${r.profit>0?"bg-green-400":r.profit<0?"bg-red-400":"bg-gray-400"}`} /><span className="text-xs font-medium truncate max-w-[180px]">{r.campaignName}</span></div></td>
                    <td className="px-3 py-2 text-xs font-mono text-[var(--muted-foreground)]">{r.pageCode || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-red-400">{r.adSpend > 0 ? formatCompact(r.adSpend) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.gmv > 0 ? formatCompact(r.gmv) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-indigo-400">{r.commission > 0 ? formatCompact(r.commission) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-[var(--muted-foreground)]">{r.orders || "—"}</td>
                    <td className="px-3 py-2 text-right"><span className={`font-mono text-xs font-bold ${r.profit>0?"text-green-400":r.profit<0?"text-red-400":"text-[var(--muted-foreground)]"}`}>{r.profit!==0?(r.profit>0?"+":"")+formatCompact(r.profit):"—"}</span></td>
                    <td className="px-3 py-2 text-right">{r.roi!=null?<span className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${r.roi>=0?"bg-green-500/10 text-green-400":"bg-red-500/10 text-red-400"}`}>{r.roi>0?"+":""}{r.roi}%</span>:<span className="text-[10px] text-[var(--muted-foreground)]">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono text-[10px] text-[var(--muted-foreground)]">{r.roas!=null?r.roas.toFixed(2)+"x":"—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-[var(--border)] bg-[var(--muted)]">
                <td className="px-3 py-2 text-xs font-bold">TỔNG ({filtered.length})</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-red-400">{formatCompact(totals.adSpend)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold">{formatCompact(totals.gmv)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-indigo-400">{formatCompact(totals.commission)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold">{totals.orders}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold" style={{ color: totals.profit>=0?"#22c55e":"#ef4444" }}>{totals.profit>0?"+":""}{formatCompact(totals.profit)}</td>
                <td className="px-3 py-2 text-right"><span className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${totalRoi>=0?"bg-green-500/10 text-green-400":"bg-red-500/10 text-red-400"}`}>{totalRoi>0?"+":""}{totalRoi}%</span></td>
                <td className="px-3 py-2" />
              </tr></tfoot>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-[var(--border)] text-[10px] text-[var(--muted-foreground)] text-right">
            Báo cáo bởi Shopee Ads Manager © 2026 Minh Tâm · 0877 260 675
          </div>
        </div>
      )}
    </div>
  );
}
