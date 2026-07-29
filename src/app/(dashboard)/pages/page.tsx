"use client";
import { useState, useEffect } from "react";
import { FileText, Plus, Search, X, Users, ArrowUpRight, ArrowDownRight, BarChart3, ExternalLink } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { formatCompact } from "@/lib/finance";

type PageRow = { id: string; name: string; status: string; assignee_name?: string; adSpend: number; gmv: number; commission: number; orders: number; profit: number; roi: number|null; importCount: number };

export default function PagesPage() {
  const supabase = createClient();
  const [pages, setPages] = useState<PageRow[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", facebook_uid: "", assignee_id: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: pagesData }, { data: profiles }, { data: fbData }, { data: shopeeData }, { data: batchData }] = await Promise.all([
      supabase.from("pages").select("*").order("name"),
      supabase.from("profiles").select("id, name"),
      supabase.from("fb_ads_data").select("page_id, ad_spend").limit(100000),
      supabase.from("shopee_affiliate_data").select("page_id, order_value, net_commission").limit(100000),
      supabase.from("import_batches").select("page_id"),
    ]);

    const empMap = new Map<string, string>();
    profiles?.forEach(p => empMap.set(p.id, p.name));

    // Aggregate per page
    const adMap = new Map<string, number>();
    fbData?.forEach(r => { if (r.page_id) adMap.set(r.page_id, (adMap.get(r.page_id) || 0) + Number(r.ad_spend || 0)); });

    const shopMap = new Map<string, { gmv: number; comm: number; orders: number }>();
    shopeeData?.forEach(r => {
      if (!r.page_id) return;
      const ex = shopMap.get(r.page_id) || { gmv: 0, comm: 0, orders: 0 };
      ex.gmv += Number(r.order_value || 0);
      ex.comm += Number(r.net_commission || 0);
      ex.orders += 1;
      shopMap.set(r.page_id, ex);
    });

    const importMap = new Map<string, number>();
    batchData?.forEach(b => { if (b.page_id) importMap.set(b.page_id, (importMap.get(b.page_id) || 0) + 1); });

    const result: PageRow[] = (pagesData || []).map(p => {
      const ad = adMap.get(p.id) || 0;
      const s = shopMap.get(p.id) || { gmv: 0, comm: 0, orders: 0 };
      const profit = s.comm - ad;
      return {
        id: p.id, name: p.name, status: p.status,
        assignee_name: p.assignee_id ? empMap.get(p.assignee_id) : undefined,
        adSpend: ad, gmv: s.gmv, commission: s.comm, orders: s.orders, profit,
        roi: ad > 0 ? Math.round((profit / ad) * 1000) / 10 : null,
        importCount: importMap.get(p.id) || 0,
      };
    });
    result.sort((a, b) => b.profit - a.profit);
    setPages(result);
    setEmployees(profiles || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.name) { setMsg("Nhập tên Page"); return; }
    setSaving(true);
    const { error } = await supabase.from("pages").insert({ name: form.name, facebook_uid: form.facebook_uid || null, assignee_id: form.assignee_id || null, status: "ACTIVE" });
    if (error) setMsg("Lỗi: " + error.message);
    else { setForm({ name: "", facebook_uid: "", assignee_id: "" }); setShowAdd(false); setMsg(""); fetchAll(); }
    setSaving(false);
  };

  const filtered = pages.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));
  const totals = filtered.reduce((a, p) => ({ ad: a.ad + p.adSpend, gmv: a.gmv + p.gmv, comm: a.comm + p.commission, orders: a.orders + p.orders, profit: a.profit + p.profit }), { ad: 0, gmv: 0, comm: 0, orders: 0, profit: 0 });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">Pages</h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{pages.length} page · Bấm vào page để xem chi tiết từng ngày</p>
        </div>
        <button onClick={() => { setShowAdd(true); setMsg(""); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90"><Plus size={12} /> Thêm Page</button>
      </div>

      <div className="flex items-center gap-1.5 glass-card border border-[var(--border)] rounded-md px-2.5 py-1.5 mb-3 max-w-xs">
        <Search size={12} className="text-[var(--muted-foreground)]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm page..." className="bg-transparent text-xs outline-none flex-1" />
      </div>

      {loading ? (
        <div className="glass-card rounded-xl border border-[var(--border)] p-8 text-center text-xs text-[var(--muted-foreground)]">Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-xl border border-[var(--border)] p-8 text-center">
          <FileText size={24} className="text-[var(--muted-foreground)] mx-auto mb-2" />
          <div className="text-xs text-[var(--muted-foreground)]">{pages.length === 0 ? "Chưa có Page. Thêm Page để bắt đầu." : "Không tìm thấy."}</div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px]">
              <thead><tr className="border-b border-[var(--border)]">
                <th className="w-10 px-3 py-2.5 text-[10px]">#</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Page</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">NV</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Chi Ads</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Hoa hồng</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Lợi nhuận</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">ROI</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Đơn</th>
                <th className="w-8"></th>
              </tr></thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} className="border-b border-[var(--border)] row-hover transition-colors">
                    <td className="px-3 py-2.5 text-center">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${i < 3 && p.profit > 0 ? "bg-gradient-to-br from-amber-500 to-amber-600 text-white" : p.profit > 0 ? "bg-green-500/15 text-green-400" : p.profit < 0 ? "bg-red-500/15 text-red-400" : "bg-zinc-500/15 text-zinc-400"}`}>
                        {i < 3 && p.profit > 0 ? ["🥇","🥈","🥉"][i] : i+1}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/pages/${p.id}`} className="group">
                        <div className="text-xs font-semibold group-hover:text-[var(--accent)] transition-colors">{p.name}</div>
                        <div className="text-[10px] text-[var(--muted-foreground)]">{p.importCount} lần import</div>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--muted-foreground)]">{p.assignee_name || "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-red-400">{p.adSpend > 0 ? formatCompact(p.adSpend) : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-indigo-400">{p.commission > 0 ? formatCompact(p.commission) : "—"}</td>
                    <td className="px-3 py-2.5 text-right"><span className={`font-mono text-xs font-bold ${p.profit>0?"text-green-400":p.profit<0?"text-red-400":"text-[var(--muted-foreground)]"}`}>{p.profit!==0?(p.profit>0?"+":"")+formatCompact(p.profit):"—"}</span></td>
                    <td className="px-3 py-2.5 text-right">{p.roi!==null?<span className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${p.roi>=0?"bg-green-500/10 text-green-400":"bg-red-500/10 text-red-400"}`}>{p.roi>0?"+":""}{p.roi}%</span>:<span className="text-[10px] text-[var(--muted-foreground)]">—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-[var(--muted-foreground)]">{p.orders || "—"}</td>
                    <td className="px-3 py-2.5"><Link href={`/pages/${p.id}`} className="text-[var(--muted-foreground)] hover:text-[var(--accent)]"><ExternalLink size={12} /></Link></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-[var(--border)] bg-[var(--muted)]">
                <td className="px-3 py-2.5" /><td className="px-3 py-2.5 text-xs font-bold" colSpan={2}>TỔNG ({filtered.length})</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-red-400">{formatCompact(totals.ad)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-indigo-400">{formatCompact(totals.comm)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs font-bold" style={{ color: totals.profit>=0?"#22c55e":"#ef4444" }}>{totals.profit>0?"+":""}{formatCompact(totals.profit)}</td>
                <td className="px-3 py-2.5" colSpan={3} />
              </tr></tfoot>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md glass-card border border-[var(--border)] rounded-xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between"><span className="text-sm font-semibold">Thêm Page</span><button onClick={() => setShowAdd(false)} className="text-[var(--muted-foreground)]"><X size={16} /></button></div>
            <div className="p-4 space-y-2.5">
              <div><label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Tên Page *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs" placeholder="Page Mỹ Phẩm" /></div>
              <div><label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Facebook UID</label><input value={form.facebook_uid} onChange={e => setForm({...form, facebook_uid: e.target.value})} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs" /></div>
              <div><label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Nhân viên phụ trách</label>
                <select value={form.assignee_id} onChange={e => setForm({...form, assignee_id: e.target.value})} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs"><option value="">Chưa giao</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
              </div>
              {msg && <div className="text-xs text-red-400 bg-red-500/10 rounded px-2.5 py-1.5">{msg}</div>}
              <button onClick={handleAdd} disabled={saving} className="w-full py-2 bg-[var(--accent)] text-white rounded-md text-xs font-semibold hover:opacity-90 disabled:opacity-50">{saving ? "Đang tạo..." : "Tạo Page"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
