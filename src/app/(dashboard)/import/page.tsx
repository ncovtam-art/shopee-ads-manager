"use client";
import { useState, useEffect } from "react";
import { Upload, FileText, Check, X, AlertTriangle, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatMoney, formatFullMoney } from "@/lib/utils";
import Papa from "papaparse";

type ParsedRow = {
  id: number; date: string; sub_id_code: string; clicks: number;
  orders: number; revenue: number; commission: number;
  matched_sub_id: string | null; matched_campaign: string | null;
  selected: boolean;
};

export default function ImportShopeePage() {
  const supabase = createClient();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [subIds, setSubIds] = useState<{id:string;sub_id_code:string;campaign:{name:string}|null}[]>([]);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");
  const [batches, setBatches] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("sub_ids").select("id, sub_id_code, campaign:campaigns(name)").then(({data}) => {
      if (data) setSubIds(data as any);
    });
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    const { data } = await supabase.from("import_batches").select("*").eq("type","shopee").order("created_at",{ascending:false}).limit(20);
    if (data) setBatches(data);
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    setMsg("");
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: (r) => processData(r.data) });
  };

  const processData = (raw: any[]) => {
    const parsed: ParsedRow[] = raw.map((r, i) => {
      const subCode = r["Sub ID"] || r["sub_id"] || r["SubID"] || r["Affiliate Sub ID"] || r["Click ID"] || "";
      const revenue = parseFloat(r["Revenue"] || r["Doanh thu"] || r["Item Revenue"] || r["GMV"] || "0");
      const commission = parseFloat(r["Commission"] || r["Hoa hồng"] || r["Estimated Commission"] || r["Commission Amount"] || "0");
      const orders = parseInt(r["Orders"] || r["Đơn hàng"] || r["Conversions"] || r["Order Count"] || "0");
      const clicks = parseInt(r["Clicks"] || r["Lượt click"] || r["Click Count"] || "0");
      const date = r["Date"] || r["Ngày"] || r["Order Date"] || r["Report Date"] || new Date().toISOString().split("T")[0];

      const matched = subIds.find(s => s.sub_id_code === subCode);

      return {
        id: i, date, sub_id_code: subCode, clicks, orders, revenue, commission,
        matched_sub_id: matched?.id || null,
        matched_campaign: (matched?.campaign as any)?.name || null,
        selected: true,
      };
    }).filter(r => r.sub_id_code || r.revenue > 0 || r.commission > 0);

    setRows(parsed);
  };

  const handleImport = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const selected = rows.filter(r => r.selected);
    if (!selected.length) { setMsg("Chọn ít nhất 1 dòng"); return; }

    setImporting(true);

    // Create batch
    const matched = selected.filter(r => r.matched_sub_id).length;
    const { data: batch } = await supabase.from("import_batches").insert({
      filename: fileName, type: "shopee", total_rows: selected.length,
      matched_rows: matched, unmatched_rows: selected.length - matched,
      status: "COMPLETED", created_by: user.id,
    }).select().single();

    if (batch) {
      const inserts = selected.map(r => ({
        date: r.date, sub_id_code: r.sub_id_code,
        sub_id_id: r.matched_sub_id, clicks: r.clicks,
        orders: r.orders, revenue: r.revenue, commission: r.commission,
        matched: !!r.matched_sub_id, import_batch_id: batch.id, created_by: user.id,
      }));

      const { error } = await supabase.from("affiliate_reports").insert(inserts);
      if (error) { setMsg("Lỗi: " + error.message); }
      else {
        setMsg(`✅ Import ${selected.length} dòng thành công! (${matched} matched)`);
        setRows([]); setFileName("");
        fetchBatches();
      }
    }
    setImporting(false);
  };

  const totalRev = rows.filter(r => r.selected).reduce((s, r) => s + r.revenue, 0);
  const totalComm = rows.filter(r => r.selected).reduce((s, r) => s + r.commission, 0);
  const totalOrders = rows.filter(r => r.selected).reduce((s, r) => s + r.orders, 0);
  const matchedCount = rows.filter(r => r.matched_sub_id).length;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Import Shopee Affiliate</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Upload file CSV báo cáo từ Shopee Affiliate</p>
      </div>

      {/* Upload */}
      {rows.length === 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl mb-5">
          <label className="block cursor-pointer">
            <input type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <div className="p-12 flex flex-col items-center text-center hover:bg-[var(--muted)] transition-colors rounded-xl">
              <div className="w-16 h-16 rounded-2xl bg-[rgba(238,77,45,0.1)] flex items-center justify-center mb-4">
                <Upload size={28} className="text-[var(--accent)]" />
              </div>
              <div className="text-base font-semibold mb-1">Upload báo cáo Shopee Affiliate</div>
              <div className="text-sm text-[var(--muted-foreground)] mb-4 max-w-md">
                Export báo cáo từ Shopee Affiliate Dashboard. Hệ thống tự đọc SubID, Revenue, Commission, Orders.
              </div>
              <span className="bg-[var(--muted)] border border-[var(--border)] px-3 py-1 rounded-md text-xs font-semibold text-[var(--muted-foreground)]">.csv</span>
            </div>
          </label>
        </div>
      )}

      {msg && !rows.length && (
        <div className={`text-sm rounded-lg px-4 py-3 mb-4 ${msg.includes("✅") ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{msg}</div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-[11px] text-[var(--muted-foreground)] mb-1">DOANH THU</div>
              <div className="font-mono text-xl font-bold text-green-400">{formatMoney(totalRev)}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-[11px] text-[var(--muted-foreground)] mb-1">HOA HỒNG</div>
              <div className="font-mono text-xl font-bold text-indigo-400">{formatMoney(totalComm)}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-[11px] text-[var(--muted-foreground)] mb-1">TỔNG ĐƠN</div>
              <div className="font-mono text-xl font-bold">{totalOrders.toLocaleString()}</div>
            </div>
            <div className="bg-[var(--card)] border border-green-500/20 rounded-xl p-4">
              <div className="text-[11px] text-[var(--muted-foreground)] mb-1">SUBID MATCHED</div>
              <div className="font-mono text-xl font-bold text-green-400">{matchedCount}<span className="text-sm text-[var(--muted-foreground)]">/{rows.length}</span></div>
            </div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-sm font-semibold">Dữ liệu Shopee — {fileName}</span>
              <button onClick={() => { setRows([]); setFileName(""); }} className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
                <Trash2 size={12} /> Upload lại
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead><tr className="border-b border-[var(--border)]">
                  <th className="w-10 px-3 py-2.5"><input type="checkbox" checked={rows.every(r=>r.selected)} onChange={e=>setRows(rows.map(r=>({...r,selected:e.target.checked})))} className="accent-[var(--accent)]"/></th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">SubID</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Campaign</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Ngày</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Clicks</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Đơn</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Doanh thu</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Hoa hồng</th>
                </tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                      <td className="px-3 py-2.5 text-center"><input type="checkbox" checked={r.selected} onChange={()=>setRows(rows.map(x=>x.id===r.id?{...x,selected:!x.selected}:x))} className="accent-[var(--accent)]"/></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {r.matched_sub_id ? <Check size={13} className="text-green-400"/> : <AlertTriangle size={13} className="text-amber-400"/>}
                          <span className="font-mono text-xs">{r.sub_id_code || "—"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-[var(--muted-foreground)]">{r.matched_campaign || <span className="text-amber-400 text-xs">Chưa ghép</span>}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-[var(--muted-foreground)]">{r.date}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">{r.clicks}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">{r.orders}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm text-green-400">{formatMoney(r.revenue)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm font-semibold text-indigo-400">{formatMoney(r.commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between">
              <span className="text-sm text-[var(--muted-foreground)]">{rows.filter(r=>r.selected).length} dòng được chọn</span>
              <div className="flex items-center gap-3">
                {msg && <span className={`text-sm ${msg.includes("✅")?"text-green-400":"text-red-400"}`}>{msg}</span>}
                <button onClick={handleImport} disabled={importing} className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-green-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  <Check size={14}/> {importing ? "Đang import..." : "Xác nhận import"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {rows.length === 0 && batches.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]"><span className="text-sm font-semibold">Lịch sử import</span></div>
          {batches.map(b => (
            <div key={b.id} className="px-4 py-3 flex items-center gap-4 border-b border-[var(--border)] text-sm">
              <span className="font-mono text-xs text-[var(--muted-foreground)]">#{b.id.slice(0,8)}</span>
              <span className="font-mono text-xs text-[var(--muted-foreground)]">{new Date(b.created_at).toLocaleDateString("vi-VN")}</span>
              <div className="flex items-center gap-1.5 flex-1"><FileText size={14} className="text-indigo-400"/>{b.filename}</div>
              <span className="text-[var(--muted-foreground)]">{b.total_rows} dòng</span>
              <div className="w-20 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-green-400" style={{width: b.total_rows > 0 ? `${(b.matched_rows/b.total_rows)*100}%` : "0%"}}/>
              </div>
              <span className="font-mono text-xs font-semibold text-green-400">{b.total_rows > 0 ? Math.round((b.matched_rows/b.total_rows)*100) : 0}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
