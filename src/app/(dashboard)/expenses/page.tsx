"use client";
import { useState, useEffect } from "react";
import { DollarSign, Plus, Search, Upload, History } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatMoney, formatFullMoney } from "@/lib/utils";

type Expense = {
  id: string; date: string; page_id: string | null; ads_cost: number; tool_cost: number;
  bm_cost: number; via_cost: number; proxy_cost: number; vps_cost: number;
  staff_cost: number; other_cost: number; total_cost: number; source: string; note: string | null;
  page?: { name: string } | null;
};

export default function ExpensesPage() {
  const supabase = createClient();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pages, setPages] = useState<{id:string;name:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("form");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    page_id: "", ads_cost: "", tool_cost: "", bm_cost: "", via_cost: "",
    proxy_cost: "", vps_cost: "", staff_cost: "", other_cost: "", note: ""
  });

  const fetchExpenses = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("expenses")
      .select("*, page:pages(name)")
      .order("date", { ascending: false })
      .limit(50);
    if (data) setExpenses(data);
    setLoading(false);
  };

  const fetchPages = async () => {
    const { data } = await supabase.from("pages").select("id, name").eq("status", "ACTIVE");
    if (data) setPages(data);
  };

  useEffect(() => { fetchExpenses(); fetchPages(); }, []);

  const totalForm = ["ads_cost","tool_cost","bm_cost","via_cost","proxy_cost","vps_cost","staff_cost","other_cost"]
    .reduce((s, k) => s + (parseFloat((form as any)[k]) || 0), 0);

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMsg("Chưa đăng nhập"); return; }
    if (!form.date) { setMsg("Chọn ngày"); return; }
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      date: form.date,
      page_id: form.page_id || null,
      ads_cost: parseFloat(form.ads_cost) || 0,
      tool_cost: parseFloat(form.tool_cost) || 0,
      bm_cost: parseFloat(form.bm_cost) || 0,
      via_cost: parseFloat(form.via_cost) || 0,
      proxy_cost: parseFloat(form.proxy_cost) || 0,
      vps_cost: parseFloat(form.vps_cost) || 0,
      staff_cost: parseFloat(form.staff_cost) || 0,
      other_cost: parseFloat(form.other_cost) || 0,
      source: "manual",
      note: form.note || null,
      created_by: user.id,
    });
    if (error) { setMsg("Lỗi: " + error.message); setSaving(false); return; }
    setForm({ date: new Date().toISOString().split("T")[0], page_id: "", ads_cost: "", tool_cost: "", bm_cost: "", via_cost: "", proxy_cost: "", vps_cost: "", staff_cost: "", other_cost: "", note: "" });
    setSaving(false);
    setMsg("✅ Đã lưu chi phí!");
    setTimeout(() => setMsg(""), 3000);
    fetchExpenses();
  };

  const costFields = [
    { key: "ads_cost", label: "Chi Ads", color: "#ef4444" },
    { key: "tool_cost", label: "Chi Tool", color: "#6366f1" },
    { key: "bm_cost", label: "Chi BM", color: "#f59e0b" },
    { key: "via_cost", label: "Chi Via", color: "#f59e0b" },
    { key: "proxy_cost", label: "Chi Proxy", color: "#22c55e" },
    { key: "vps_cost", label: "Chi VPS", color: "#22c55e" },
    { key: "staff_cost", label: "Chi Nhân sự", color: "#8b5cf6" },
    { key: "other_cost", label: "Chi Khác", color: "#6b7280" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Chi phí</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Nhập và quản lý chi phí vận hành</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--card)] border border-[var(--border)] rounded-lg p-0.5 w-fit mb-5">
        {[{ k: "form", l: "✏️ Nhập chi phí" }, { k: "history", l: "📋 Lịch sử" }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
            tab === t.k ? "bg-[var(--accent)] text-white" : "text-[var(--muted-foreground)]"
          }`}>{t.l}</button>
        ))}
      </div>

      {/* Form Tab */}
      {tab === "form" && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            <span className="text-sm font-semibold">Nhập chi phí</span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Ngày</label>
                <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Page</label>
                <select value={form.page_id} onChange={e => setForm({...form, page_id: e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                  <option value="">Chung (không gắn Page)</option>
                  {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {costFields.map(f => (
                <div key={f.key}>
                  <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] mb-1">
                    <span className="w-1.5 h-1.5 rounded-sm" style={{ background: f.color }} />
                    {f.label}
                  </label>
                  <input type="number" value={(form as any)[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})}
                    placeholder="0" className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-xs text-[var(--muted-foreground)] mb-1">Ghi chú</label>
              <input value={form.note} onChange={e => setForm({...form, note: e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="VD: Chi ads cho campaign mới..." />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
              <div className="text-sm text-[var(--muted-foreground)]">
                Tổng: <span className="font-mono font-bold text-lg text-[var(--danger)]">{formatFullMoney(totalForm)}</span>
              </div>
              <div className="flex items-center gap-3">
                {msg && <span className={`text-sm ${msg.includes("✅") ? "text-green-400" : "text-[var(--danger)]"}`}>{msg}</span>}
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  <Plus size={14} /> {saving ? "Đang lưu..." : "Lưu chi phí"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Ngày</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Page</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Ads</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Tool</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">BM/Via</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Khác</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Tổng</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Nguồn</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">Đang tải...</td></tr>
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">Chưa có chi phí nào</td></tr>
                ) : expenses.map(e => (
                  <tr key={e.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                    <td className="px-4 py-2.5 text-xs font-mono text-[var(--muted-foreground)]">{e.date}</td>
                    <td className="px-4 py-2.5 text-sm">{e.page?.name || "Chung"}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-red-400">{formatMoney(Number(e.ads_cost))}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-[var(--muted-foreground)]">{formatMoney(Number(e.tool_cost))}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-[var(--muted-foreground)]">{formatMoney(Number(e.bm_cost) + Number(e.via_cost))}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-[var(--muted-foreground)]">{formatMoney(Number(e.proxy_cost) + Number(e.vps_cost) + Number(e.staff_cost) + Number(e.other_cost))}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold text-red-400">{formatMoney(Number(e.total_cost))}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        e.source === "import_fb" ? "bg-indigo-500/10 text-indigo-400" : "bg-amber-500/10 text-amber-400"
                      }`}>{e.source === "import_fb" ? "Import FB" : "Thủ công"}</span>
                    </td>
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
