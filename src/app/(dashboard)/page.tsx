"use client";
import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, Zap, Star, BarChart3, Package, ShoppingBag, ArrowUpRight, ArrowDownRight, Upload, Megaphone, AlertTriangle, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { formatCompact } from "@/lib/finance";
import { type Period, getDateRange } from "@/lib/date-filter";

type PageRow = { name: string; adSpend: number; commission: number; profit: number; roi: number|null; orders: number };

const periods: { k: Period; l: string }[] = [
  { k: "today", l: "Hôm nay" }, { k: "yesterday", l: "Hôm qua" }, { k: "7d", l: "7N" },
  { k: "30d", l: "30N" }, { k: "this_month", l: "Tháng này" }, { k: "last_month", l: "Tháng trước" }, { k: "all", l: "Tất cả" },
];

export default function DashboardPage() {
  const supabase = createClient();
  const [period, setPeriod] = useState<Period>("all");
  const [summary, setSummary] = useState({ adSpend: 0, gmv: 0, commission: 0, orders: 0, pages: 0 });
  const [pageRows, setPageRows] = useState<PageRow[]>([]);
  const [fbBatches, setFbBatches] = useState(0);
  const [shopeeBatches, setShopeeBatches] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, [period]);

  const fetchAll = async () => {
    setLoading(true);
    const { from, to } = getDateRange(period);

    const [{ data: dashData }, { data: pageData }] = await Promise.all([
      supabase.rpc("get_dashboard_summary", { date_from: from, date_to: to }),
      supabase.rpc("get_page_summary", { date_from: from, date_to: to }),
    ]);

    if (dashData?.[0]) {
      const d = dashData[0];
      setSummary({ adSpend: Number(d.total_ad_spend), gmv: Number(d.total_gmv), commission: Number(d.total_commission), orders: Number(d.total_orders), pages: Number(d.total_pages) });
    }

    if (pageData) {
      const rows: PageRow[] = pageData.map((p: any) => {
        const ad = Number(p.total_ad_spend), comm = Number(p.total_commission), profit = comm - ad;
        return { name: p.page_name, adSpend: ad, commission: comm, profit, roi: ad > 0 ? Math.round((profit / ad) * 1000) / 10 : null, orders: Number(p.total_orders) };
      }).filter((r: PageRow) => r.adSpend > 0 || r.commission > 0);
      rows.sort((a, b) => b.profit - a.profit);
      setPageRows(rows);
    }

    const { count: fb } = await supabase.from("import_batches").select("id", { count: "exact" }).eq("type", "fb_ads");
    const { count: sp } = await supabase.from("import_batches").select("id", { count: "exact" }).eq("type", "shopee_affiliate");
    setFbBatches(fb || 0); setShopeeBatches(sp || 0);
    setLoading(false);
  };

  const profit = summary.commission - summary.adSpend;
  const roi = summary.adSpend > 0 ? Math.round((profit / summary.adSpend) * 1000) / 10 : null;
  const profitPages = pageRows.filter(p => p.profit > 0).length;
  const lossPages = pageRows.filter(p => p.profit < 0).length;
  const hasData = summary.adSpend > 0 || summary.commission > 0 || fbBatches > 0 || shopeeBatches > 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (<div className="glass-card rounded-lg px-3 py-2 text-[11px] shadow-xl border border-[var(--border)]"><div className="text-[var(--muted-foreground)] font-medium mb-1">{label}</div>{payload.map((p: any, i: number) => (<div key={i} className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} /><span className="text-[var(--muted-foreground)]">{p.name}:</span><span className="font-mono font-semibold">{formatCompact(p.value)}</span></div>))}</div>);
  };

  if (!loading && !hasData) {
    return (<div><h1 className="text-xl font-bold mb-1">Dashboard</h1><p className="text-xs text-[var(--muted-foreground)] mb-8">{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p><div className="glass-card rounded-2xl p-12 text-center border border-[var(--border)]"><div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#ee4d2d]/10 to-[#ff6b47]/5 flex items-center justify-center mx-auto mb-5 ring-1 ring-[#ee4d2d]/10"><Upload size={36} className="text-[var(--accent)]" /></div><h2 className="text-lg font-semibold mb-2">Bắt đầu với dữ liệu</h2><p className="text-sm text-[var(--muted-foreground)] max-w-md mx-auto mb-6">Import file CSV từ Facebook Ads và Shopee Affiliate.</p><Link href="/import" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#ee4d2d] to-[#ff6b47] text-white text-sm font-semibold"><Upload size={16} /> Import dữ liệu</Link></div></div>);
  }

  const kpis = [
    { icon: DollarSign, label: "Chi Ads", value: formatCompact(summary.adSpend), color: "#ef4444", glow: "glow-red" },
    { icon: TrendingUp, label: "GMV", value: formatCompact(summary.gmv), color: "#3b82f6", glow: "glow-blue" },
    { icon: Zap, label: "Hoa hồng", value: formatCompact(summary.commission), color: "#6366f1", glow: "glow-purple" },
    { icon: Star, label: "Lợi nhuận", value: (profit>=0?"+":"")+formatCompact(profit), color: profit>=0?"#22c55e":"#ef4444", glow: profit>=0?"glow-green":"glow-red" },
    { icon: BarChart3, label: "ROI", value: roi!==null?(roi>0?"+":"")+roi+"%":"—", color: (roi||0)>=0?"#22c55e":"#ef4444", glow: (roi||0)>=0?"glow-green":"glow-red" },
    { icon: Package, label: "Đơn hàng", value: summary.orders.toLocaleString(), color: "#8b5cf6", glow: "glow-purple" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div><h1 className="text-xl font-bold">Dashboard</h1><p className="text-xs text-[var(--muted-foreground)] mt-0.5">{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div>
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-0.5 glass-card rounded-lg p-0.5 border border-[var(--border)]">
            {periods.map(p => (<button key={p.k} onClick={() => setPeriod(p.k)} className={`px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${period===p.k?"bg-gradient-to-r from-[#ee4d2d] to-[#ff6b47] text-white shadow-sm":"text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}>{p.l}</button>))}
          </div>
          <div className="flex items-center gap-1 glass-card rounded-lg px-2.5 py-1.5 border border-[var(--border)]">
            <Megaphone size={11} className="text-[#1877f2]" /><span className="text-[10px] text-[var(--muted-foreground)] font-mono">{fbBatches}</span>
            <span className="w-px h-3 bg-[var(--border)] mx-1" /><ShoppingBag size={11} className="text-[#ee4d2d]" /><span className="text-[10px] text-[var(--muted-foreground)] font-mono">{shopeeBatches}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5 mb-4">
        {kpis.map((m, i) => (<div key={i} className={`glass-card rounded-xl p-3.5 border border-[var(--border)] ${m.glow} transition-all hover:scale-[1.02]`}><div className="flex items-center gap-1.5 mb-2"><div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${m.color}12` }}><m.icon size={12} style={{ color: m.color }} /></div><span className="text-[10px] text-[var(--muted-foreground)] font-medium">{m.label}</span></div><div className="font-mono text-xl font-bold tracking-tight" style={{ color: m.color }}>{loading ? <div className="skeleton h-6 w-20" /> : m.value}</div></div>))}
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <div className="glass-card rounded-xl p-3 text-center border border-[var(--border)]"><div className="font-mono text-2xl font-bold">{pageRows.length}</div><div className="text-[10px] text-[var(--muted-foreground)]">Page</div></div>
        <div className="glass-card rounded-xl p-3 text-center border border-green-500/10 glow-green"><div className="font-mono text-2xl font-bold text-green-400 flex items-center justify-center gap-1"><ArrowUpRight size={16} />{profitPages}</div><div className="text-[10px] text-[var(--muted-foreground)]">Lãi</div></div>
        <div className="glass-card rounded-xl p-3 text-center border border-red-500/10 glow-red"><div className="font-mono text-2xl font-bold text-red-400 flex items-center justify-center gap-1"><ArrowDownRight size={16} />{lossPages}</div><div className="text-[10px] text-[var(--muted-foreground)]">Lỗ</div></div>
      </div>

      {pageRows.length > 0 && (<div className="glass-card rounded-2xl border border-[var(--border)] mb-4 overflow-hidden"><div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between"><span className="text-sm font-semibold">Top Pages theo lợi nhuận</span><Link href="/pages" className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-0.5 font-medium">Xem chi tiết <ArrowUpRight size={10} /></Link></div><div className="p-4 h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={pageRows} layout="vertical" margin={{ left: 0, right: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" horizontal={false} /><XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatCompact} /><YAxis type="category" dataKey="name" width={130} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 16) + "…" : v} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="profit" name="Lợi nhuận" radius={[0, 4, 4, 0]} maxBarSize={24}>{pageRows.map((e, i) => (<Cell key={i} fill={e.profit >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.85} />))}</Bar></BarChart></ResponsiveContainer></div></div>)}

      {pageRows.length > 0 && (<div className="glass-card rounded-2xl border border-[var(--border)] overflow-hidden"><div className="px-5 py-3 border-b border-[var(--border)]"><span className="text-sm font-semibold">Chi tiết theo Page</span></div><div className="overflow-x-auto"><table className="w-full min-w-[650px]"><thead><tr className="border-b border-[var(--border)]"><th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Page</th><th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Chi Ads</th><th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Hoa hồng</th><th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Lợi nhuận</th><th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">ROI</th><th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Đơn</th></tr></thead><tbody>{pageRows.map((c, i) => (<tr key={i} className="row-hover border-b border-[var(--border)]"><td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${i < 3 ? "bg-gradient-to-br from-amber-500 to-amber-600 text-white" : c.profit > 0 ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>{i < 3 ? ["🥇","🥈","🥉"][i] : i+1}</div><span className="text-xs font-medium">{c.name}</span></div></td><td className="px-4 py-2.5 text-right font-mono text-xs text-red-400">{c.adSpend > 0 ? formatCompact(c.adSpend) : "—"}</td><td className="px-4 py-2.5 text-right font-mono text-xs text-indigo-400">{c.commission > 0 ? formatCompact(c.commission) : "—"}</td><td className="px-4 py-2.5 text-right font-mono text-xs font-bold" style={{ color: c.profit>=0?"#22c55e":"#ef4444" }}>{c.profit>=0?"+":""}{formatCompact(c.profit)}</td><td className="px-4 py-2.5 text-right">{c.roi!=null?<span className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded-md ${c.roi>=0?"bg-green-500/10 text-green-400":"bg-red-500/10 text-red-400"}`}>{c.roi>0?"+":""}{c.roi}%</span>:<span className="text-[10px] text-[var(--muted-foreground)]">—</span>}</td><td className="px-4 py-2.5 text-right font-mono text-xs text-[var(--muted-foreground)]">{c.orders}</td></tr>))}</tbody></table></div><div className="px-5 py-2.5 border-t border-[var(--border)] text-center"><Link href="/pages" className="text-[11px] text-[var(--accent)] hover:underline font-medium">Xem chi tiết từng Page →</Link></div></div>)}

      {lossPages > 0 && (<div className="glass-card rounded-2xl border border-red-500/10 glow-red mt-4 overflow-hidden"><div className="px-5 py-3 border-b border-red-500/10 flex items-center gap-2"><AlertTriangle size={14} className="text-red-400" /><span className="text-sm font-semibold text-red-400">Cảnh báo: {lossPages} page lỗ</span></div>{pageRows.filter(c => c.profit < 0).map((c, i) => (<div key={i} className="px-5 py-2.5 flex items-center justify-between border-b border-[var(--border)] last:border-0 row-hover"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400 pulse-dot" /><span className="text-xs font-medium">{c.name}</span></div><span className="font-mono text-xs text-red-400 font-bold">{formatCompact(c.profit)}</span></div>))}</div>)}
    </div>
  );
}
