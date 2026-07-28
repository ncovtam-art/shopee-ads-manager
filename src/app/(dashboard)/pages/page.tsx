"use client";
import { useState, useEffect } from "react";
import { FileText, Plus, Search, TrendingUp, TrendingDown, ArrowUpRight, X, Users } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCompact } from "@/lib/finance";

type PageRow = {
  id: string; name: string; facebook_url: string | null; facebook_uid: string | null;
  status: string; assignee_id: string | null; assignee_name?: string;
  adSpend: number; gmv: number; commission: number; orders: number; profit: number;
  roi: number | null;
};

export default function PagesPage() {
  const supabase = createClient();
  const [pages, setPages] = useState<PageRow[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "profit" | "loss">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", facebook_url: "", facebook_uid: "", assignee_id: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAssign, setShowAssign] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: pagesData }, { data: profiles }, financeRes] = await Promise.all([
      supabase.from("pages").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, name"),
      fetch("/api/finance?type=by-page").then(r => r.json()).catch(() => ({ data: [] })),
    ]);

    const empMap = new Map<string, string>();
    profiles?.forEach(p => empMap.set(p.id, p.name));

    const financeMap = new Map<string, any>();
    (financeRes.data || []).forEach((f: any) => financeMap.set(f.pageId, f));

    const merged: PageRow[] = (pagesData || []).map(p => {
      const f = financeMap.get(p.id) || {};
      return {
        ...p,
        assignee_name: p.assignee_id ? empMap.get(p.assignee_id) : undefined,
        adSpend: f.adSpend || 0,
        gmv: f.gmv || 0,
        commission: f.commission || 0,
        orders: f.orders || 0,
        profit: f.profit || 0,
        roi: f.roi ?? null,
      };
    });

    setPages(merged);
    setEmployees(profiles || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.name) { setMsg("Nhập tên Page"); return; }
    setSaving(true);
    const { error } = await supabase.from("pages").insert({
      name: form.name, facebook_url: form.facebook_url || null,
      facebook_uid: form.facebook_uid || null, assignee_id: form.assignee_id || null,
      note: form.note || null, status: "ACTIVE",
    });
    if (error) setMsg("Lỗi: " + error.message);
    else { setForm({ name: "", facebook_url: "", facebook_uid: "", assignee_id: "", note: "" }); setShowAdd(false); fetchAll(); }
    setSaving(false);
  };

  const handleAssign = async () => {
    if (!showAssign || !assignTo) return;
    await supabase.from("pages").update({ assignee_id: assignTo }).eq("id", showAssign);
    // Save assignment history
    await supabase.from("page_assignments").insert({ page_id: showAssign, user_id: assignTo, is_current: true });
    setShowAssign(null); setAssignTo("");
    fetchAll();
  };

  const filtered = pages.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus === "profit" && p.profit <= 0) return false;
    if (filterStatus === "loss" && p.profit >= 0) return false;
    return true;
  }).sort((a, b) => b.profit - a.profit);

  const totalProfit = filtered.reduce((s, p) => s + p.profit, 0);
  const profitCount = pages.filter(p => p.profit > 0).length;
  const lossCount = pages.filter(p => p.profit < 0).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">Pages</h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{pages.length} page · {profitCount} lãi · {lossCount} lỗ</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90">
          <Plus size={12} /> Thêm Page
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 bg-[var(--card)] border border-[var(--border)] rounded-md px-2.5 py-1.5 flex-1 max-w-xs">
          <Search size={12} className="text-[var(--muted-foreground)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm page..." className="bg-transparent text-xs outline-none flex-1" />
        </div>
        <div className="flex gap-0.5 bg-[var(--card)] border border-[var(--border)] rounded-md p-0.5">
          {[{ k: "all" as const, l: "Tất cả" }, { k: "profit" as const, l: "Lãi" }, { k: "loss" as const, l: "Lỗ" }].map(f => (
            <button key={f.k} onClick={() => setFilterStatus(f.k)} className={`px-2.5 py-1 rounded text-[11px] font-medium ${filterStatus === f.k ? "bg-[var(--accent)] text-white" : "text-[var(--muted-foreground)]"}`}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead><tr className="border-b border-[var(--border)]">
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Page</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Nhân viên</th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Chi Ads</th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">GMV</th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Hoa hồng</th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Lợi nhuận</th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">ROI</th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Đơn</th>
              <th className="w-10"></th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-xs text-[var(--muted-foreground)]">Đang tải...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-xs text-[var(--muted-foreground)]">{pages.length === 0 ? "Chưa có Page. Bấm \"Thêm Page\" để bắt đầu." : "Không tìm thấy."}</td></tr>
              ) : filtered.map((p, i) => (
                <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white ${p.profit > 0 ? "bg-green-500" : p.profit < 0 ? "bg-red-500" : "bg-gray-500"}`}>
                        {i + 1}
                      </div>
                      <div>
                        <div className="text-xs font-medium">{p.name}</div>
                        {p.facebook_uid && <div className="text-[10px] text-[var(--muted-foreground)] font-mono">{p.facebook_uid}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => { setShowAssign(p.id); setAssignTo(p.assignee_id || ""); }} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1">
                      <Users size={10} /> {p.assignee_name || "Chưa giao"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-red-400">{p.adSpend > 0 ? formatCompact(p.adSpend) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{p.gmv > 0 ? formatCompact(p.gmv) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-indigo-400">{p.commission > 0 ? formatCompact(p.commission) : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`font-mono text-xs font-bold ${p.profit > 0 ? "text-green-400" : p.profit < 0 ? "text-red-400" : "text-[var(--muted-foreground)]"}`}>
                      {p.profit !== 0 ? (p.profit > 0 ? "+" : "") + formatCompact(p.profit) : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {p.roi !== null ? (
                      <span className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${p.roi >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                        {p.roi > 0 ? "+" : ""}{p.roi}%
                      </span>
                    ) : <span className="text-[10px] text-[var(--muted-foreground)]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-[var(--muted-foreground)]">{p.orders || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${p.status === "ACTIVE" ? "bg-green-500/10 text-green-400" : "bg-zinc-500/10 text-zinc-400"}`}>
                      {p.status === "ACTIVE" ? "●" : "○"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot><tr className="border-t-2 border-[var(--border)] bg-[var(--muted)]">
                <td className="px-3 py-2 text-xs font-bold" colSpan={2}>TỔNG ({filtered.length} page)</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-red-400">{formatCompact(filtered.reduce((s, p) => s + p.adSpend, 0))}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold">{formatCompact(filtered.reduce((s, p) => s + p.gmv, 0))}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-indigo-400">{formatCompact(filtered.reduce((s, p) => s + p.commission, 0))}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold" style={{ color: totalProfit >= 0 ? "#22c55e" : "#ef4444" }}>{totalProfit > 0 ? "+" : ""}{formatCompact(totalProfit)}</td>
                <td className="px-3 py-2" colSpan={3}></td>
              </tr></tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add Page Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-sm font-semibold">Thêm Page</span>
              <button onClick={() => setShowAdd(false)} className="text-[var(--muted-foreground)]"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-2.5">
              <div>
                <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Tên Page *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs" placeholder="Ví dụ: Page Mỹ Phẩm" />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Facebook UID</label>
                <input value={form.facebook_uid} onChange={e => setForm({ ...form, facebook_uid: e.target.value })} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs" placeholder="ID trang Facebook" />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Link Facebook</label>
                <input value={form.facebook_url} onChange={e => setForm({ ...form, facebook_url: e.target.value })} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs" placeholder="https://facebook.com/..." />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Nhân viên phụ trách</label>
                <select value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs">
                  <option value="">Chưa giao</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              {msg && <div className="text-xs text-red-400 bg-red-500/10 rounded px-2.5 py-1.5">{msg}</div>}
              <button onClick={handleAdd} disabled={saving} className="w-full py-2 bg-[var(--accent)] text-white rounded-md text-xs font-semibold hover:opacity-90 disabled:opacity-50">
                {saving ? "Đang tạo..." : "Tạo Page"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAssign(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-sm font-semibold">Giao Page cho nhân viên</span>
              <button onClick={() => setShowAssign(null)} className="text-[var(--muted-foreground)]"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <select value={assignTo} onChange={e => setAssignTo(e.target.value)} className="w-full px-2.5 py-2 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs">
                <option value="">Chưa giao</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <button onClick={handleAssign} className="w-full py-2 bg-[var(--accent)] text-white rounded-md text-xs font-semibold hover:opacity-90">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
