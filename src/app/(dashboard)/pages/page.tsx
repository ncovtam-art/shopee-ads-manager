"use client";
import { useState, useEffect } from "react";
import { FileText, Plus, Search, X, ExternalLink, Trash2, Users, Trophy, Gift } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { formatCompact } from "@/lib/finance";

type PageRow = { id: string; name: string; status: string; assignee_id?: string; assignee_name?: string; adSpend: number; gmv: number; commission: number; orders: number; profit: number; roi: number|null; importCount: number };

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
  const [myRole, setMyRole] = useState("");
  const [showAssign, setShowAssign] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [showReward, setShowReward] = useState(true);
  const [rewardConfig, setRewardConfig] = useState<{ title: string; enabled: boolean; prizes: { rank: number; label: string; prize: string; color: string }[] }>({ title: "🎉 Thưởng Sale 8/8", enabled: true, prizes: [{ rank: 1, label: "🥇 Top 1", prize: "100.000₫", color: "#f59e0b" }] });
  const [showEditReward, setShowEditReward] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editPrizes, setEditPrizes] = useState<{ rank: number; label: string; prize: string; color: string }[]>([]);

  useEffect(() => { fetchAll(); fetchRewardConfig(); }, []);

  const fetchRewardConfig = async () => {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "reward_config").single();
    if (data?.value) setRewardConfig(data.value as any);
  };

  const saveRewardConfig = async () => {
    const newConfig = { ...rewardConfig, title: editTitle, prizes: editPrizes };
    await supabase.from("app_settings").update({ value: newConfig as any, updated_at: new Date().toISOString() }).eq("key", "reward_config");
    setRewardConfig(newConfig);
    setShowEditReward(false);
  };

  const fetchAll = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const role = myProfile?.role || "EMPLOYEE";
    setMyRole(role);
    const isAdmin = role === "ADMIN" || role === "LEADER";

    let pagesQuery = supabase.from("pages").select("*").order("name");
    if (!isAdmin) pagesQuery = pagesQuery.eq("assignee_id", user.id);

    const [{ data: pagesData }, { data: summaryData }, { data: profiles }, { data: batchData }] = await Promise.all([
      pagesQuery,
      supabase.rpc("get_page_summary"),
      supabase.from("profiles").select("id, name"),
      supabase.from("import_batches").select("page_id"),
    ]);

    const empMap = new Map<string, string>();
    profiles?.forEach(p => empMap.set(p.id, p.name));
    const finMap = new Map<string, any>();
    summaryData?.forEach((s: any) => finMap.set(s.page_id, s));
    const importMap = new Map<string, number>();
    batchData?.forEach((b: any) => { if (b.page_id) importMap.set(b.page_id, (importMap.get(b.page_id) || 0) + 1); });

    const result: PageRow[] = (pagesData || []).map(p => {
      const f = finMap.get(p.id);
      const ad = f ? Number(f.total_ad_spend) : 0;
      const comm = f ? Number(f.total_commission) : 0;
      const profit = comm - ad;
      return { id: p.id, name: p.name, status: p.status, assignee_id: p.assignee_id, assignee_name: p.assignee_id ? empMap.get(p.assignee_id) : undefined, adSpend: ad, gmv: f ? Number(f.total_gmv) : 0, commission: comm, orders: f ? Number(f.total_orders) : 0, profit, roi: ad > 0 ? Math.round((profit / ad) * 1000) / 10 : null, importCount: importMap.get(p.id) || 0 };
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

  const handleAssign = async () => {
    if (!showAssign) return;
    await supabase.from("pages").update({ assignee_id: assignTo || null }).eq("id", showAssign);
    setShowAssign(null); setAssignTo(""); fetchAll();
  };

  const handleDelete = async (p: PageRow) => {
    if (!confirm(`Xoá page "${p.name}"?\n\nDữ liệu import của page này sẽ bị xoá.`)) return;
    await supabase.from("fb_ads_data").delete().eq("page_id", p.id);
    await supabase.from("shopee_affiliate_data").delete().eq("page_id", p.id);
    await supabase.from("import_batches").delete().eq("page_id", p.id);
    await supabase.from("pages").delete().eq("id", p.id);
    fetchAll();
  };

  const isAdmin = myRole === "ADMIN" || myRole === "LEADER";
  const filtered = pages.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));
  const totals = filtered.reduce((a, p) => ({ ad: a.ad + p.adSpend, comm: a.comm + p.commission, profit: a.profit + p.profit, orders: a.orders + p.orders }), { ad: 0, comm: 0, profit: 0, orders: 0 });

  // Leaderboard: group by employee, sum profit
  const empProfit = new Map<string, { name: string; profit: number; pages: number; orders: number }>();
  pages.forEach(p => {
    const name = p.assignee_name || "Chưa giao";
    const ex = empProfit.get(name) || { name, profit: 0, pages: 0, orders: 0 };
    ex.profit += p.profit;
    ex.pages += 1;
    ex.orders += p.orders;
    empProfit.set(name, ex);
  });
  const leaderboard = Array.from(empProfit.values()).filter(e => e.name !== "Chưa giao").sort((a, b) => b.profit - a.profit);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-lg font-bold">Pages</h1><p className="text-xs text-[var(--muted-foreground)] mt-0.5">{isAdmin ? `${pages.length} page toàn hệ thống` : `${pages.length} page được giao`}</p></div>
        {isAdmin && <button onClick={() => { setShowAdd(true); setMsg(""); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90"><Plus size={12} /> Thêm Page</button>}
      </div>

      {/* 🏆 Reward Leaderboard */}
      {isAdmin && leaderboard.length > 0 && showReward && rewardConfig.enabled && (
        <div className="glass-card rounded-2xl border border-amber-500/20 mb-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-500/10 flex items-center justify-between bg-gradient-to-r from-amber-500/5 to-transparent">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" />
              <span className="text-sm font-bold text-amber-400">{rewardConfig.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditTitle(rewardConfig.title); setEditPrizes([...rewardConfig.prizes]); setShowEditReward(true); }} className="text-[10px] text-amber-400 hover:underline">Chỉnh sửa</button>
              <button onClick={() => setShowReward(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X size={14} /></button>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {leaderboard.slice(0, 3).map((e, i) => {
                const prize = rewardConfig.prizes.find(p => p.rank === i + 1);
                return (
                  <div key={i} className={`glass-card rounded-xl p-4 border text-center ${i === 0 ? "border-amber-500/30 glow-amber" : "border-[var(--border)]"}`}>
                    <div className="text-2xl mb-1">{prize?.label?.split(" ")[0] || ["🥇", "🥈", "🥉"][i]}</div>
                    <div className="text-sm font-bold mb-0.5">{e.name}</div>
                    <div className={`font-mono text-lg font-bold ${e.profit >= 0 ? "text-green-400" : "text-red-400"}`}>{e.profit > 0 ? "+" : ""}{formatCompact(e.profit)}</div>
                    <div className="text-[10px] text-[var(--muted-foreground)] mt-1">{e.pages} page · {e.orders} đơn</div>
                    {prize && <div className="mt-2 flex items-center justify-center gap-1"><Gift size={12} style={{ color: prize.color }} /><span className="text-xs font-bold" style={{ color: prize.color }}>{prize.prize}</span></div>}
                  </div>
                );
              })}
            </div>
            {leaderboard.length > 3 && (
              <div className="mt-3 space-y-1">
                {leaderboard.slice(3).map((e, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-[var(--muted)]">
                    <div className="flex items-center gap-2"><span className="text-xs text-[var(--muted-foreground)] w-5">{i + 4}</span><span className="text-xs font-medium">{e.name}</span></div>
                    <span className={`font-mono text-xs font-bold ${e.profit >= 0 ? "text-green-400" : "text-red-400"}`}>{e.profit > 0 ? "+" : ""}{formatCompact(e.profit)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 glass-card border border-[var(--border)] rounded-md px-2.5 py-1.5 mb-3 max-w-xs"><Search size={12} className="text-[var(--muted-foreground)]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm page..." className="bg-transparent text-xs outline-none flex-1" /></div>

      {loading ? <div className="glass-card rounded-xl border border-[var(--border)] p-8 text-center text-xs text-[var(--muted-foreground)]">Đang tải...</div> : filtered.length === 0 ? <div className="glass-card rounded-xl border border-[var(--border)] p-8 text-center"><FileText size={24} className="text-[var(--muted-foreground)] mx-auto mb-2" /><div className="text-xs text-[var(--muted-foreground)]">{pages.length === 0 ? (isAdmin ? "Chưa có Page." : "Chưa được giao Page.") : "Không tìm thấy."}</div></div> : (
        <div className="glass-card rounded-2xl border border-[var(--border)] overflow-hidden"><div className="overflow-x-auto">
          <table className="w-full min-w-[800px]"><thead><tr className="border-b border-[var(--border)]">
            <th className="w-10 px-3 py-2.5 text-[10px]">#</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Page</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">NV phụ trách</th>
            <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Chi Ads</th>
            <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Hoa hồng</th>
            <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Lợi nhuận</th>
            <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">ROI</th>
            <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Đơn</th>
            {isAdmin && <th className="w-16 px-3 py-2.5"></th>}
          </tr></thead><tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} className="border-b border-[var(--border)] row-hover transition-colors">
                <td className="px-3 py-2.5 text-center"><div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${i < 3 && p.profit > 0 ? "bg-gradient-to-br from-amber-500 to-amber-600 text-white" : p.profit > 0 ? "bg-green-500/15 text-green-400" : p.profit < 0 ? "bg-red-500/15 text-red-400" : "bg-zinc-500/15 text-zinc-400"}`}>{i < 3 && p.profit > 0 ? ["🥇","🥈","🥉"][i] : i+1}</div></td>
                <td className="px-3 py-2.5"><Link href={`/pages/${p.id}`} className="group"><div className="text-xs font-semibold group-hover:text-[var(--accent)] transition-colors">{p.name}</div><div className="text-[10px] text-[var(--muted-foreground)]">{p.importCount} lần import</div></Link></td>
                <td className="px-3 py-2.5">
                  {isAdmin ? (
                    <button onClick={() => { setShowAssign(p.id); setAssignTo(p.assignee_id || ""); }} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--accent)] flex items-center gap-1 transition-colors">
                      <Users size={10} /> {p.assignee_name || "Chưa giao"}
                    </button>
                  ) : (
                    <span className="text-xs text-[var(--muted-foreground)]">{p.assignee_name || "—"}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-red-400">{p.adSpend > 0 ? formatCompact(p.adSpend) : "—"}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-indigo-400">{p.commission > 0 ? formatCompact(p.commission) : "—"}</td>
                <td className="px-3 py-2.5 text-right"><span className={`font-mono text-xs font-bold ${p.profit>0?"text-green-400":p.profit<0?"text-red-400":"text-[var(--muted-foreground)]"}`}>{p.profit!==0?(p.profit>0?"+":"")+formatCompact(p.profit):"—"}</span></td>
                <td className="px-3 py-2.5 text-right">{p.roi!==null?<span className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${p.roi>=0?"bg-green-500/10 text-green-400":"bg-red-500/10 text-red-400"}`}>{p.roi>0?"+":""}{p.roi}%</span>:<span className="text-[10px] text-[var(--muted-foreground)]">—</span>}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-[var(--muted-foreground)]">{p.orders || "—"}</td>
                {isAdmin && (
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Link href={`/pages/${p.id}`} className="text-[var(--muted-foreground)] hover:text-[var(--accent)]"><ExternalLink size={12} /></Link>
                      <button onClick={() => handleDelete(p)} className="text-[var(--muted-foreground)] hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t-2 border-[var(--border)] bg-[var(--muted)]"><td className="px-3 py-2.5" /><td className="px-3 py-2.5 text-xs font-bold" colSpan={2}>TỔNG ({filtered.length})</td><td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-red-400">{formatCompact(totals.ad)}</td><td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-indigo-400">{formatCompact(totals.comm)}</td><td className="px-3 py-2.5 text-right font-mono text-xs font-bold" style={{ color: totals.profit>=0?"#22c55e":"#ef4444" }}>{totals.profit>0?"+":""}{formatCompact(totals.profit)}</td><td colSpan={isAdmin ? 3 : 2} /></tr></tfoot>
          </table></div></div>
      )}

      {/* Add Modal */}
      {showAdd && isAdmin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md glass-card border border-[var(--border)] rounded-xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between"><span className="text-sm font-semibold">Thêm Page</span><button onClick={() => setShowAdd(false)} className="text-[var(--muted-foreground)]"><X size={16} /></button></div>
            <div className="p-4 space-y-2.5">
              <div><label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Tên Page *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs" placeholder="Page ABC" /></div>
              <div><label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Facebook UID</label><input value={form.facebook_uid} onChange={e => setForm({...form, facebook_uid: e.target.value})} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs" /></div>
              <div><label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Nhân viên phụ trách</label><select value={form.assignee_id} onChange={e => setForm({...form, assignee_id: e.target.value})} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs"><option value="">Chưa giao</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              {msg && <div className="text-xs text-red-400 bg-red-500/10 rounded px-2.5 py-1.5">{msg}</div>}
              <button onClick={handleAdd} disabled={saving} className="w-full py-2 bg-[var(--accent)] text-white rounded-md text-xs font-semibold hover:opacity-90 disabled:opacity-50">{saving ? "Đang tạo..." : "Tạo Page"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && isAdmin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAssign(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-sm glass-card border border-[var(--border)] rounded-xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between"><span className="text-sm font-semibold">Giao Page cho nhân viên</span><button onClick={() => setShowAssign(null)} className="text-[var(--muted-foreground)]"><X size={16} /></button></div>
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

      {/* Edit Reward Modal */}
      {showEditReward && isAdmin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowEditReward(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg glass-card border border-amber-500/20 rounded-xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-amber-500/5">
              <div className="flex items-center gap-2"><Trophy size={14} className="text-amber-400" /><span className="text-sm font-semibold text-amber-400">Chỉnh sửa phần thưởng</span></div>
              <button onClick={() => setShowEditReward(false)} className="text-[var(--muted-foreground)]"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Tiêu đề</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs" placeholder="🎉 Thưởng Sale 8/8" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] text-[var(--muted-foreground)] font-medium">Giải thưởng</label>
                  <button onClick={() => setEditPrizes([...editPrizes, { rank: editPrizes.length + 1, label: `Top ${editPrizes.length + 1}`, prize: "", color: "#6b7280" }])} className="text-[10px] text-[var(--accent)] hover:underline">+ Thêm giải</button>
                </div>
                <div className="space-y-2">
                  {editPrizes.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 glass-card rounded-lg p-2 border border-[var(--border)]">
                      <span className="text-sm w-6 text-center">{["🥇","🥈","🥉","4️⃣","5️⃣"][i] || `${i+1}`}</span>
                      <input value={p.label} onChange={e => { const np = [...editPrizes]; np[i].label = e.target.value; setEditPrizes(np); }} className="flex-1 px-2 py-1 bg-[var(--input)] border border-[var(--border)] rounded text-xs" placeholder="Label" />
                      <input value={p.prize} onChange={e => { const np = [...editPrizes]; np[i].prize = e.target.value; setEditPrizes(np); }} className="flex-1 px-2 py-1 bg-[var(--input)] border border-[var(--border)] rounded text-xs" placeholder="Phần thưởng (100K, Quà...)" />
                      <input type="color" value={p.color} onChange={e => { const np = [...editPrizes]; np[i].color = e.target.value; setEditPrizes(np); }} className="w-7 h-7 rounded cursor-pointer border-0" />
                      <button onClick={() => setEditPrizes(editPrizes.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={rewardConfig.enabled} onChange={e => setRewardConfig({...rewardConfig, enabled: e.target.checked})} className="accent-amber-400 w-3.5 h-3.5" />
                  <span className="text-xs text-[var(--muted-foreground)]">Hiện bảng thưởng</span>
                </label>
              </div>

              <button onClick={saveRewardConfig} className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-md text-xs font-semibold hover:opacity-90">Lưu cấu hình</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
