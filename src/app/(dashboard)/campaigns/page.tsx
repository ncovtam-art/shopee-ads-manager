"use client";
import { useState, useEffect } from "react";
import { Target, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatFullMoney } from "@/lib/utils";

export default function CampaignsPage() {
  const supabase = createClient();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [pages, setPages] = useState<{id:string;name:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ name: "", page_id: "", start_date: new Date().toISOString().split("T")[0], budget: "", note: "" });

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from("campaigns").select("*, page:pages(name)").order("created_at", { ascending: false });
    if (data) setCampaigns(data);
    const { data: p } = await supabase.from("pages").select("id, name").eq("status", "ACTIVE");
    if (p) setPages(p);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.page_id) { setMsg("Nhập tên và chọn Page"); return; }
    setSaving(true);
    const { error } = await supabase.from("campaigns").insert({
      name: form.name, page_id: form.page_id, start_date: form.start_date,
      budget: parseFloat(form.budget) || null, note: form.note || null,
    });
    if (error) { setMsg("Lỗi: " + error.message); setSaving(false); return; }
    setShowAdd(false); setSaving(false);
    setForm({ name: "", page_id: "", start_date: new Date().toISOString().split("T")[0], budget: "", note: "" });
    fetch();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{campaigns.length} chiến dịch</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90">
          <Plus size={14} /> Thêm Campaign
        </button>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-[var(--border)]">
            <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Campaign</th>
            <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Page</th>
            <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Ngày bắt đầu</th>
            <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Ngân sách</th>
            <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Trạng thái</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">Đang tải...</td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">Chưa có campaign nào</td></tr>
            ) : campaigns.map(c => (
              <tr key={c.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                <td className="px-4 py-3 text-sm font-medium">{c.name}</td>
                <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">{c.page?.name || "—"}</td>
                <td className="px-4 py-3 text-xs font-mono text-[var(--muted-foreground)]">{c.start_date}</td>
                <td className="px-4 py-3 text-right font-mono text-sm">{c.budget ? formatFullMoney(Number(c.budget)) : "—"}</td>
                <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${c.status==="ACTIVE" ? "bg-green-500/10 text-green-400" : "bg-zinc-500/10 text-zinc-400"}`}>{c.status==="ACTIVE"?"Đang chạy":"Ngưng"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <span className="font-semibold">Thêm Campaign</span>
              <button onClick={() => setShowAdd(false)} className="text-[var(--muted-foreground)]"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Tên Campaign *</label>
                <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="VD: Serum VC - Broad 25-45"/></div>
              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Page *</label>
                <select value={form.page_id} onChange={e=>setForm({...form,page_id:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                  <option value="">Chọn Page</option>{pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Ngày bắt đầu</label>
                <input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"/></div>
              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Ngân sách (₫)</label>
                <input type="number" value={form.budget} onChange={e=>setForm({...form,budget:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="5000000"/></div>
              {msg && <div className="text-sm text-[var(--danger)] bg-red-500/10 rounded-lg px-3 py-2">{msg}</div>}
              <button onClick={handleAdd} disabled={saving} className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">{saving?"Đang tạo...":"Thêm Campaign"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
