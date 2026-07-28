"use client";
import { useState, useEffect } from "react";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  BarChart3, Download, RefreshCw, Filter, Search
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatMoney, formatFullMoney, formatPercent } from "@/lib/utils";

type CampaignPnl = {
  campaign_name: string;
  page_code: string | null;
  ad_spend: number;
  order_value: number;
  commission: number;
  orders: number;
  profit: number;
  roi_percent: number | null;
  roas: number | null;
};

type SortKey = "campaign_name" | "ad_spend" | "commission" | "profit" | "roi_percent";

export default function ReportsPage() {
  const supabase = createClient();
  const [data, setData] = useState<CampaignPnl[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("profit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterStatus, setFilterStatus] = useState<"all" | "profit" | "loss">("all");

  useEffect(() => { fetchPnl(); }, []);

  const fetchPnl = async () => {
    setLoading(true);

    // Fetch FB Ads data grouped by campaign
    const { data: fbRaw } = await supabase
      .from("fb_ads_data")
      .select("campaign_name, ad_spend");

    // Fetch Shopee data grouped by sub_id2
    const { data: shopeeRaw } = await supabase
      .from("shopee_affiliate_data")
      .select("sub_id1, sub_id2, order_value, net_commission");

    // Aggregate FB by campaign_name
    const fbMap = new Map<string, number>();
    fbRaw?.forEach((r) => {
      const existing = fbMap.get(r.campaign_name) || 0;
      fbMap.set(r.campaign_name, existing + Number(r.ad_spend));
    });

    // Aggregate Shopee by sub_id2
    const shopeeMap = new Map<string, { page: string; orderVal: number; commission: number; orders: number }>();
    shopeeRaw?.forEach((r) => {
      const key = r.sub_id2 || "__no_campaign__";
      const existing = shopeeMap.get(key) || { page: r.sub_id1 || "", orderVal: 0, commission: 0, orders: 0 };
      existing.orderVal += Number(r.order_value);
      existing.commission += Number(r.net_commission);
      existing.orders += 1;
      if (r.sub_id1 && !existing.page) existing.page = r.sub_id1;
      shopeeMap.set(key, existing);
    });

    // Merge
    const allCampaigns = new Set([...fbMap.keys(), ...shopeeMap.keys()]);
    const merged: CampaignPnl[] = [];

    allCampaigns.forEach((name) => {
      if (name === "__no_campaign__") return;
      const adSpend = fbMap.get(name) || 0;
      const shopee = shopeeMap.get(name) || { page: "", orderVal: 0, commission: 0, orders: 0 };
      const profit = shopee.commission - adSpend;
      merged.push({
        campaign_name: name,
        page_code: shopee.page || null,
        ad_spend: adSpend,
        order_value: shopee.orderVal,
        commission: shopee.commission,
        orders: shopee.orders,
        profit,
        roi_percent: adSpend > 0 ? Math.round((profit / adSpend) * 1000) / 10 : null,
        roas: adSpend > 0 ? Math.round((shopee.orderVal / adSpend) * 100) / 100 : null,
      });
    });

    // Handle unmatched shopee data (no campaign)
    const nocamp = shopeeMap.get("__no_campaign__");
    if (nocamp && (nocamp.orderVal > 0 || nocamp.commission > 0)) {
      merged.push({
        campaign_name: "(Không có Sub_id2)",
        page_code: nocamp.page || null,
        ad_spend: 0,
        order_value: nocamp.orderVal,
        commission: nocamp.commission,
        orders: nocamp.orders,
        profit: nocamp.commission,
        roi_percent: null,
        roas: null,
      });
    }

    setData(merged);
    setLoading(false);
  };

  // Filter & sort
  const filtered = data
    .filter((r) => {
      if (search && !r.campaign_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus === "profit" && r.profit <= 0) return false;
      if (filterStatus === "loss" && r.profit >= 0) return false;
      return true;
    })
    .sort((a, b) => {
      const aVal = a[sortBy] ?? -Infinity;
      const bVal = b[sortBy] ?? -Infinity;
      if (typeof aVal === "string" && typeof bVal === "string")
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

  // Totals
  const totals = filtered.reduce(
    (acc, r) => ({
      adSpend: acc.adSpend + r.ad_spend,
      orderValue: acc.orderValue + r.order_value,
      commission: acc.commission + r.commission,
      orders: acc.orders + r.orders,
      profit: acc.profit + r.profit,
    }),
    { adSpend: 0, orderValue: 0, commission: 0, orders: 0, profit: 0 }
  );

  const totalRoi = totals.adSpend > 0 ? Math.round(((totals.commission - totals.adSpend) / totals.adSpend) * 1000) / 10 : 0;
  const totalRoas = totals.adSpend > 0 ? Math.round((totals.orderValue / totals.adSpend) * 100) / 100 : 0;

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(key); setSortDir("desc"); }
  };

  const profitCount = data.filter((r) => r.profit > 0).length;
  const lossCount = data.filter((r) => r.profit < 0).length;

  // Export CSV
  const exportCsv = () => {
    const headers = ["Chiến dịch", "Page", "Chi Ads (₫)", "Giá trị đơn (₫)", "Hoa hồng (₫)", "Đơn", "Lợi nhuận (₫)", "ROI%", "ROAS"];
    const rows = filtered.map((r) => [
      r.campaign_name, r.page_code || "", r.ad_spend, r.order_value, r.commission, r.orders, r.profit,
      r.roi_percent ?? "", r.roas ?? ""
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pnl-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Báo cáo P&L</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Ghép tự động FB Ads ↔ Shopee qua tên chiến dịch = Sub_id2
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPnl}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            <RefreshCw size={14} /> Làm mới
          </button>
          <button
            onClick={exportCsv}
            disabled={!filtered.length}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            <Download size={14} /> Xuất CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {[
          { label: "CHI ADS", value: formatMoney(totals.adSpend), color: "#ef4444" },
          { label: "GIÁ TRỊ ĐƠN", value: formatMoney(totals.orderValue), color: "#22c55e" },
          { label: "HOA HỒNG", value: formatMoney(totals.commission), color: "#6366f1" },
          { label: "LỢI NHUẬN", value: formatMoney(totals.profit), color: totals.profit >= 0 ? "#22c55e" : "#ef4444" },
          { label: "ROI", value: totalRoi + "%", color: totalRoi >= 0 ? "#22c55e" : "#ef4444" },
        ].map((m, i) => (
          <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${m.color}, transparent)` }} />
            <div className="text-[11px] text-[var(--muted-foreground)] mb-1">{m.label}</div>
            <div className="font-mono text-xl font-bold" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Campaign scoreboard */}
      {data.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <button
            onClick={() => setFilterStatus("all")}
            className={`bg-[var(--card)] border rounded-xl p-3 text-center transition-all ${filterStatus === "all" ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
          >
            <div className="font-mono text-2xl font-bold">{data.length}</div>
            <div className="text-xs text-[var(--muted-foreground)]">Tổng chiến dịch</div>
          </button>
          <button
            onClick={() => setFilterStatus("profit")}
            className={`bg-[var(--card)] border rounded-xl p-3 text-center transition-all ${filterStatus === "profit" ? "border-green-500" : "border-[var(--border)]"}`}
          >
            <div className="font-mono text-2xl font-bold text-green-400 flex items-center justify-center gap-1">
              <TrendingUp size={18} /> {profitCount}
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">Có lãi</div>
          </button>
          <button
            onClick={() => setFilterStatus("loss")}
            className={`bg-[var(--card)] border rounded-xl p-3 text-center transition-all ${filterStatus === "loss" ? "border-red-500" : "border-[var(--border)]"}`}
          >
            <div className="font-mono text-2xl font-bold text-red-400 flex items-center justify-center gap-1">
              <TrendingDown size={18} /> {lossCount}
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">Đang lỗ</div>
          </button>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search size={14} className="text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Tìm chiến dịch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none flex-1"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center text-sm text-[var(--muted-foreground)]">
          Đang tải...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center">
          <BarChart3 size={32} className="text-[var(--muted-foreground)] mx-auto mb-3" />
          <div className="text-sm text-[var(--muted-foreground)]">
            {data.length === 0 ? "Chưa có dữ liệu. Import FB Ads và Shopee Affiliate trước." : "Không tìm thấy chiến dịch phù hợp."}
          </div>
        </div>
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {[
                    { key: "campaign_name" as SortKey, label: "CHIẾN DỊCH", align: "left" },
                    { key: null, label: "PAGE", align: "left" },
                    { key: "ad_spend" as SortKey, label: "CHI ADS", align: "right" },
                    { key: null, label: "GIÁ TRỊ ĐƠN", align: "right" },
                    { key: "commission" as SortKey, label: "HOA HỒNG", align: "right" },
                    { key: null, label: "ĐƠN", align: "right" },
                    { key: "profit" as SortKey, label: "LỢI NHUẬN", align: "right" },
                    { key: "roi_percent" as SortKey, label: "ROI", align: "right" },
                    { key: null, label: "ROAS", align: "right" },
                  ].map((col, i) => (
                    <th
                      key={i}
                      onClick={() => col.key && toggleSort(col.key)}
                      className={`px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase whitespace-nowrap ${
                        col.align === "right" ? "text-right" : "text-left"
                      } ${col.key ? "cursor-pointer hover:text-[var(--foreground)]" : ""}`}
                    >
                      {col.label}
                      {col.key === sortBy && (sortDir === "desc" ? " ↓" : " ↑")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors ${
                      r.profit > 0 ? "hover:bg-green-500/5" : r.profit < 0 ? "hover:bg-red-500/5" : ""
                    }`}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            r.profit > 0 ? "bg-green-400" : r.profit < 0 ? "bg-red-400" : "bg-gray-400"
                          }`}
                        />
                        <span className="text-sm font-medium truncate max-w-[220px]">{r.campaign_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm font-mono text-[var(--muted-foreground)]">{r.page_code || "—"}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-red-400">{r.ad_spend > 0 ? formatMoney(r.ad_spend) : "—"}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm">{r.order_value > 0 ? formatMoney(r.order_value) : "—"}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-indigo-400">{r.commission > 0 ? formatMoney(r.commission) : "—"}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-[var(--muted-foreground)]">{r.orders || "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={`font-mono text-sm font-bold ${
                          r.profit > 0 ? "text-green-400" : r.profit < 0 ? "text-red-400" : "text-[var(--muted-foreground)]"
                        }`}
                      >
                        {r.profit > 0 ? "+" : ""}{formatMoney(r.profit)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {r.roi_percent != null ? (
                        <span
                          className={`inline-flex items-center gap-0.5 font-mono text-xs font-semibold px-2 py-1 rounded-md ${
                            r.roi_percent >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {r.roi_percent >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          {r.roi_percent > 0 ? "+" : ""}{r.roi_percent}%
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--muted-foreground)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-[var(--muted-foreground)]">
                      {r.roas != null ? r.roas.toFixed(2) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="border-t-2 border-[var(--border)] bg-[var(--muted)]">
                  <td className="px-3 py-3 text-sm font-bold">TỔNG ({filtered.length} chiến dịch)</td>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 text-right font-mono text-sm font-bold text-red-400">{formatMoney(totals.adSpend)}</td>
                  <td className="px-3 py-3 text-right font-mono text-sm font-bold">{formatMoney(totals.orderValue)}</td>
                  <td className="px-3 py-3 text-right font-mono text-sm font-bold text-indigo-400">{formatMoney(totals.commission)}</td>
                  <td className="px-3 py-3 text-right font-mono text-sm font-bold">{totals.orders}</td>
                  <td className="px-3 py-3 text-right font-mono text-sm font-bold" style={{ color: totals.profit >= 0 ? "#22c55e" : "#ef4444" }}>
                    {totals.profit > 0 ? "+" : ""}{formatMoney(totals.profit)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className={`font-mono text-xs font-semibold px-2 py-1 rounded-md ${
                        totalRoi >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {totalRoi > 0 ? "+" : ""}{totalRoi}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs font-bold text-[var(--muted-foreground)]">
                    {totalRoas.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
