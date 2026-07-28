"use client";
import { useState, useEffect } from "react";
import { Package, Plus, X, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function ProductsPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ name: "", shopee_url: "", shopee_id: "", category: "" });

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from("products").select("*").order("created_at",{ascending:false});
    if (data) setProducts(data);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const handleAdd = async () => {
    if (!form.name) { setMsg("Nhập tên sản phẩm"); return; }
    setSaving(true);
    const { error } = await supabase.from("products").insert({
      name: form.name, shopee_url: form.shopee_url || null,
      shopee_id: form.shopee_id || null, category: form.category || null,
    });
    if (error) { setMsg("Lỗi: " + error.message); setSaving(false); return; }
    setShowAdd(false); setSaving(false); setForm({ name: "", shopee_url: "", shopee_id: "", category: "" }); fetch();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Sản phẩm</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{products.length} sản phẩm đang promote</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90"><Plus size={14}/> Thêm sản phẩm</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading ? (
          <div className="col-span-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center text-sm text-[var(--muted-foreground)]">Đang tải...</div>
        ) : products.length === 0 ? (
          <div className="col-span-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center text-sm text-[var(--muted-foreground)]">Chưa có sản phẩm nào</div>
        ) : products.map(p => (
          <div key={p.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--muted-foreground)]/30 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex items-center justify-center"><Package size={18} className="text-[var(--muted-foreground)]"/></div>
              {p.shopee_url && <a href={p.shopee_url} target="_blank" className="text-[var(--muted-foreground)] hover:text-[var(--accent)]"><ExternalLink size={14}/></a>}
            </div>
            <div className="text-sm font-medium mb-1">{p.name}</div>
            {p.category && <span className="text-[11px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-medium">{p.category}</span>}
            {p.shopee_id && <div className="text-[11px] font-mono text-[var(--muted-foreground)] mt-2">ID: {p.shopee_id}</div>}
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <span className="font-semibold">Thêm sản phẩm</span>
              <button onClick={() => setShowAdd(false)} className="text-[var(--muted-foreground)]"><X size={18}/></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Tên sản phẩm *</label>
                <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="Serum Vitamin C 30ml"/></div>
              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Link Shopee</label>
                <input value={form.shopee_url} onChange={e=>setForm({...form,shopee_url:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="https://shopee.vn/..."/></div>
              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Shopee Product ID</label>
                <input value={form.shopee_id} onChange={e=>setForm({...form,shopee_id:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="123456789"/></div>
              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Danh mục</label>
                <input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="Skincare / Mẹ bé / Công nghệ..."/></div>
              {msg && <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{msg}</div>}
              <button onClick={handleAdd} disabled={saving} className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">{saving?"Đang tạo...":"Thêm sản phẩm"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
