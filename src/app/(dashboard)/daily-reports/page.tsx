"use client";
import { useState, useEffect } from "react";
import { ClipboardCheck, Plus, X, Send } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatMoney, formatFullMoney } from "@/lib/utils";

export default function DailyReportsPage() {
  const supabase = createClient();
  const [reports, setReports] = useState<any[]>([]);
  const [pages, setPages] = useState<{id:string;name:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0], page_id: "",
    ads_cost: "", commission: "", revenue: "", orders: "",
    video_url: "", hook: "", caption: "", note: "",
  });

  const fetchReports = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("daily_reports")
      .select("*, employee:profiles!daily_reports_employee_id_fkey(name), page:pages(name)")
      .order("date", { ascending: false }).limit(50);
    if (data) setReports(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
    supabase.from("pages").select("id, name").eq("status","ACTIVE").then(({data}) => { if(data) setPages(data); });
  }, []);

  const handleSubmit = async (asDraft: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !form.page_id) { setMsg("Chọn Page"); return; }
    setSaving(true);
    const { error } = await supabase.from("daily_reports").insert({
      date: form.date, employee_id: user.id, page_id: form.page_id,
      ads_cost: parseFloat(form.ads_cost) || 0,
      commission: parseFloat(form.commission) || 0,
      revenue: parseFloat(form.revenue) || 0,
      orders: parseInt(form.orders) || 0,
      video_url: form.video_url || null, hook: form.hook || null,
      caption: form.caption || null, note: form.note || null,
      status: asDraft ? "DRAFT" : "PENDING",
    });
    if (error) { setMsg(error.message.includes("duplicate") ? "Đã tồn tại báo cáo cho Page này trong ngày" : "Lỗi: " + error.message); }
    else { setShowAdd(false); fetchReports(); }
    setSaving(false);
  };

  const profit = (parseFloat(form.commission) || 0) - (parseFloat(form.ads_cost) || 0);

  const statusMap: Record<string, {bg:string;text:string;label:string}> = {
    DRAFT: { bg: "bg-zinc-500/10", text: "text-zinc-400", label: "Nháp" },
    PENDING: { bg: "bg-amber-500/10", text: "text-amber-400", label: "Chờ duyệt" },
    APPROVED: { bg: "bg-green-500/10", text: "text-green-400", label: "Đã duyệt" },
    REJECTED: { bg: "bg-red-500/10", text: "text-red-400", label: "Từ chối" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Đối chiếu cuối ngày</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Nhập dữ liệu cuối ngày cho mỗi Page</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90">
          <Plus size={14} /> Tạo đối chiếu
        </button>
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center text-sm text-[var(--muted-foreground)]">Đang tải...</div>
        ) : reports.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center text-sm text-[var(--muted-foreground)]">Chưa có báo cáo đối chiếu nào</div>
        ) : reports.map(r => {
          const rProfit = Number(r.commission) - Number(r.ads_cost);
          const st = statusMap[r.status] || statusMap.DRAFT;
          return (
            <div key={r.id} className={`bg-[var(--card)] border rounded-xl overflow-hidden transition-colors ${rProfit < 0 ? "border-red-500/20" : "border-[var(--border)]"}`}>
              <div className="px-5 py-3 flex items-center gap-3 border-b border-[var(--border)]">
                <ClipboardCheck size={16} className="text-[var(--muted-foreground)]" />
                <span className="font-mono text-xs text-[var(--muted-foreground)]">{r.date}</span>
                <span className="text-sm font-medium">{r.employee?.name}</span>
                <span className="text-[var(--muted-foreground)]">•</span>
                <span className="text-sm text-[var(--muted-foreground)]">{r.page?.name}</span>
                <div className="ml-auto flex items-center gap-2">
                  {rProfit < 0 && <span className="text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">LỖ</span>}
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                </div>
              </div>
              <div className="px-5 py-3 grid grid-cols-5 gap-4">
                <div><div className="text-[11px] text-[var(--muted-foreground)] mb-1">Chi Ads</div><span className="font-mono text-sm">{formatMoney(Number(r.ads_cost))}</span></div>
                <div><div className="text-[11px] text-[var(--muted-foreground)] mb-1">Hoa hồng</div><span className="font-mono text-sm">{formatMoney(Number(r.commission))}</span></div>
                <div><div className="text-[11px] text-[var(--muted-foreground)] mb-1">Doanh thu</div><span className="font-mono text-sm">{formatMoney(Number(r.revenue))}</span></div>
                <div><div className="text-[11px] text-[var(--muted-foreground)] mb-1">Đơn</div><span className="font-mono text-sm font-semibold">{r.orders}</span></div>
                <div><div className="text-[11px] text-[var(--muted-foreground)] mb-1">Profit</div><span className={`font-mono text-sm font-semibold ${rProfit >= 0 ? "text-green-400" : "text-red-400"}`}>{rProfit >= 0 ? "+" : ""}{formatMoney(rProfit)}</span></div>
              </div>
              {(r.hook || r.video_url) && (
                <div className="px-5 pb-3 flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
                  {r.hook && <span>Hook: "{r.hook}"</span>}
                  {r.video_url && <a href={r.video_url} target="_blank" className="text-[var(--accent)] hover:underline">Video →</a>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between sticky top-0 bg-[var(--card)] z-10">
              <span className="font-semibold">Đối chiếu ngày {form.date}</span>
              <button onClick={() => setShowAdd(false)} className="text-[var(--muted-foreground)]"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Ngày</label>
                  <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"/></div>
                <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Page *</label>
                  <select value={form.page_id} onChange={e=>setForm({...form,page_id:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                    <option value="">Chọn Page</option>{pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Chi Ads (₫)</label>
                  <input type="number" value={form.ads_cost} onChange={e=>setForm({...form,ads_cost:e.target.value})} placeholder="0" className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"/></div>
                <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Hoa hồng (₫)</label>
                  <input type="number" value={form.commission} onChange={e=>setForm({...form,commission:e.target.value})} placeholder="0" className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Doanh thu (₫)</label>
                  <input type="number" value={form.revenue} onChange={e=>setForm({...form,revenue:e.target.value})} placeholder="0" className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"/></div>
                <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Số đơn</label>
                  <input type="number" value={form.orders} onChange={e=>setForm({...form,orders:e.target.value})} placeholder="0" className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"/></div>
              </div>

              {/* Auto-calc */}
              <div className="bg-[var(--muted)] rounded-lg p-3 flex items-center justify-between">
                <span className="text-xs text-[var(--muted-foreground)]">Profit tự tính:</span>
                <span className={`font-mono text-lg font-bold ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {profit >= 0 ? "+" : ""}{formatFullMoney(profit)}
                </span>
              </div>

              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Link video</label>
                <input value={form.video_url} onChange={e=>setForm({...form,video_url:e.target.value})} placeholder="https://tiktok.com/..." className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"/></div>
              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Hook</label>
                <input value={form.hook} onChange={e=>setForm({...form,hook:e.target.value})} placeholder="VD: Chỉ hôm nay giảm 50%..." className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"/></div>
              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Caption</label>
                <textarea value={form.caption} onChange={e=>setForm({...form,caption:e.target.value})} rows={2} placeholder="Caption video..." className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"/></div>
              <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Ghi chú</label>
                <input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"/></div>

              {msg && <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{msg}</div>}

              <div className="flex gap-2 pt-2">
                <button onClick={() => handleSubmit(true)} disabled={saving} className="flex-1 py-2.5 border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-[var(--muted)] disabled:opacity-50">Lưu nháp</button>
                <button onClick={() => handleSubmit(false)} disabled={saving} className="flex-1 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  <Send size={14}/> {saving ? "Đang gửi..." : "Gửi duyệt"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
