"use client";
import { useState, useEffect } from "react";
import { Link2, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function SubIdsPage() {
  const supabase = createClient();
  const [subIds, setSubIds] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ sub_id_code: "", name: "", campaign_id: "", product_id: "" });

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from("sub_ids").select("*, campaign:campaigns(name, page:pages(name)), product:products(name)").order("created_at",{ascending:false});
    if (data) setSubIds(data);
    const { data: c } = await supabase.from("campaigns").select("id, name, page:pages(name)").eq("status","ACTIVE");
    if (c) setCampaigns(c);
    const { data: p } = await supabase.from("products").select("id, name");
    if (p) setProducts(p);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const handleAdd = async () => {
    if (!form.sub_id_code || !form.campaign_id) { setMsg("Nhập SubID code và chọn Campaign"); return; }
    setSaving(true);
    const { error } = await supabase.from("sub_ids").insert({
      sub_id_code: form.sub_id_code, name: form.name || null,
      campaign_id: form.campaign_id, product_id: form.product_id || null,
    });
    if (error) { setMsg(error.message.includes("duplicate") ? "SubID đã tồn tại" : "Lỗi: " + error.message); setSaving(false); return; }
    setShowAdd(false); setSaving(false); setForm({ sub_id_code: "", name: "", campaign_id: "", product_id: "" }); fetch();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">SubIDs</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{subIds.length} SubID tracking</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90"><Plus size={14}/> Thêm SubID</button>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead><tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">SubID Code</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Tên</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Campaign</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Page</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Sản phẩm</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Trạng thái</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">Đang tải...</td></tr>
              ) : subIds.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">Chưa có SubID nào</td></tr>
              ) : subIds.map(s => (
                <tr key={s.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                  <td className="px-4 py-3 font-mono text-sm font-medium text-[var(--accent)]">{s.sub_id_code}</td>
                  <td className="px-4 py-3 text-sm">{s.name || "—"}</td>
                  <td className="px-4 py-3 text-sm">{s.campaign?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">{(s.campaign?.page as any)?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">{s.product?.name || "—"}</td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${s.status==="ACTIVE"?"bg-green-500/10 text-green-400":"bg-zinc-500/10 text-zinc-400"}`}>{s.status==="ACTIVE"?"Active":"Ngưng"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <span className="font-semibold">Thêm SubID</span>
              <button onClick={() => setShowAdd(false)} className="text-[var(--muted-foreground)]"><X size={18}/></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">SubID Code *</label>
                <input value={form.sub_id_code} onChange={e=>setForm({...form,sub_id_code:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="sub_skincare_01"/></div>
              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Tên mô tả</label>
                <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="Serum VC - Video 1"/></div>
              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Campaign *</label>
                <select value={form.campaign_id} onChange={e=>setForm({...form,campaign_id:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                  <option value="">Chọn Campaign</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name} ({(c.page as any)?.name})</option>)}
                </select></div>
              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Sản phẩm</label>
                <select value={form.product_id} onChange={e=>setForm({...form,product_id:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                  <option value="">Không gắn</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
              {msg && <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{msg}</div>}
              <button onClick={handleAdd} disabled={saving} className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">{saving?"Đang tạo...":"Thêm SubID"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
