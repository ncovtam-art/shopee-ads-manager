"use client";
import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, Zap, Star, BarChart3, ShieldCheck, ShoppingBag, AlertTriangle, ArrowUpRight, ArrowDownRight, Upload, Megaphone } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from "recharts";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { formatCompact, calculateMetrics, profitStatus, profitColor } from "@/lib/finance";

type CampaignRow = { campaignName: string; pageCode: string; adSpend: number; gmv: number; commission: number; orders: number; profit: number; roi: number|null; roas: number|null };

export default function DashboardPage() {
  const supabase = createClient();
  const [period, setPeriod] = useState("30d");
  const [summary, setSummary] = useState({ adSpend:0, gmv:0, commission:0, orders:0, profit:0, roi:null as number|null, commRoas:null as number|null, gmvRoas:null as number|null });
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [fbBatches, setFbBatches] = useState(0);
  const [shopeeBatches, setShopeeBatches] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, [period]);

  const fetchAll = async () => {
    setLoading(true);
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const since = new Date(); since.setDate(since.getDate() - days);
    const dateFrom = since.toISOString().split("T")[0];

    // Fetch from API
    const [summaryRes, campaignRes] = await Promise.all([
      fetch(`/api/finance?type=summary&dateFrom=${dateFrom}`).then(r => r.json()).catch(() => ({ data: {} })),
      fetch(`/api/finance?type=by-campaign&dateFrom=${dateFrom}`).then(r => r.json()).catch(() => ({ data: [] })),
    ]);
    if (summaryRes.data) setSummary(summaryRes.data);
    if (campaignRes.data) setCampaigns(campaignRes.data.slice(0, 10));

    const { count: fb } = await supabase.from("import_batches").select("id", { count: "exact" }).eq("type", "fb_ads");
    const { count: sp } = await supabase.from("import_batches").select("id", { count: "exact" }).eq("type", "shopee_affiliate");
    setFbBatches(fb || 0);
    setShopeeBatches(sp || 0);
    setLoading(false);
  };

  const profitCampaigns = campaigns.filter(c => c.profit > 0).length;
  const lossCampaigns = campaigns.filter(c => c.profit < 0).length;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-md px-3 py-2 text-xs shadow-lg">
        <div className="text-[var(--muted-foreground)] font-medium mb-1">{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
            <span className="text-[var(--muted-foreground)]">{p.name}:</span>
            <span className="font-mono font-semibold">{formatCompact(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  // No data state
  if (!loading && summary.adSpend === 0 && summary.commission === 0 && fbBatches === 0 && shopeeBatches === 0) {
    return (
      <div>
        <h1 className="text-lg font-bold mb-1">Dashboard</h1>
        <p className="text-xs text-[var(--muted-foreground)] mb-6">{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(238,77,45,0.1)] flex items-center justify-center mx-auto mb-4"><Upload size={32} className="text-[var(--accent)]" /></div>
          <h2 className="text-base font-semibold mb-1">Chưa có dữ liệu</h2>
          <p className="text-sm text-[var(--muted-foreground)] max-w-sm mx-auto mb-5">Import file CSV từ Facebook Ads và Shopee Affiliate để bắt đầu.</p>
          <Link href="/import" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90"><Upload size={14} /> Import dữ liệu</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold">Dashboard</h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5 bg-[var(--card)] border border-[var(--border)] rounded-md p-0.5">
            {[{k:"7d",l:"7 ngày"},{k:"30d",l:"30 ngày"},{k:"90d",l:"90 ngày"}].map(p => (
              <button key={p.k} onClick={() => setPeriod(p.k)} className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${period===p.k?"bg-[var(--accent)] text-white":"text-[var(--muted-foreground)] hover:bg-[var(--muted)]"}`}>{p.l}</button>
            ))}
          </div>
          <span className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] bg-[var(--card)] border border-[var(--border)] px-2 py-1 rounded-md">
            <Megaphone size={10} className="text-[#1877f2]" /> {fbBatches}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] bg-[var(--card)] border border-[var(--border)] px-2 py-1 rounded-md">
            <ShoppingBag size={10} className="text-[#ee4d2d]" /> {shopeeBatches}
          </span>
        </div>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-2">
        {[
          { icon: DollarSign, label: "Chi Ads", value: formatCompact(summary.adSpend), color: "#ef4444" },
          { icon: TrendingUp, label: "GMV", value: formatCompact(summary.gmv), color: "#3b82f6" },
          { icon: Zap, label: "Hoa hồng", value: formatCompact(summary.commission), color: "#6366f1" },
          { icon: Star, label: "Lợi nhuận", value: (summary.profit>=0?"+":"")+formatCompact(summary.profit), color: summary.profit>=0?"#22c55e":"#ef4444" },
          { icon: BarChart3, label: "ROI", value: summary.roi!==null?(summary.roi>0?"+":"")+summary.roi+"%":"—", color: (summary.roi||0)>=0?"#22c55e":"#ef4444" },
          { icon: ShieldCheck, label: "Đơn hàng", value: summary.orders.toLocaleString(), color: "#8b5cf6" },
        ].map((m, i) => (
          <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${m.color}80, transparent)` }} />
            <div className="flex items-center gap-1.5 mb-1.5">
              <m.icon size={13} style={{ color: m.color }} />
              <span className="text-[10px] text-[var(--muted-foreground)]">{m.label}</span>
            </div>
            <div className="font-mono text-lg font-bold" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Campaign scoreboard */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-2.5 text-center">
          <div className="font-mono text-xl font-bold">{campaigns.length}</div>
          <div className="text-[10px] text-[var(--muted-foreground)]">Chiến dịch</div>
        </div>
        <div className="bg-[var(--card)] border border-green-500/20 rounded-lg p-2.5 text-center">
          <div className="font-mono text-xl font-bold text-green-400">{profitCampaigns}</div>
          <div className="text-[10px] text-[var(--muted-foreground)]">Có lãi</div>
        </div>
        <div className="bg-[var(--card)] border border-red-500/20 rounded-lg p-2.5 text-center">
          <div className="font-mono text-xl font-bold text-red-400">{lossCampaigns}</div>
          <div className="text-[10px] text-[var(--muted-foreground)]">Đang lỗ</div>
        </div>
      </div>

      {/* Top campaigns chart */}
      {campaigns.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl mb-4">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-sm font-semibold">Top chiến dịch theo lợi nhuận</span>
            <Link href="/reports" className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-0.5">Xem P&L <ArrowUpRight size={10} /></Link>
          </div>
          <div className="p-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaigns} layout="vertical" margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
                <YAxis type="category" dataKey="campaignName" width={120} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 16) + "…" : v} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="profit" name="Lợi nhuận" radius={[0, 3, 3, 0]}>
                  {campaigns.map((entry, index) => (<Cell key={index} fill={entry.profit >= 0 ? "#22c55e" : "#ef4444"} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Campaign detail table */}
      {campaigns.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border)]"><span className="text-sm font-semibold">Chi tiết chiến dịch</span></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead><tr className="border-b border-[var(--border)]">
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Chiến dịch</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Chi Ads</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Hoa hồng</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Lợi nhuận</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">ROI</th>
              </tr></thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                    <td className="px-3 py-2"><div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${c.profit>0?"bg-green-400":c.profit<0?"bg-red-400":"bg-gray-400"}`} /><span className="text-sm truncate max-w-[180px]">{c.campaignName}</span></div></td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-red-400">{formatCompact(c.adSpend)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-indigo-400">{formatCompact(c.commission)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-bold" style={{ color: c.profit>=0?"#22c55e":"#ef4444" }}>{c.profit>=0?"+":""}{formatCompact(c.profit)}</td>
                    <td className="px-3 py-2 text-right">{c.roi!==null?<span className={`font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded ${c.roi>=0?"bg-green-500/10 text-green-400":"bg-red-500/10 text-red-400"}`}>{c.roi>0?"+":""}{c.roi}%</span>:<span className="text-[11px] text-[var(--muted-foreground)]">—</span>}</td>
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
