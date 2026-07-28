"use client";
import { useState, useEffect } from "react";
import { CheckCircle2, X, Check, ClipboardCheck, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatMoney } from "@/lib/utils";

export default function ApprovalsPage() {
  const supabase = createClient();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("PENDING");
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const fetchReports = async () => {
    setLoading(true);
    let query = supabase
      .from("daily_reports")
      .select("*, employee:profiles!daily_reports_employee_id_fkey(name), page:pages(name), approval:approvals(status, reason, reviewer:profiles!approvals_reviewer_id_fkey(name))")
      .order("date", { ascending: false }).limit(50);

    if (tab !== "ALL") query = query.eq("status", tab);
    const { data } = await query;
    if (data) setReports(data);
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, [tab]);

  const handleApprove = async (reportId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("daily_reports").update({ status: "APPROVED" }).eq("id", reportId);
    await supabase.from("approvals").upsert({
      daily_report_id: reportId, reviewer_id: user.id, status: "APPROVED",
    });
    fetchReports();
  };

  const handleReject = async () => {
    if (!rejectModal || !reason.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("daily_reports").update({ status: "REJECTED" }).eq("id", rejectModal);
    await supabase.from("approvals").upsert({
      daily_report_id: rejectModal, reviewer_id: user.id, status: "REJECTED", reason,
    });
    setRejectModal(null);
    setReason("");
    fetchReports();
  };

  const tabs = [
    { k: "PENDING", l: "Chờ duyệt", count: reports.length },
    { k: "APPROVED", l: "Đã duyệt" },
    { k: "REJECTED", l: "Từ chối" },
    { k: "ALL", l: "Tất cả" },
  ];

  const statusColors: Record<string,{bg:string;text:string;label:string}> = {
    DRAFT: { bg:"bg-zinc-500/10", text:"text-zinc-400", label:"Nháp" },
    PENDING: { bg:"bg-amber-500/10", text:"text-amber-400", label:"Chờ duyệt" },
    APPROVED: { bg:"bg-green-500/10", text:"text-green-400", label:"Đã duyệt" },
    REJECTED: { bg:"bg-red-500/10", text:"text-red-400", label:"Từ chối" },
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Duyệt đối chiếu</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Xem xét và duyệt báo cáo cuối ngày của nhân viên</p>
      </div>

      <div className="flex gap-1 bg-[var(--card)] border border-[var(--border)] rounded-lg p-0.5 w-fit mb-5">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
            tab === t.k ? "bg-[var(--accent)] text-white" : "text-[var(--muted-foreground)]"
          }`}>{t.l}</button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center text-sm text-[var(--muted-foreground)]">Đang tải...</div>
        ) : reports.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center text-sm text-[var(--muted-foreground)]">Không có báo cáo nào</div>
        ) : reports.map(r => {
          const profit = Number(r.commission) - Number(r.ads_cost);
          const st = statusColors[r.status] || statusColors.DRAFT;
          const approval = Array.isArray(r.approval) ? r.approval[0] : r.approval;

          return (
            <div key={r.id} className={`bg-[var(--card)] border rounded-xl overflow-hidden ${profit < 0 ? "border-red-500/20" : "border-[var(--border)]"}`}>
              <div className="px-5 py-3 flex items-center gap-3 border-b border-[var(--border)]">
                <ClipboardCheck size={16} className="text-[var(--muted-foreground)]" />
                <span className="font-mono text-xs text-[var(--muted-foreground)]">{r.date}</span>
                <span className="text-sm font-medium">{r.employee?.name}</span>
                <span className="text-[var(--muted-foreground)]">•</span>
                <span className="text-sm text-[var(--muted-foreground)]">{r.page?.name}</span>
                <div className="ml-auto flex items-center gap-2">
                  {profit < 0 && <span className="text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">LỖ</span>}
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                </div>
              </div>

              <div className="px-5 py-3 grid grid-cols-5 gap-4">
                <div><div className="text-[11px] text-[var(--muted-foreground)] mb-1">Chi Ads</div><span className="font-mono text-sm">{formatMoney(Number(r.ads_cost))}</span></div>
                <div><div className="text-[11px] text-[var(--muted-foreground)] mb-1">Hoa hồng</div><span className="font-mono text-sm">{formatMoney(Number(r.commission))}</span></div>
                <div><div className="text-[11px] text-[var(--muted-foreground)] mb-1">Doanh thu</div><span className="font-mono text-sm">{formatMoney(Number(r.revenue))}</span></div>
                <div><div className="text-[11px] text-[var(--muted-foreground)] mb-1">Đơn</div><span className="font-mono text-sm font-semibold">{r.orders}</span></div>
                <div><div className="text-[11px] text-[var(--muted-foreground)] mb-1">Profit</div><span className={`font-mono text-sm font-semibold ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>{profit >= 0 ? "+" : ""}{formatMoney(profit)}</span></div>
              </div>

              {(r.hook || r.video_url) && (
                <div className="px-5 pb-2 flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
                  {r.hook && <span>Hook: "{r.hook}"</span>}
                  {r.video_url && <a href={r.video_url} target="_blank" className="text-[var(--accent)]">Video →</a>}
                </div>
              )}

              {/* Rejection reason */}
              {r.status === "REJECTED" && approval?.reason && (
                <div className="px-5 py-2.5 bg-red-500/5 border-t border-red-500/10 text-xs text-red-400 flex items-center gap-1.5">
                  <XCircle size={14}/> {approval.reason}
                </div>
              )}

              {/* Approve/Reject buttons */}
              {r.status === "PENDING" && (
                <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
                  <button onClick={() => setRejectModal(r.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/10">
                    <X size={14}/> Từ chối
                  </button>
                  <button onClick={() => handleApprove(r.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-500 text-white text-xs font-semibold hover:opacity-90">
                    <Check size={14}/> Duyệt
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setRejectModal(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <span className="font-semibold">Lý do từ chối</span>
              <button onClick={() => setRejectModal(null)} className="text-[var(--muted-foreground)]"><X size={18}/></button>
            </div>
            <div className="p-5">
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Nhập lý do từ chối..."
                className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none mb-4"/>
              <div className="flex justify-end gap-2">
                <button onClick={() => setRejectModal(null)} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--muted-foreground)]">Huỷ</button>
                <button onClick={handleReject} disabled={!reason.trim()} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">Xác nhận từ chối</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
