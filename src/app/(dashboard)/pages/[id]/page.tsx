"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, DollarSign, TrendingUp, Zap, Star, BarChart3, Package, Calendar } from "lucide-react";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { createClient } from "@/lib/supabase";
import { formatCompact } from "@/lib/finance";

type DailyRow = { date: string; adSpend: number; gmv: number; commission: number; orders: number; profit: number };

export default function PageDetailPage() {
  const { id } = useParams();
  const supabase = createClient();
  const [page, setPage] = useState<any>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [campaigns, setCampaigns] = useState<{ name: string; adSpend: number; commission: number; profit: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ adSpend: 0, gmv: 0, commission: 0, orders: 0, profit: 0 });

  useEffect(() => { if (id) fetchData(); }, [id]);

  const fetchData = async () => {
    setLoading(true);
    const pageId = id as string;

    // Page info
    const { data: pageData } = await supabase.from("pages").select("*, assignee:assignee_id(name)").eq("id", pageId).single();
    setPage(pageData);

    // FB Ads for this page
    const { data: fbRaw } = await supabase.from("fb_ads_data").select("campaign_name, ad_spend, created_at").eq("page_id", pageId).limit(100000);

    // Shopee for this page
    const { data: shopeeRaw } = await supabase.from("shopee_affiliate_data").select("sub_id2, order_value, net_commission, created_at").eq("page_id", pageId).limit(100000);

    // Totals
    const totalAd = fbRaw?.reduce((s, r) => s + Number(r.ad_spend || 0), 0) || 0;
    const totalGmv = shopeeRaw?.reduce((s, r) => s + Number(r.order_value || 0), 0) || 0;
    const totalComm = shopeeRaw?.reduce((s, r) => s + Number(r.net_commission || 0), 0) || 0;
    const totalOrders = shopeeRaw?.length || 0;
    setTotals({ adSpend: totalAd, gmv: totalGmv, commission: totalComm, orders: totalOrders, profit: totalComm - totalAd });

    // Group by date for daily chart
    const dateMap = new Map<string, { adSpend: number; gmv: number; commission: number; orders: number }>();
    fbRaw?.forEach(r => {
      const d = r.created_at?.split("T")[0] || "unknown";
      const ex = dateMap.get(d) || { adSpend: 0, gmv: 0, commission: 0, orders: 0 };
      ex.adSpend += Number(r.ad_spend || 0);
      dateMap.set(d, ex);
    });
    shopeeRaw?.forEach(r => {
      const d = r.created_at?.split("T")[0] || "unknown";
      const ex = dateMap.get(d) || { adSpend: 0, gmv: 0, commission: 0, orders: 0 };
      ex.gmv += Number(r.order_value || 0);
      ex.commission += Number(r.net_commission || 0);
      ex.orders += 1;
      dateMap.set(d, ex);
    });
    const dailyData = Array.from(dateMap.entries())
      .map(([date, v]) => ({ date: date.slice(5), adSpend: v.adSpend, gmv: v.gmv, commission: v.commission, orders: v.orders, profit: v.commission - v.adSpend }))
      .sort((a, b) => a.date.localeCompare(b.date));
    setDaily(dailyData);

    // Campaigns breakdown
    const campMap = new Map<string, { adSpend: number; commission: number }>();
    fbRaw?.forEach(r => {
      const ex = campMap.get(r.campaign_name) || { adSpend: 0, commission: 0 };
      ex.adSpend += Number(r.ad_spend || 0);
      campMap.set(r.campaign_name, ex);
    });
    shopeeRaw?.forEach(r => {
      if (!r.sub_id2) return;
      const ex = campMap.get(r.sub_id2) || { adSpend: 0, commission: 0 };
      ex.commission += Number(r.net_commission || 0);
      campMap.set(r.sub_id2, ex);
    });
    const campList = Array.from(campMap.entries()).map(([name, v]) => ({ name, adSpend: v.adSpend, commission: v.commission, profit: v.commission - v.adSpend }));
    campList.sort((a, b) => b.profit - a.profit);
    setCampaigns(campList);

    setLoading(false);
  };

  const roi = totals.adSpend > 0 ? Math.round((totals.profit / totals.adSpend) * 1000) / 10 : null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass-card rounded-lg px-3 py-2 text-[11px] shadow-xl border border-[var(--border)]">
        <div className="text-[var(--muted-foreground)] font-medium mb-1">{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} /><span className="text-[var(--muted-foreground)]">{p.name}:</span><span className="font-mono font-semibold">{formatCompact(p.value)}</span></div>
        ))}
      </div>
    );
  };

  if (loading) return <div className="text-xs text-[var(--muted-foreground)] p-8 text-center">Đang tải...</div>;
  if (!page) return <div className="text-xs text-red-400 p-8 text-center">Không tìm thấy page</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/pages" className="w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--muted)]"><ArrowLeft size={14} /></Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">{page.name}</h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            {(page.assignee as any)?.name || "Chưa giao NV"} · {page.status}
            {page.facebook_uid && <span className="ml-2 font-mono">UID: {page.facebook_uid}</span>}
          </p>
        </div>
        <Link href="/import" className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90">Upload báo cáo</Link>
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
        ].map((m, i) => (
          <div key={i} className={`glass-card rounded-xl p-3 border border-[var(--border)] ${m.glow}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <m.icon size={12} style={{ color: m.color }} />
              <span className="text-[10px] text-[var(--muted-foreground)]">{m.label}</span>
            </div>
            <div className="font-mono text-lg font-bold" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {daily.length > 1 && (
        <div className="glass-card rounded-2xl border border-[var(--border)] mb-4 overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)]"><span className="text-sm font-semibold">Chi Ads vs Hoa hồng theo ngày</span></div>
          <div className="p-4 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="gAd" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gComm" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                </defs>
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

      {/* Campaigns table */}
      {campaigns.length > 0 && (
        <div className="glass-card rounded-2xl border border-[var(--border)] overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-[var(--border)]"><span className="text-sm font-semibold">Chiến dịch ({campaigns.length})</span></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Campaign</th>
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Chi Ads</th>
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Hoa hồng</th>
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Lợi nhuận</th>
              </tr></thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={i} className="border-b border-[var(--border)] row-hover">
                    <td className="px-4 py-2"><div className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${c.profit>0?"bg-green-400":c.profit<0?"bg-red-400":"bg-gray-400"}`} /><span className="text-xs font-mono">{c.name}</span></div></td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-red-400">{c.adSpend > 0 ? formatCompact(c.adSpend) : "—"}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-indigo-400">{c.commission > 0 ? formatCompact(c.commission) : "—"}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs font-bold" style={{ color: c.profit>=0?"#22c55e":"#ef4444" }}>{c.profit>=0?"+":""}{formatCompact(c.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily breakdown table */}
      {daily.length > 0 && (
        <div className="glass-card rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)] flex items-center gap-2"><Calendar size={14} className="text-[var(--muted-foreground)]" /><span className="text-sm font-semibold">Kết quả theo ngày</span></div>
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
                {[...daily].reverse().map((d, i) => (
                  <tr key={i} className="border-b border-[var(--border)] row-hover">
                    <td className="px-4 py-2 text-xs font-mono">{d.date}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-red-400">{d.adSpend > 0 ? formatCompact(d.adSpend) : "—"}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{d.gmv > 0 ? formatCompact(d.gmv) : "—"}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-indigo-400">{d.commission > 0 ? formatCompact(d.commission) : "—"}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{d.orders}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs font-bold" style={{ color: d.profit>=0?"#22c55e":"#ef4444" }}>{d.profit>=0?"+":""}{formatCompact(d.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
