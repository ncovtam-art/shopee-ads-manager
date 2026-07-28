"use client";
import { useState, useEffect } from "react";
import { FileText, Plus, Search, X, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatMoney, formatPercent } from "@/lib/utils";

type PageData = {
  id: string; name: string; facebook_url: string | null; facebook_uid: string | null;
  assignee_id: string | null; status: string; note: string | null;
  assignee?: { name: string } | null;
};

export default function PagesPage() {
  const supabase = createClient();
  const [pages, setPages] = useState<PageData[]>([]);
  const [employees, setEmployees] = useState<{id:string;name:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ name: "", facebook_url: "", facebook_uid: "", assignee_id: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchPages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pages")
      .select("*, assignee:profiles!pages_assignee_id_fkey(name)")
      .order("created_at", { ascending: false });
    if (data) setPages(data);
    setLoading(false);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase.from("profiles").select("id, name").eq("status", "ACTIVE");
    if (data) setEmployees(data);
  };

  useEffect(() => { fetchPages(); fetchEmployees(); }, []);

  const handleAdd = async () => {
    if (!form.name) { setMsg("Nhập tên Page"); return; }
    setSaving(true);
    const { error } = await supabase.from("pages").insert({
      name: form.name,
      facebook_url: form.facebook_url || null,
      facebook_uid: form.facebook_uid || null,
      assignee_id: form.assignee_id || null,
      note: form.note || null,
    });
    if (error) { setMsg("Lỗi: " + error.message); setSaving(false); return; }
    setForm({ name: "", facebook_url: "", facebook_uid: "", assignee_id: "", note: "" });
    setShowAdd(false);
    setSaving(false);
    fetchPages();
  };

  const toggleStatus = async (id: string, current: string) => {
    const s = current === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await supabase.from("pages").update({ status: s }).eq("id", id);
    fetchPages();
  };

  const filtered = pages.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    if (filter === "all") return matchSearch;
    return matchSearch && p.status === filter;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Pages</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{pages.length} Facebook Pages</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90">
          <Plus size={14} /> Thêm Page
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 flex-1 max-w-xs">
          <Search size={14} className="text-[var(--muted-foreground)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm page..." className="bg-transparent border-none outline-none text-sm flex-1" />
        </div>
        {["all", "ACTIVE", "INACTIVE"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3.5 py-2 rounded-full text-xs font-medium border transition-all ${
              filter === f ? "border-[var(--accent)] text-[var(--accent)] bg-[rgba(238,77,45,0.08)]" : "border-[var(--border)] text-[var(--muted-foreground)]"
            }`}>
            {f === "all" ? "Tất cả" : f === "ACTIVE" ? "Hoạt động" : "Ngưng"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Page</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Nhân viên</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">UID</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Trạng thái</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Ghi chú</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">Đang tải...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">
                  {pages.length === 0 ? "Chưa có Page nào. Bấm \"Thêm Page\" để bắt đầu." : "Không tìm thấy."}
                </td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{p.name}</div>
                      {p.facebook_url && (
                        <a href={p.facebook_url} target="_blank" rel="noopener" className="text-[var(--muted-foreground)] hover:text-[var(--accent)]">
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{p.assignee?.name || "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono text-[var(--muted-foreground)]">{p.facebook_uid || "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleStatus(p.id, p.status)} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full cursor-pointer ${
                      p.status === "ACTIVE" ? "bg-green-500/10 text-green-400" : "bg-zinc-500/10 text-zinc-400"
                    }`}>
                      {p.status === "ACTIVE" ? "Hoạt động" : "Ngưng"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--muted-foreground)] max-w-[200px] truncate">{p.note || "—"}</td>
                  <td className="px-4 py-3">
                    <button className="w-7 h-7 rounded-md border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
                      <FileText size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-base font-semibold">Thêm Page</span>
              <button onClick={() => setShowAdd(false)} className="text-[var(--muted-foreground)]"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Tên Page *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="VD: Skincare Lovers VN" />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Link Facebook</label>
                <input value={form.facebook_url} onChange={e => setForm({...form, facebook_url: e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="https://facebook.com/..." />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Facebook UID</label>
                <input value={form.facebook_uid} onChange={e => setForm({...form, facebook_uid: e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="VD: 100284756382" />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Nhân viên phụ trách</label>
                <select value={form.assignee_id} onChange={e => setForm({...form, assignee_id: e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                  <option value="">Chưa giao</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Ghi chú</label>
                <input value={form.note} onChange={e => setForm({...form, note: e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="VD: Page chạy sản phẩm skincare" />
              </div>
              {msg && <div className="text-sm text-[var(--danger)] bg-red-500/10 rounded-lg px-3 py-2">{msg}</div>}
              <button onClick={handleAdd} disabled={saving} className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {saving ? "Đang tạo..." : "Thêm Page"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
