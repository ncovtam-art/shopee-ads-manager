"use client";
import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, Zap, Star, BarChart3, ShieldCheck, ShoppingBag, ArrowUpRight, ArrowDownRight, Upload, Megaphone, AlertTriangle, Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { formatCompact } from "@/lib/finance";

type CampaignRow = { name: string; page: string; adSpend: number; commission: number; profit: number; roi: number|null; orders: number };

export default function DashboardPage() {
  const supabase = createClient();
  const [period, setPeriod] = useState("30d");
  const [adSpend, setAdSpend] = useState(0);
  const [gmv, setGmv] = useState(0);
  const [commission, setCommission] = useState(0);
  const [orders, setOrders] = useState(0);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [fbBatches, setFbBatches] = useState(0);
  const [shopeeBatches, setShopeeBatches] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, [period]);

  const fetchAll = async () => {
    setLoading(true);

    // Fetch all data with page_id
    const [{ data: fbRaw }, { data: shopeeRaw }, { data: pagesData }] = await Promise.all([
      supabase.from("fb_ads_data").select("campaign_name, ad_spend, page_id"),
      supabase.from("shopee_affiliate_data").select("sub_id1, sub_id2, order_value, net_commission, page_id"),
      supabase.from("pages").select("id, name"),
    ]);

    const pageNameMap = new Map<string, string>();
    pagesData?.forEach(p => pageNameMap.set(p.id, p.name));

    const totalAd = fbRaw?.reduce((s, r) => s + Number(r.ad_spend || 0), 0) || 0;
    const totalGmv = shopeeRaw?.reduce((s, r) => s + Number(r.order_value || 0), 0) || 0;
    const totalComm = shopeeRaw?.reduce((s, r) => s + Number(r.net_commission || 0), 0) || 0;
    const totalOrders = shopeeRaw?.length || 0;

    setAdSpend(totalAd); setGmv(totalGmv); setCommission(totalComm); setOrders(totalOrders);

    // Group by PAGE (page_id) — not campaign name
    const pageMap = new Map<string, { adSpend: number; commission: number; orders: number }>();
    fbRaw?.forEach(r => {
      const key = r.page_id || "__no_page__";
      const ex = pageMap.get(key) || { adSpend: 0, commission: 0, orders: 0 };
      ex.adSpend += Number(r.ad_spend || 0);
      pageMap.set(key, ex);
    });
    shopeeRaw?.forEach(r => {
      const key = r.page_id || "__no_page__";
      const ex = pageMap.get(key) || { adSpend: 0, commission: 0, orders: 0 };
      ex.commission += Number(r.net_commission || 0);
      ex.orders += 1;
      pageMap.set(key, ex);
    });

    const rows: CampaignRow[] = Array.from(pageMap.entries())
      .filter(([key]) => key !== "__no_page__")
      .map(([pageId, v]) => {
        const profit = v.commission - v.adSpend;
        return {
          name: pageNameMap.get(pageId) || pageId,
          page: "",
          adSpend: v.adSpend,
          commission: v.commission,
          profit,
          roi: v.adSpend > 0 ? Math.round((profit / v.adSpend) * 1000) / 10 : null,
          orders: v.orders,
        };
      });
    rows.sort((a, b) => b.profit - a.profit);
    setCampaigns(rows.slice(0, 10));

    const { count: fb } = await supabase.from("import_batches").select("id", { count: "exact" }).eq("type", "fb_ads");
    const { count: sp } = await supabase.from("import_batches").select("id", { count: "exact" }).eq("type", "shopee_affiliate");
    setFbBatches(fb || 0); setShopeeBatches(sp || 0);
    setLoading(false);
  };

  const profit = commission - adSpend;
  const roi = adSpend > 0 ? Math.round((profit / adSpend) * 1000) / 10 : null;
  const profitCampaigns = campaigns.filter(c => c.profit > 0).length;
  const lossCampaigns = campaigns.filter(c => c.profit < 0).length;
  const hasData = adSpend > 0 || commission > 0 || fbBatches > 0 || shopeeBatches > 0;

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

  if (!loading && !hasData) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-1">Dashboard</h1>
        <p className="text-xs text-[var(--muted-foreground)] mb-8">{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        <div className="glass-card rounded-2xl p-12 text-center border border-[var(--border)]">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#ee4d2d]/10 to-[#ff6b47]/5 flex items-center justify-center mx-auto mb-5 ring-1 ring-[#ee4d2d]/10">
            <Upload size={36} className="text-[var(--accent)]" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Bắt đầu với dữ liệu của bạn</h2>
          <p className="text-sm text-[var(--muted-foreground)] max-w-md mx-auto mb-6">Import file CSV từ Facebook Ads và Shopee Affiliate để xem Dashboard.</p>
          <Link href="/import" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#ee4d2d] to-[#ff6b47] text-white text-sm font-semibold hover:shadow-lg hover:shadow-[#ee4d2d]/20 transition-all"><Upload size={16} /> Import dữ liệu</Link>
        </div>
      </div>
    );
  }

  const kpis = [
    { icon: DollarSign, label: "Chi Ads", value: formatCompact(adSpend), color: "#ef4444", glow: "glow-red" },
    { icon: TrendingUp, label: "GMV", value: formatCompact(gmv), color: "#3b82f6", glow: "glow-blue" },
    { icon: Zap, label: "Hoa hồng", value: formatCompact(commission), color: "#6366f1", glow: "glow-purple" },
    { icon: Star, label: "Lợi nhuận", value: (profit>=0?"+":"")+formatCompact(profit), color: profit>=0?"#22c55e":"#ef4444", glow: profit>=0?"glow-green":"glow-red" },
    { icon: BarChart3, label: "ROI", value: roi!==null?(roi>0?"+":"")+roi+"%":"—", color: (roi||0)>=0?"#22c55e":"#ef4444", glow: (roi||0)>=0?"glow-green":"glow-red" },
    { icon: Package, label: "Đơn hàng", value: orders.toLocaleString(), color: "#8b5cf6", glow: "glow-purple" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 glass-card rounded-lg p-0.5 border border-[var(--border)]">
            {[{k:"7d",l:"7D"},{k:"30d",l:"30D"},{k:"90d",l:"90D"}].map(p => (
              <button key={p.k} onClick={() => setPeriod(p.k)} className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${period===p.k?"bg-gradient-to-r from-[#ee4d2d] to-[#ff6b47] text-white shadow-sm shadow-[#ee4d2d]/20":"text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}>{p.l}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 glass-card rounded-lg px-2.5 py-1.5 border border-[var(--border)]">
            <Megaphone size={11} className="text-[#1877f2]" /><span className="text-[10px] text-[var(--muted-foreground)] font-mono">{fbBatches}</span>
            <span className="w-px h-3 bg-[var(--border)] mx-1" />
            <ShoppingBag size={11} className="text-[#ee4d2d]" /><span className="text-[10px] text-[var(--muted-foreground)] font-mono">{shopeeBatches}</span>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5 mb-4">
        {kpis.map((m, i) => (
          <div key={i} className={`glass-card rounded-xl p-3.5 border border-[var(--border)] ${m.glow} transition-all hover:scale-[1.02]`}>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${m.color}12` }}><m.icon size={12} style={{ color: m.color }} /></div>
              <span className="text-[10px] text-[var(--muted-foreground)] font-medium">{m.label}</span>
            </div>
            <div className="font-mono text-xl font-bold tracking-tight" style={{ color: m.color }}>{loading ? <div className="skeleton h-6 w-20" /> : m.value}</div>
          </div>
        ))}
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <div className="glass-card rounded-xl p-3 text-center border border-[var(--border)]"><div className="font-mono text-2xl font-bold">{campaigns.length}</div><div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Page</div></div>
        <div className="glass-card rounded-xl p-3 text-center border border-green-500/10 glow-green"><div className="font-mono text-2xl font-bold text-green-400 flex items-center justify-center gap-1"><ArrowUpRight size={16} />{profitCampaigns}</div><div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Page lãi</div></div>
        <div className="glass-card rounded-xl p-3 text-center border border-red-500/10 glow-red"><div className="font-mono text-2xl font-bold text-red-400 flex items-center justify-center gap-1"><ArrowDownRight size={16} />{lossCampaigns}</div><div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Page lỗ</div></div>
      </div>

      {/* Chart */}
      {campaigns.length > 0 && (
        <div className="glass-card rounded-2xl border border-[var(--border)] mb-4 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
            <div><span className="text-sm font-semibold">Top Pages</span><span className="text-[10px] text-[var(--muted-foreground)] ml-2">theo lợi nhuận</span></div>
            <Link href="/reports" className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-0.5 font-medium">Xem P&L <ArrowUpRight size={10} /></Link>
          </div>
          <div className="p-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaigns} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 16) + "…" : v} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="profit" name="Lợi nhuận" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {campaigns.map((e, i) => (<Cell key={i} fill={e.profit >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.85} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      {campaigns.length > 0 && (
        <div className="glass-card rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)]"><span className="text-sm font-semibold">Chi tiết theo Page</span></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px]">
              <thead><tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Page</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Chi Ads</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Hoa hồng</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Lợi nhuận</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">ROI</th>
              </tr></thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={i} className="row-hover border-b border-[var(--border)] transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${i < 3 ? "bg-gradient-to-br from-amber-500 to-amber-600 text-white" : c.profit > 0 ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                          {i < 3 ? ["🥇","🥈","🥉"][i] : i+1}
                        </div>
                        <div><span className="text-xs font-medium">{c.name}</span>{c.page && <span className="text-[10px] text-[var(--muted-foreground)] ml-1.5 font-mono">{c.page}</span>}</div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-red-400">{formatCompact(c.adSpend)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-indigo-400">{formatCompact(c.commission)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-bold" style={{ color: c.profit>=0?"#22c55e":"#ef4444" }}>{c.profit>=0?"+":""}{formatCompact(c.profit)}</td>
                    <td className="px-4 py-2.5 text-right">{c.roi!=null?<span className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold px-2 py-0.5 rounded-md ${c.roi>=0?"bg-green-500/10 text-green-400 ring-1 ring-green-500/10":"bg-red-500/10 text-red-400 ring-1 ring-red-500/10"}`}>{c.roi>=0?<ArrowUpRight size={9}/>:<ArrowDownRight size={9}/>}{c.roi>0?"+":""}{c.roi}%</span>:<span className="text-[10px] text-[var(--muted-foreground)]">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-[var(--border)] text-center">
            <Link href="/reports" className="text-[11px] text-[var(--accent)] hover:underline font-medium">Xem đầy đủ báo cáo P&L →</Link>
          </div>
        </div>
      )}

      {lossCampaigns > 0 && (
        <div className="glass-card rounded-2xl border border-red-500/10 glow-red mt-4 overflow-hidden">
          <div className="px-5 py-3 border-b border-red-500/10 flex items-center gap-2"><AlertTriangle size={14} className="text-red-400" /><span className="text-sm font-semibold text-red-400">Cảnh báo: {lossCampaigns} page lỗ</span></div>
          {campaigns.filter(c => c.profit < 0).slice(0, 5).map((c, i) => (
            <div key={i} className="px-5 py-2.5 flex items-center justify-between border-b border-[var(--border)] last:border-0 row-hover">
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400 pulse-dot" /><span className="text-xs font-medium">{c.name}</span></div>
              <span className="font-mono text-xs text-red-400 font-bold">{formatCompact(c.profit)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
