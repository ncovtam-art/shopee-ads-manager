"use client";
import { useState, useEffect } from "react";
import {
  TrendingUp, DollarSign, Zap, Star, BarChart3, ShieldCheck,
  FileText, AlertTriangle, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from "recharts";
import { createClient } from "@/lib/supabase";
import { formatMoney } from "@/lib/utils";

export default function DashboardPage() {
  const supabase = createClient();
  const [period, setPeriod] = useState("7d");
  const [metrics, setMetrics] = useState({ revenue: 0, expense: 0, commission: 0, profit: 0, orders: 0, pagesActive: 0, pagesTotal: 0, pagesLoss: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [topPages, setTopPages] = useState<any[]>([]);
  const [topEmployees, setTopEmployees] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<{type:string;message:string}[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, [period]);

  const fetchAll = async () => {
    setLoading(true);
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const since = new Date(); since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    // Expenses
    const { data: expenses } = await supabase.from("expenses").select("date, ads_cost, total_cost").gte("date", sinceStr);
    const totalExpense = expenses?.reduce((s, e) => s + Number(e.total_cost), 0) || 0;
    const totalAdsCost = expenses?.reduce((s, e) => s + Number(e.ads_cost), 0) || 0;
    const todayExpense = expenses?.filter(e => e.date === today).reduce((s, e) => s + Number(e.total_cost), 0) || 0;

    // Affiliate reports
    const { data: affiliate } = await supabase.from("affiliate_reports").select("date, revenue, commission, orders").gte("date", sinceStr);
    const totalRevenue = affiliate?.reduce((s, a) => s + Number(a.revenue), 0) || 0;
    const totalCommission = affiliate?.reduce((s, a) => s + Number(a.commission), 0) || 0;
    const totalOrders = affiliate?.reduce((s, a) => s + a.orders, 0) || 0;
    const todayRev = affiliate?.filter(a => a.date === today).reduce((s, a) => s + Number(a.revenue), 0) || 0;
    const todayComm = affiliate?.filter(a => a.date === today).reduce((s, a) => s + Number(a.commission), 0) || 0;
    const todayOrders = affiliate?.filter(a => a.date === today).reduce((s, a) => s + a.orders, 0) || 0;

    // Pages
    const { data: pages } = await supabase.from("pages").select("id, name, status, assignee_id");
    const activePages = pages?.filter(p => p.status === "ACTIVE").length || 0;

    // Chart data - group by date
    const dateMap: Record<string, { revenue: number; expense: number }> = {};
    for (let d = new Date(since); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split("T")[0];
      dateMap[ds] = { revenue: 0, expense: 0 };
    }
    expenses?.forEach(e => { if (dateMap[e.date]) dateMap[e.date].expense += Number(e.total_cost); });
    affiliate?.forEach(a => { if (dateMap[a.date]) dateMap[a.date].revenue += Number(a.revenue); });

    const chart = Object.entries(dateMap).map(([date, v]) => ({
      date: `${date.slice(8,10)}/${date.slice(5,7)}`,
      revenue: v.revenue,
      expense: v.expense,
    }));

    // Top pages by expense (simple ranking)
    const pageExpenses: Record<string, number> = {};
    expenses?.forEach(e => { if (e.ads_cost) pageExpenses["all"] = (pageExpenses["all"] || 0) + Number(e.ads_cost); });

    // Pending approvals
    const { count } = await supabase.from("daily_reports").select("id", { count: "exact" }).eq("status", "PENDING");

    // Alerts
    const newAlerts: {type:string;message:string}[] = [];
    if ((count || 0) > 0) newAlerts.push({ type: "warning", message: `${count} báo cáo đối chiếu chờ duyệt` });
    if (todayExpense > todayComm && todayExpense > 0) newAlerts.push({ type: "danger", message: `Chi ads hôm nay (${formatMoney(todayExpense)}) lớn hơn hoa hồng (${formatMoney(todayComm)})` });

    setMetrics({
      revenue: todayRev || totalRevenue,
      expense: todayExpense || totalExpense,
      commission: todayComm || totalCommission,
      profit: (todayComm || totalCommission) - (todayExpense || totalExpense),
      orders: todayOrders || totalOrders,
      pagesActive: activePages,
      pagesTotal: pages?.length || 0,
      pagesLoss: 0,
    });
    setChartData(chart);
    setAlerts(newAlerts);
    setPendingCount(count || 0);
    setLoading(false);
  };

  const roi = metrics.expense > 0 ? Math.round(((metrics.commission - metrics.expense) / metrics.expense) * 100) : 0;
  const roas = metrics.expense > 0 ? (metrics.revenue / metrics.expense).toFixed(2) : "0";

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tổng quan</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{new Date().toLocaleDateString("vi-VN", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}</p>
        </div>
        <div className="flex gap-1 bg-[var(--card)] border border-[var(--border)] rounded-lg p-0.5">
          {[{k:"7d",l:"7 ngày"},{k:"30d",l:"30 ngày"},{k:"90d",l:"90 ngày"}].map(p => (
            <button key={p.k} onClick={() => setPeriod(p.k)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${period===p.k?"bg-[var(--accent)] text-white":"text-[var(--muted-foreground)]"}`}>{p.l}</button>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {[
          { icon: TrendingUp, label: "Doanh thu", value: formatMoney(metrics.revenue), accent: "#22c55e" },
          { icon: DollarSign, label: "Chi phí", value: formatMoney(metrics.expense), accent: "#ef4444" },
          { icon: Zap, label: "Hoa hồng", value: formatMoney(metrics.commission), accent: "#6366f1" },
          { icon: Star, label: "Lợi nhuận", value: formatMoney(metrics.profit), accent: "#f59e0b" },
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
          { icon: BarChart3, label: "ROI", value: roi + "%" },
          { icon: TrendingUp, label: "ROAS", value: roas },
          { icon: ShieldCheck, label: "Tổng đơn", value: metrics.orders.toLocaleString() },
          { icon: FileText, label: "Pages hoạt động", value: `${metrics.pagesActive}/${metrics.pagesTotal}` },
        ].map((m, i) => (
          <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
            <div className="w-9 h-9 rounded-lg bg-[var(--muted)] flex items-center justify-center mb-3"><m.icon size={18} className="text-[var(--muted-foreground)]"/></div>
            <div className="font-mono text-2xl font-bold tracking-tight">{m.value}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-[var(--card)] border border-amber-500/20 rounded-xl mb-5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">Cảnh báo ({alerts.length})</span>
          </div>
          {alerts.map((a, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center gap-2.5 border-b last:border-b-0 border-[var(--border)] text-sm">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.type==="danger"?"bg-red-400":"bg-amber-400"}`}/>
              <span className="flex-1">{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl mb-5">
          <div className="px-5 py-4 border-b border-[var(--border)]"><span className="text-sm font-semibold">Doanh thu & Chi phí</span></div>
          <div className="p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                <XAxis dataKey="date" tick={{fill:"var(--muted-foreground)",fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"var(--muted-foreground)",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={formatMoney}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#22c55e" strokeWidth={2} fill="url(#gR)"/>
                <Area type="monotone" dataKey="expense" name="Chi phí" stroke="#ef4444" strokeWidth={2} fill="url(#gE)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {loading && !chartData.length && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center text-sm text-[var(--muted-foreground)]">
          {metrics.revenue === 0 && metrics.expense === 0 ? "Chưa có dữ liệu. Bắt đầu bằng cách thêm Page, nhập chi phí và import Shopee." : "Đang tải..."}
        </div>
      )}
    </div>
  );
}
