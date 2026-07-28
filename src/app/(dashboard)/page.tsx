"use client";
import { useState, useEffect } from "react";
import {
  TrendingUp, DollarSign, Zap, Star, BarChart3, ShieldCheck,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Upload,
  Megaphone, ShoppingBag
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { formatMoney } from "@/lib/utils";

type CampaignSummary = {
  name: string;
  adSpend: number;
  commission: number;
  profit: number;
};

export default function DashboardPage() {
  const supabase = createClient();
  const [metrics, setMetrics] = useState({
    totalAdSpend: 0, totalOrderValue: 0, totalCommission: 0,
    totalProfit: 0, totalOrders: 0, campaignCount: 0,
    profitCount: 0, lossCount: 0,
    fbBatches: 0, shopeeBatches: 0,
  });
  const [topCampaigns, setTopCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);

    // FB Ads
    const { data: fbRaw } = await supabase
      .from("fb_ads_data").select("campaign_name, ad_spend");
    const fbMap = new Map<string, number>();
    fbRaw?.forEach(r => {
      fbMap.set(r.campaign_name, (fbMap.get(r.campaign_name) || 0) + Number(r.ad_spend));
    });

    // Shopee Affiliate
    const { data: shopeeRaw } = await supabase
      .from("shopee_affiliate_data").select("sub_id2, order_value, net_commission");
    const shopeeMap = new Map<string, { orderVal: number; commission: number; orders: number }>();
    shopeeRaw?.forEach(r => {
      const key = r.sub_id2 || "__none__";
      const ex = shopeeMap.get(key) || { orderVal: 0, commission: 0, orders: 0 };
      ex.orderVal += Number(r.order_value);
      ex.commission += Number(r.net_commission);
      ex.orders += 1;
      shopeeMap.set(key, ex);
    });

    // Merge
    const allKeys = new Set([...fbMap.keys(), ...shopeeMap.keys()]);
    allKeys.delete("__none__");
    let totalAdSpend = 0, totalOrderValue = 0, totalCommission = 0, totalOrders = 0;
    let profitCount = 0, lossCount = 0;
    const campaigns: CampaignSummary[] = [];

    allKeys.forEach(name => {
      const spend = fbMap.get(name) || 0;
      const shopee = shopeeMap.get(name) || { orderVal: 0, commission: 0, orders: 0 };
      const profit = shopee.commission - spend;
      totalAdSpend += spend;
      totalOrderValue += shopee.orderVal;
      totalCommission += shopee.commission;
      totalOrders += shopee.orders;
      if (profit > 0) profitCount++; else if (profit < 0) lossCount++;
      campaigns.push({ name, adSpend: spend, commission: shopee.commission, profit });
    });

    // Import batch counts
    const { count: fbCount } = await supabase.from("import_batches")
      .select("id", { count: "exact" }).eq("type", "fb_ads");
    const { count: shopeeCount } = await supabase.from("import_batches")
      .select("id", { count: "exact" }).eq("type", "shopee_affiliate");

    campaigns.sort((a, b) => b.profit - a.profit);

    setMetrics({
      totalAdSpend, totalOrderValue, totalCommission,
      totalProfit: totalCommission - totalAdSpend,
      totalOrders, campaignCount: allKeys.size,
      profitCount, lossCount,
      fbBatches: fbCount || 0, shopeeBatches: shopeeCount || 0,
    });
    setTopCampaigns(campaigns.slice(0, 10));
    setLoading(false);
  };

  const roi = metrics.totalAdSpend > 0
    ? Math.round(((metrics.totalCommission - metrics.totalAdSpend) / metrics.totalAdSpend) * 1000) / 10
    : 0;

  const roas = metrics.totalAdSpend > 0
    ? (metrics.totalOrderValue / metrics.totalAdSpend).toFixed(2)
    : "0";

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-4 py-3 text-xs shadow-xl">
        <div className="text-[var(--muted-foreground)] font-semibold mb-2">{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-[var(--muted-foreground)]">{p.name}:</span>
            <span className="font-mono font-semibold">{formatMoney(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  // No data state
  if (!loading && metrics.campaignCount === 0 && metrics.fbBatches === 0 && metrics.shopeeBatches === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight">Tổng quan</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-[rgba(238,77,45,0.1)] flex items-center justify-center mx-auto mb-5">
            <Upload size={36} className="text-[var(--accent)]" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Chưa có dữ liệu</h2>
          <p className="text-sm text-[var(--muted-foreground)] max-w-md mx-auto mb-6">
            Bắt đầu bằng cách import file CSV từ Facebook Ads và Shopee Affiliate.
            Hệ thống sẽ tự động ghép theo tên chiến dịch.
          </p>
          <Link
            href="/import"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90"
          >
            <Upload size={16} /> Import dữ liệu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tổng quan</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 rounded-lg">
            <Megaphone size={12} className="text-[#1877f2]" /> {metrics.fbBatches} lần
          </span>
          <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 rounded-lg">
            <ShoppingBag size={12} className="text-[#ee4d2d]" /> {metrics.shopeeBatches} lần
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {[
          { icon: DollarSign, label: "Chi Ads", value: formatMoney(metrics.totalAdSpend), accent: "#ef4444" },
          { icon: TrendingUp, label: "Giá trị đơn hàng", value: formatMoney(metrics.totalOrderValue), accent: "#22c55e" },
          { icon: Zap, label: "Hoa hồng ròng", value: formatMoney(metrics.totalCommission), accent: "#6366f1" },
          { icon: Star, label: "Lợi nhuận", value: (metrics.totalProfit >= 0 ? "+" : "") + formatMoney(metrics.totalProfit), accent: metrics.totalProfit >= 0 ? "#22c55e" : "#ef4444" },
        ].map((m, i) => (
          <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 relative overflow-hidden hover:border-[var(--muted-foreground)]/30 transition-all">
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${m.accent}, transparent)` }} />
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `${m.accent}15` }}>
              <m.icon size={18} style={{ color: m.accent }} />
            </div>
            <div className="font-mono text-2xl font-bold tracking-tight" style={{ color: m.accent }}>{m.value}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">{m.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { icon: BarChart3, label: "ROI", value: (roi >= 0 ? "+" : "") + roi + "%", color: roi >= 0 ? "#22c55e" : "#ef4444" },
          { icon: TrendingUp, label: "ROAS", value: roas },
          { icon: ShieldCheck, label: "Tổng đơn", value: metrics.totalOrders.toLocaleString() },
          { icon: BarChart3, label: "Chiến dịch", value: `${metrics.profitCount}✓ / ${metrics.lossCount}✗` },
        ].map((m, i) => (
          <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
            <div className="w-9 h-9 rounded-lg bg-[var(--muted)] flex items-center justify-center mb-3"><m.icon size={18} className="text-[var(--muted-foreground)]" /></div>
            <div className="font-mono text-2xl font-bold tracking-tight" style={{ color: (m as any).color }}>{m.value}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Top campaigns chart */}
      {topCampaigns.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl mb-5">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-sm font-semibold">Top chiến dịch theo lợi nhuận</span>
            <Link href="/reports" className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
              Xem chi tiết <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCampaigns} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatMoney} />
                <YAxis
                  type="category" dataKey="name" width={140}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + "…" : v}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="profit" name="Lợi nhuận" radius={[0, 4, 4, 0]}>
                  {topCampaigns.map((entry, index) => (
                    <Cell key={index} fill={entry.profit >= 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Campaign detail list */}
      {topCampaigns.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <span className="text-sm font-semibold">Chi tiết top {topCampaigns.length} chiến dịch</span>
          </div>
          {topCampaigns.map((c, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4 border-b border-[var(--border)] text-sm hover:bg-[var(--muted)] transition-colors">
              <span className={`w-2 h-2 rounded-full shrink-0 ${c.profit >= 0 ? "bg-green-400" : "bg-red-400"}`} />
              <span className="flex-1 font-medium truncate">{c.name}</span>
              <span className="font-mono text-xs text-red-400 w-20 text-right">{formatMoney(c.adSpend)}</span>
              <span className="font-mono text-xs text-indigo-400 w-20 text-right">{formatMoney(c.commission)}</span>
              <span className={`font-mono text-xs font-bold w-24 text-right ${c.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                {c.profit >= 0 ? "+" : ""}{formatMoney(c.profit)}
              </span>
            </div>
          ))}
          <div className="px-4 py-3 text-center">
            <Link href="/reports" className="text-xs text-[var(--accent)] hover:underline">
              Xem đầy đủ báo cáo P&L →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
