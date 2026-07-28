"use client";
import { useState } from "react";
import {
  TrendingUp, DollarSign, Zap, Star, BarChart3, ShieldCheck,
  FileText, AlertTriangle, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { formatMoney } from "@/lib/utils";

// Mock data
const chartData = [
  { date: "22/07", revenue: 8200000, expense: 3100000 },
  { date: "23/07", revenue: 9500000, expense: 3400000 },
  { date: "24/07", revenue: 7800000, expense: 2900000 },
  { date: "25/07", revenue: 11200000, expense: 4200000 },
  { date: "26/07", revenue: 10800000, expense: 3800000 },
  { date: "27/07", revenue: 12500000, expense: 4100000 },
  { date: "28/07", revenue: 9800000, expense: 3500000 },
];

const expenseBreakdown = [
  { name: "Ads", value: 68, color: "#ee4d2d" },
  { name: "Tool", value: 12, color: "#6366f1" },
  { name: "BM/Via", value: 10, color: "#f59e0b" },
  { name: "Proxy/VPS", value: 6, color: "#22c55e" },
  { name: "Khác", value: 4, color: "#8b5cf6" },
];

const topPages = [
  { name: "Tech Review Pro", assignee: "Phạm Ngọc Anh", profit: 6700000 },
  { name: "Skincare Lovers VN", assignee: "Nguyễn Minh Tuấn", profit: 5000000 },
  { name: "Thời Trang Nữ HCM", assignee: "Phạm Ngọc Anh", profit: 5000000 },
  { name: "Mẹ và Bé Official", assignee: "Trần Thị Mai", profit: 4300000 },
  { name: "Đồ Gia Dụng Sale", assignee: "Nguyễn Minh Tuấn", profit: -2700000 },
];

const alerts = [
  { type: "danger", message: "Page \"Đồ Gia Dụng Sale\" lỗ liên tục 3 ngày", time: "2 giờ trước" },
  { type: "warning", message: "Lê Văn Hùng chưa đối chiếu ngày 28/07", time: "4 giờ trước" },
];

function MetricCard({ icon: Icon, label, value, sub, trend, trendUp, accent }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  trend?: number; trendUp?: boolean; accent?: string;
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 relative overflow-hidden hover:border-[var(--muted-foreground)]/30 transition-all hover:-translate-y-0.5">
      {accent && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />}
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: accent ? `${accent}15` : "var(--muted)" }}>
          <Icon size={18} style={{ color: accent || "var(--muted-foreground)" }} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold ${trendUp ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
            {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trend}%
          </div>
        )}
      </div>
      <div className="font-mono text-2xl font-bold tracking-tight" style={{ color: accent || "var(--foreground)" }}>{value}</div>
      <div className="text-xs text-[var(--muted-foreground)] mt-1">{label}</div>
      {sub && <div className="text-[11px] text-[var(--muted-foreground)]/60 mt-1">{sub}</div>}
    </div>
  );
}

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

export default function DashboardPage() {
  const [period, setPeriod] = useState("7d");

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tổng quan</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Thứ Ba, 28 tháng 7, 2026</p>
        </div>
        <div className="flex gap-1 bg-[var(--card)] border border-[var(--border)] rounded-lg p-0.5">
          {[{ k: "7d", l: "7 ngày" }, { k: "30d", l: "30 ngày" }, { k: "90d", l: "90 ngày" }].map(p => (
            <button key={p.k} onClick={() => setPeriod(p.k)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                period === p.k ? "bg-[var(--accent)] text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}>{p.l}</button>
          ))}
        </div>
      </div>

      {/* Metrics Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <MetricCard icon={TrendingUp} label="Doanh thu hôm nay" value="9.8tr" sub="Tháng: 285tr" trend={12} trendUp accent="#22c55e" />
        <MetricCard icon={DollarSign} label="Chi phí hôm nay" value="3.5tr" sub="Tháng: 98tr" trend={3} accent="#ef4444" />
        <MetricCard icon={Zap} label="Hoa hồng" value="6.8tr" sub="Tháng: 195tr" trend={8} trendUp accent="#6366f1" />
        <MetricCard icon={Star} label="Lợi nhuận ròng" value="3.3tr" sub="Tháng: 97tr" trend={15} trendUp accent="#f59e0b" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard icon={BarChart3} label="ROI" value="153%" />
        <MetricCard icon={TrendingUp} label="ROAS" value="2.80" />
        <MetricCard icon={ShieldCheck} label="Tổng đơn hôm nay" value="87" sub="Tháng: 2,340" />
        <MetricCard icon={FileText} label="Pages đang chạy" value="24/30" sub="6 page lỗ" />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--danger)]/20 rounded-xl mb-5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center gap-2">
            <AlertTriangle size={16} className="text-[var(--warning)]" />
            <span className="text-sm font-semibold text-[var(--warning)]">Cảnh báo ({alerts.length})</span>
          </div>
          {alerts.map((a, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center gap-2.5 border-b last:border-b-0 border-[var(--border)] text-sm">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.type === "danger" ? "bg-[var(--danger)]" : "bg-[var(--warning)]"}`} />
              <span className="flex-1">{a.message}</span>
              <span className="text-[11px] text-[var(--muted-foreground)] whitespace-nowrap">{a.time}</span>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid lg:grid-cols-5 gap-4 mb-5">
        <div className="lg:col-span-3 bg-[var(--card)] border border-[var(--border)] rounded-xl">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <span className="text-sm font-semibold">Doanh thu & Chi phí</span>
          </div>
          <div className="p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatMoney} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#22c55e" strokeWidth={2} fill="url(#gRev)" />
                <Area type="monotone" dataKey="expense" name="Chi phí" stroke="#ef4444" strokeWidth={2} fill="url(#gExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-xl">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <span className="text-sm font-semibold">Cơ cấu chi phí</span>
          </div>
          <div className="p-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                  {expenseBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v) => v + "%"} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="px-5 pb-4 flex flex-wrap gap-3 justify-center">
            {expenseBreakdown.map(e => (
              <div key={e.name} className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                <span className="w-2 h-2 rounded-sm" style={{ background: e.color }} />{e.name} {e.value}%
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Pages */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <span className="text-sm font-semibold">🏆 Top Pages</span>
          <button className="text-xs text-[var(--accent)] font-medium">Xem tất cả →</button>
        </div>
        {topPages.map((p, i) => (
          <div key={i} className="px-5 py-3 flex items-center gap-3 border-b last:border-b-0 border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
            <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold ${
              i < 3 ? ["bg-amber-500/10 text-amber-500", "bg-zinc-400/10 text-zinc-400", "bg-orange-700/10 text-orange-700"][i] : "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{p.name}</div>
              <div className="text-[11px] text-[var(--muted-foreground)]">{p.assignee}</div>
            </div>
            <span className={`font-mono text-sm font-semibold ${p.profit >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
              {p.profit >= 0 ? "+" : ""}{formatMoney(p.profit)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
