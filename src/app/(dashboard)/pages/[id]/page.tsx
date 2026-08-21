"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, DollarSign, TrendingUp, Zap, Star, BarChart3, Package, Calendar, Megaphone, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { createClient } from "@/lib/supabase";
import { formatCompact } from "@/lib/finance";
import { type Period, getDateRange } from "@/lib/date-filter";

type DailyRow = { date: string; adSpend: number; gmv: number; commission: number; orders: number; profit: number };
type CampRow = { name: string; subId1: string; source: string; adSpend: number; gmv: number; commission: number; orders: number; profit: number; roi: number | null };

const periods: { k: Period; l: string }[] = [
  { k: "today", l: "Hôm nay" }, { k: "yesterday", l: "Hôm qua" }, { k: "7d", l: "7N" },
  { k: "30d", l: "30N" }, { k: "this_month", l: "Tháng này" }, { k: "last_month", l: "Tháng trước" }, { k: "all", l: "Tất cả" }, { k: "custom", l: "📅" },
];

export default function PageDetailPage() {
  const { id } = useParams();
  const supabase = createClient();
  const [page, setPage] = useState<any>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [totals, setTotals] = useState({ adSpend: 0, gmv: 0, commission: 0, orders: 0, profit: 0 });
  const [accessDenied, setAccessDenied] = useState(false);
  const [tab, setTab] = useState<"daily" | "campaigns">("campaigns");
  const [onlySpend, setOnlySpend] = useState(false);

  useEffect(() => { if (id && (period !== "custom" || (customFrom && customTo))) fetchData(); }, [id, period, customFrom, customTo]);

  const fetchData = async () => {
    setLoading(true);
    const pageId = id as string;

    // Auth + ownership check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const role = myProfile?.role || "EMPLOYEE";
    const isAdmin = role === "ADMIN" || role === "LEADER";

    const { data: pageData } = await supabase.from("pages").select("*, assignee:assignee_id(name)").eq("id", pageId).single();
    if (!pageData) { setLoading(false); return; }
    if (!isAdmin && pageData.assignee_id !== user.id) { setAccessDenied(true); setLoading(false); return; }
    setPage(pageData);

    const { from, to } = getDateRange(period, customFrom, customTo);

    // Daily data via RPC
    const { data: dailyData } = await supabase.rpc("get_page_daily", { p_page_id: pageId, date_from: from, date_to: to });
    if (dailyData) {
      let tAd = 0, tGmv = 0, tComm = 0, tOrd = 0;
      const rows: DailyRow[] = dailyData.map((r: any) => {
        const ad = Number(r.ad_spend), gmv = Number(r.gmv), comm = Number(r.commission), ord = Number(r.orders);
        tAd += ad; tGmv += gmv; tComm += comm; tOrd += ord;
        return { date: String(r.report_date).slice(5), adSpend: ad, gmv, commission: comm, orders: ord, profit: comm - ad };
      });
      setDaily(rows);
      setTotals({ adSpend: tAd, gmv: tGmv, commission: tComm, orders: tOrd, profit: tComm - tAd });
    }

    // Campaign breakdown via RPC — with date filter
    const { data: campData } = await supabase.rpc("get_page_campaigns", { p_page_id: pageId, date_from: from, date_to: to });
    if (campData) {
      // Merge FB + Shopee by campaign name + sub_id1
      const merged = new Map<string, { campName: string; subId1: string; adSpend: number; gmv: number; commission: number; orders: number; sources: Set<string> }>();
      campData.forEach((r: any) => {
        const campName = r.campaign_name || "(không tên)";
        const sub1 = r.sub_id1 || "";
        const key = campName + "|" + sub1;
        const ex = merged.get(key) || { campName, subId1: sub1, adSpend: 0, gmv: 0, commission: 0, orders: 0, sources: new Set() };
        ex.adSpend += Number(r.ad_spend || 0);
        ex.gmv += Number(r.gmv || 0);
        ex.commission += Number(r.commission || 0);
        ex.orders += Number(r.orders || 0);
        ex.sources.add(r.source);
        merged.set(key, ex);
      });
      const campRows: CampRow[] = Array.from(merged.values()).map(v => {
        const profit = v.commission - v.adSpend;
        return {
          name: v.campName, subId1: v.subId1, source: Array.from(v.sources).join("+"),
          adSpend: v.adSpend, gmv: v.gmv, commission: v.commission, orders: v.orders,
          profit, roi: v.adSpend > 0 ? Math.round((profit / v.adSpend) * 1000) / 10 : null,
        };
      });
      campRows.sort((a, b) => b.commission - a.commission);
      setCampaigns(campRows);
    }

    setLoading(false);
  };

  const roi = totals.adSpend > 0 ? Math.round((totals.profit / totals.adSpend) * 1000) / 10 : null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (<div className="glass-card rounded-lg px-3 py-2 text-[11px] shadow-xl border border-[var(--border)]"><div className="text-[var(--muted-foreground)] font-medium mb-1">{label}</div>{payload.map((p: any, i: number) => (<div key={i} className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} /><span className="text-[var(--muted-foreground)]">{p.name}:</span><span className="font-mono font-semibold">{formatCompact(p.value)}</span></div>))}</div>);
  };

  if (loading) return <div className="text-xs text-[var(--muted-foreground)] p-8 text-center">Đang tải...</div>;
  if (accessDenied) return <div className="glass-card rounded-xl border border-red-500/20 p-8 text-center"><div className="text-red-400 text-sm font-semibold mb-1">Không có quyền truy cập</div><div className="text-xs text-[var(--muted-foreground)] mb-3">Page này không được giao cho bạn.</div><Link href="/pages" className="text-xs text-[var(--accent)] hover:underline">← Quay lại Pages</Link></div>;
  if (!page) return <div className="text-xs text-red-400 p-8 text-center">Không tìm thấy page</div>;

  const campTotals = campaigns.reduce((a, c) => ({ ad: a.ad + c.adSpend, gmv: a.gmv + c.gmv, comm: a.comm + c.commission, orders: a.orders + c.orders, profit: a.profit + c.profit }), { ad: 0, gmv: 0, comm: 0, orders: 0, profit: 0 });

  // Merge FB + Shopee by name — matched rows get both ad_spend + commission
  type MergedRow = { name: string; subId1: string; adSpend: number; gmv: number; commission: number; orders: number; hasFb: boolean; hasShopee: boolean };
  const mergeMap = new Map<string, MergedRow>();
  campaigns.forEach(c => {
    const key = c.name.toLowerCase();
    const ex = mergeMap.get(key) || { name: c.name, subId1: c.subId1 || "", adSpend: 0, gmv: 0, commission: 0, orders: 0, hasFb: false, hasShopee: false };
    ex.adSpend += c.adSpend;
    ex.gmv += c.gmv;
    ex.commission += c.commission;
    ex.orders += c.orders;
    if (c.subId1 && !ex.subId1) ex.subId1 = c.subId1;
    if (c.source.includes("fb_ads")) ex.hasFb = true;
    if (c.source.includes("shopee")) ex.hasShopee = true;
    mergeMap.set(key, ex);
  });
  const mergedCampaigns = Array.from(mergeMap.values())
    .filter(c => !onlySpend || c.adSpend > 0)
    .sort((a, b) => (b.commission - b.adSpend) - (a.commission - a.adSpend));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/pages" className="w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--muted)]"><ArrowLeft size={14} /></Link>
        <div className="flex-1"><h1 className="text-lg font-bold">{page.name}</h1><p className="text-xs text-[var(--muted-foreground)]">{(page.assignee as any)?.name || "Chưa giao"} · {page.status}</p></div>
        <Link href="/import" className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90">Upload báo cáo</Link>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex flex-wrap gap-0.5 glass-card rounded-lg p-0.5 border border-[var(--border)] w-fit">
          {periods.map(p => (<button key={p.k} onClick={() => setPeriod(p.k)} className={`px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${period===p.k?"bg-gradient-to-r from-[#ee4d2d] to-[#ff6b47] text-white shadow-sm":"text-[var(--muted-foreground)]"}`}>{p.l}</button>))}
        </div>
        {period === "custom" && (
          <div className="flex items-center gap-1.5 glass-card rounded-lg px-2 py-1 border border-[var(--border)]">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="bg-transparent text-[10px] outline-none" />
            <span className="text-[10px] text-[var(--muted-foreground)]">→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="bg-transparent text-[10px] outline-none" />
          </div>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
        {[
          { icon: DollarSign, label: "Chi Ads", value: formatCompact(totals.adSpend), color: "#ef4444", glow: "glow-red" },
          { icon: TrendingUp, label: "GMV", value: formatCompact(totals.gmv), color: "#3b82f6", glow: "glow-blue" },
          { icon: Zap, label: "Hoa hồng", value: formatCompact(totals.commission), color: "#6366f1", glow: "glow-purple" },
          { icon: Star, label: "Lợi nhuận", value: (totals.profit>=0?"+":"")+formatCompact(totals.profit), color: totals.profit>=0?"#22c55e":"#ef4444", glow: totals.profit>=0?"glow-green":"glow-red" },
          { icon: BarChart3, label: "ROI", value: roi!==null?(roi>0?"+":"")+roi+"%":"—", color: (roi||0)>=0?"#22c55e":"#ef4444", glow: "glow-green" },
          { icon: Package, label: "Đơn hàng", value: totals.orders.toLocaleString(), color: "#8b5cf6", glow: "glow-purple" },
        ].map((m, i) => (<div key={i} className={`glass-card rounded-xl p-3 border border-[var(--border)] ${m.glow}`}><div className="flex items-center gap-1.5 mb-1.5"><m.icon size={12} style={{ color: m.color }} /><span className="text-[10px] text-[var(--muted-foreground)]">{m.label}</span></div><div className="font-mono text-lg font-bold" style={{ color: m.color }}>{m.value}</div></div>))}
      </div>

      {/* Chart */}
      {daily.length > 1 && (
        <div className="glass-card rounded-2xl border border-[var(--border)] mb-4 overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)]"><span className="text-sm font-semibold">Chi Ads vs Hoa hồng theo ngày</span></div>
          <div className="p-4 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[...daily].reverse()}>
                <defs><linearGradient id="gAd" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient><linearGradient id="gComm" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="adSpend" name="Chi Ads" stroke="#ef4444" strokeWidth={2} fill="url(#gAd)" />
                <Area type="monotone" dataKey="commission" name="Hoa hồng" stroke="#6366f1" strokeWidth={2} fill="url(#gComm)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabs + filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-0.5 glass-card rounded-lg p-0.5 border border-[var(--border)]">
          <button onClick={() => setTab("campaigns")} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium ${tab==="campaigns"?"bg-[var(--accent)] text-white":"text-[var(--muted-foreground)]"}`}>
            <Megaphone size={12} /> Campaigns ({mergedCampaigns.length})
          </button>
          <button onClick={() => setTab("daily")} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium ${tab==="daily"?"bg-[var(--accent)] text-white":"text-[var(--muted-foreground)]"}`}>
            <Calendar size={12} /> Theo ngày ({daily.length})
          </button>
        </div>
        {tab === "campaigns" && (
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={onlySpend} onChange={e => setOnlySpend(e.target.checked)} className="accent-[var(--accent)] w-3.5 h-3.5" />
            <span className="text-[11px] text-[var(--muted-foreground)]">Chỉ hiện có chi tiêu</span>
          </label>
        )}
      </div>

      {/* CAMPAIGNS TAB — style Affiliate Full */}
      {tab === "campaigns" && (
        <div className="glass-card rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="text-left px-4 py-2.5 text-[11px] font-bold text-[var(--foreground)]">Chiến dịch</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold text-[var(--foreground)]">Chi tiêu</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold text-[var(--foreground)]">Đơn</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold text-[var(--foreground)]">Hoa hồng</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold text-[var(--foreground)]">Tiền về</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold text-[var(--foreground)]">ROI</th>
              </tr></thead>
              <tbody>
                {mergedCampaigns.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-[var(--muted-foreground)]">Chưa có dữ liệu. Upload FB Ads và Shopee cho page này.</td></tr>
                ) : mergedCampaigns.map((c, i) => {
                  const profit = c.commission - c.adSpend;
                  const roiVal = c.adSpend > 0 ? Math.round((profit / c.adSpend) * 1000) / 10 : null;
                  return (
                    <tr key={i} className={`border-b border-[var(--border)] transition-colors ${profit > 0 ? "hover:bg-green-500/5" : profit < 0 ? "hover:bg-red-500/5" : "hover:bg-[var(--muted)]"}`}>
                      <td className="px-4 py-2.5 text-xs font-mono font-semibold">{c.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{c.adSpend > 0 ? formatCompact(c.adSpend) : "0"}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{c.orders}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{c.commission > 0 ? formatCompact(c.commission) : "0"}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs font-bold" style={{ color: profit > 0 ? "#22c55e" : profit < 0 ? "#ef4444" : "var(--muted-foreground)" }}>
                        {profit > 0 ? "+" : ""}{formatCompact(profit)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-mono text-xs font-bold ${(roiVal || 0) > 0 ? "text-green-400" : (roiVal || 0) < 0 ? "text-red-400" : "text-[var(--muted-foreground)]"}`}>
                          {roiVal !== null ? (roiVal > 0 ? "+" : "") + roiVal + "%" : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Totals */}
          {mergedCampaigns.length > 0 && (
            <div className={`px-4 py-3 border-t-2 border-[var(--border)] flex items-center justify-center gap-3 text-xs font-mono ${campTotals.profit >= 0 ? "bg-green-500/5" : "bg-red-500/5"}`}>
              <span>Tổng:</span>
              <span>Chi tiêu <b className="text-red-400">{formatCompact(campTotals.ad)}</b></span>
              <span>·</span>
              <span>Hoa hồng <b className="text-indigo-400">{formatCompact(campTotals.comm)}</b></span>
              <span>·</span>
              <span>Tiền về <b style={{ color: campTotals.profit >= 0 ? "#22c55e" : "#ef4444" }}>{campTotals.profit > 0 ? "+" : ""}{formatCompact(campTotals.profit)}</b></span>
              <span>·</span>
              <span>ROI <b style={{ color: campTotals.profit >= 0 ? "#22c55e" : "#ef4444" }}>{campTotals.ad > 0 ? Math.round(((campTotals.comm - campTotals.ad) / campTotals.ad) * 1000) / 10 : 0}%</b></span>
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${campTotals.profit >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                {campTotals.profit >= 0 ? "● LÃI" : "● LỖ"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* DAILY TAB */}
      {tab === "daily" && daily.length > 0 && (
        <div className="glass-card rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Ngày</th>
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Chi Ads</th>
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">GMV</th>
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Hoa hồng</th>
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Đơn</th>
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Lợi nhuận</th>
              </tr></thead>
              <tbody>
                {daily.map((d, i) => (<tr key={i} className="border-b border-[var(--border)] row-hover">
                  <td className="px-4 py-2 text-xs font-mono">{d.date}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-red-400">{d.adSpend > 0 ? formatCompact(d.adSpend) : "—"}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{d.gmv > 0 ? formatCompact(d.gmv) : "—"}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-indigo-400">{d.commission > 0 ? formatCompact(d.commission) : "—"}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{d.orders}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs font-bold" style={{ color: d.profit>=0?"#22c55e":"#ef4444" }}>{d.profit>=0?"+":""}{formatCompact(d.profit)}</td>
                </tr>))}
              </tbody>
              <tfoot><tr className="border-t-2 border-[var(--border)] bg-[var(--muted)]">
                <td className="px-4 py-2 text-xs font-bold">TỔNG</td>
                <td className="px-4 py-2 text-right font-mono text-xs font-bold text-red-400">{formatCompact(totals.adSpend)}</td>
                <td className="px-4 py-2 text-right font-mono text-xs font-bold">{formatCompact(totals.gmv)}</td>
                <td className="px-4 py-2 text-right font-mono text-xs font-bold text-indigo-400">{formatCompact(totals.commission)}</td>
                <td className="px-4 py-2 text-right font-mono text-xs font-bold">{totals.orders}</td>
                <td className="px-4 py-2 text-right font-mono text-xs font-bold" style={{ color: totals.profit>=0?"#22c55e":"#ef4444" }}>{totals.profit>0?"+":""}{formatCompact(totals.profit)}</td>
              </tr></tfoot>
            </table>
          </div>
        </div>
      )}

      {tab === "daily" && daily.length === 0 && (
        <div className="glass-card rounded-xl border border-[var(--border)] p-6 text-center text-xs text-[var(--muted-foreground)]">Chưa có dữ liệu theo ngày.</div>
      )}
    </div>
  );
}
