"use client";
import { useState, useEffect, useCallback } from "react";
import { DollarSign, Upload, FileText, Check, X, AlertTriangle, History, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatMoney, formatFullMoney } from "@/lib/utils";
import Papa from "papaparse";

type ParsedRow = {
  id: number;
  campaign_name: string;
  ad_set_name: string;
  ad_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  date: string;
  matched_page_id: string | null;
  matched_page_name: string | null;
  selected: boolean;
};

type PageOption = { id: string; name: string };

export default function ExpensesPage() {
  const supabase = createClient();
  const [tab, setTab] = useState("import");
  const [pages, setPages] = useState<PageOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Import state
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  // History state
  const [expenses, setExpenses] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Manual state
  const [manualForm, setManualForm] = useState({
    date: new Date().toISOString().split("T")[0],
    page_id: "", ads_cost: "", tool_cost: "", bm_cost: "", via_cost: "",
    proxy_cost: "", vps_cost: "", staff_cost: "", other_cost: "", note: ""
  });
  const [manualSaving, setManualSaving] = useState(false);
  const [manualMsg, setManualMsg] = useState("");

  useEffect(() => {
    supabase.from("pages").select("id, name").eq("status", "ACTIVE").then(({ data }) => {
      if (data) setPages(data);
    });
  }, []);

  // ── FILE PARSER ──
  const handleFile = (file: File) => {
    setFileName(file.name);
    setImportMsg("");

    if (file.name.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => processData(result.data),
      });
    } else {
      setImportMsg("Hiện tại chỉ hỗ trợ file .csv. Export báo cáo Facebook Ads dạng CSV.");
    }
  };

  const processData = (rawData: any[]) => {
    const rows: ParsedRow[] = rawData.map((row, i) => {
      // Facebook Ads CSV columns (Vietnamese or English)
      const spend = parseFloat(row["Amount spent (VND)"] || row["Amount Spent (VND)"] || row["Số tiền đã chi tiêu (VND)"] || row["amount_spent"] || row["spend"] || row["Chi phí"] || row["Amount spent"] || "0");
      const impressions = parseInt(row["Impressions"] || row["Lượt hiển thị"] || row["impressions"] || "0");
      const clicks = parseInt(row["Link clicks"] || row["Clicks (all)"] || row["Lượt nhấp vào liên kết"] || row["clicks"] || "0");
      const campaign = row["Campaign name"] || row["Tên chiến dịch"] || row["campaign_name"] || "";
      const adSet = row["Ad set name"] || row["Tên nhóm quảng cáo"] || row["ad_set_name"] || "";
      const adName = row["Ad name"] || row["Tên quảng cáo"] || row["ad_name"] || "";
      const date = row["Day"] || row["Ngày"] || row["date"] || row["Reporting starts"] || new Date().toISOString().split("T")[0];

      // Auto-match page by campaign/ad name
      let matchedPage: PageOption | undefined;
      const searchText = `${campaign} ${adSet} ${adName}`.toLowerCase();
      matchedPage = pages.find(p => searchText.includes(p.name.toLowerCase()));

      return {
        id: i,
        campaign_name: campaign,
        ad_set_name: adSet,
        ad_name: adName,
        spend,
        impressions,
        clicks,
        ctr: impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0,
        cpc: clicks > 0 ? Math.round(spend / clicks) : 0,
        date: date,
        matched_page_id: matchedPage?.id || null,
        matched_page_name: matchedPage?.name || null,
        selected: spend > 0,
      };
    }).filter(r => r.spend > 0 || r.campaign_name);

    setParsedRows(rows);
  };

  const toggleRow = (id: number) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const setRowPage = (id: number, pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, matched_page_id: pageId, matched_page_name: page?.name || null } : r));
  };

  const toggleAll = (checked: boolean) => {
    setParsedRows(prev => prev.map(r => ({ ...r, selected: checked })));
  };

  // ── IMPORT TO DB ──
  const handleImport = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImportMsg("Chưa đăng nhập"); return; }

    const selected = parsedRows.filter(r => r.selected && r.spend > 0);
    if (selected.length === 0) { setImportMsg("Chọn ít nhất 1 dòng để import"); return; }

    setImporting(true);
    setImportMsg("");

    // Group by page_id + date
    const grouped: Record<string, { date: string; page_id: string | null; ads_cost: number; note: string }> = {};
    selected.forEach(r => {
      const key = `${r.date}_${r.matched_page_id || "none"}`;
      if (!grouped[key]) {
        grouped[key] = { date: r.date, page_id: r.matched_page_id, ads_cost: 0, note: "" };
      }
      grouped[key].ads_cost += r.spend;
      grouped[key].note += (grouped[key].note ? ", " : "") + (r.campaign_name || r.ad_name);
    });

    const inserts = Object.values(grouped).map(g => ({
      date: g.date,
      page_id: g.page_id,
      ads_cost: g.ads_cost,
      tool_cost: 0, bm_cost: 0, via_cost: 0, proxy_cost: 0, vps_cost: 0, staff_cost: 0, other_cost: 0,
      source: "import_fb",
      note: `FB Ads: ${g.note}`.slice(0, 500),
      created_by: user.id,
    }));

    const { error } = await supabase.from("expenses").insert(inserts);
    if (error) {
      setImportMsg("Lỗi: " + error.message);
    } else {
      setImportMsg(`✅ Đã import ${selected.length} dòng (${inserts.length} bản ghi chi phí)`);
      setParsedRows([]);
      setFileName("");
    }
    setImporting(false);
  };

  // ── HISTORY ──
  const fetchHistory = async () => {
    setHistoryLoading(true);
    const { data } = await supabase.from("expenses").select("*, page:pages(name)").order("date", { ascending: false }).limit(100);
    if (data) setExpenses(data);
    setHistoryLoading(false);
  };
  useEffect(() => { if (tab === "history") fetchHistory(); }, [tab]);

  // ── MANUAL ──
  const totalManual = ["ads_cost","tool_cost","bm_cost","via_cost","proxy_cost","vps_cost","staff_cost","other_cost"]
    .reduce((s, k) => s + (parseFloat((manualForm as any)[k]) || 0), 0);

  const handleManualSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setManualSaving(true);
    const { error } = await supabase.from("expenses").insert({
      date: manualForm.date, page_id: manualForm.page_id || null,
      ads_cost: parseFloat(manualForm.ads_cost) || 0, tool_cost: parseFloat(manualForm.tool_cost) || 0,
      bm_cost: parseFloat(manualForm.bm_cost) || 0, via_cost: parseFloat(manualForm.via_cost) || 0,
      proxy_cost: parseFloat(manualForm.proxy_cost) || 0, vps_cost: parseFloat(manualForm.vps_cost) || 0,
      staff_cost: parseFloat(manualForm.staff_cost) || 0, other_cost: parseFloat(manualForm.other_cost) || 0,
      source: "manual", note: manualForm.note || null, created_by: user.id,
    });
    if (error) { setManualMsg("Lỗi: " + error.message); }
    else { setManualMsg("✅ Đã lưu!"); setTimeout(() => setManualMsg(""), 3000); }
    setManualSaving(false);
  };

  const matchedCount = parsedRows.filter(r => r.matched_page_id).length;
  const unmatchedCount = parsedRows.filter(r => !r.matched_page_id).length;
  const totalSpend = parsedRows.filter(r => r.selected).reduce((s, r) => s + r.spend, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Chi phí</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Import báo cáo Facebook Ads hoặc nhập thủ công</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--card)] border border-[var(--border)] rounded-lg p-0.5 w-fit mb-5">
        {[
          { k: "import", l: "📥 Import báo cáo Ads" },
          { k: "manual", l: "✏️ Nhập thủ công" },
          { k: "history", l: "📋 Lịch sử" },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
            tab === t.k ? "bg-[var(--accent)] text-white" : "text-[var(--muted-foreground)]"
          }`}>{t.l}</button>
        ))}
      </div>

      {/* ═══ TAB: IMPORT ═══ */}
      {tab === "import" && (
        <div>
          {/* Upload Zone */}
          {parsedRows.length === 0 && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl mb-5">
              <label className="block cursor-pointer">
                <input type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <div className="p-12 flex flex-col items-center text-center hover:bg-[var(--muted)] transition-colors rounded-xl">
                  <div className="w-16 h-16 rounded-2xl bg-[rgba(238,77,45,0.1)] flex items-center justify-center mb-4">
                    <Upload size={28} className="text-[var(--accent)]" />
                  </div>
                  <div className="text-base font-semibold mb-1">Upload báo cáo Facebook Ads</div>
                  <div className="text-sm text-[var(--muted-foreground)] mb-4 max-w-md">
                    Export báo cáo từ Facebook Ads Manager dạng CSV. Hệ thống sẽ tự đọc chi phí và ghép vào Page.
                  </div>
                  <div className="flex gap-2 mb-3">
                    <span className="bg-[var(--muted)] border border-[var(--border)] px-3 py-1 rounded-md text-xs font-semibold text-[var(--muted-foreground)]">.csv</span>
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-1">
                    <AlertTriangle size={12} /> Hỗ trợ báo cáo Campaign, Ad Set hoặc Ad level
                  </div>
                </div>
              </label>
            </div>
          )}

          {importMsg && !parsedRows.length && (
            <div className={`text-sm rounded-lg px-4 py-3 mb-4 ${importMsg.includes("✅") ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {importMsg}
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                  <div className="text-[11px] text-[var(--muted-foreground)] mb-1">FILE</div>
                  <div className="text-sm font-medium flex items-center gap-1.5 truncate"><FileText size={14} className="text-indigo-400 shrink-0" />{fileName}</div>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                  <div className="text-[11px] text-[var(--muted-foreground)] mb-1">TỔNG CHI ADS</div>
                  <div className="font-mono text-xl font-bold text-red-400">{formatMoney(totalSpend)}</div>
                </div>
                <div className="bg-[var(--card)] border border-green-500/20 rounded-xl p-4">
                  <div className="text-[11px] text-[var(--muted-foreground)] mb-1">ĐÃ GHÉP PAGE</div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xl font-bold text-green-400">{matchedCount}</span>
                    <span className="text-xs text-[var(--muted-foreground)]">/ {parsedRows.length}</span>
                  </div>
                </div>
                <div className="bg-[var(--card)] border rounded-xl p-4" style={{ borderColor: unmatchedCount > 0 ? "rgba(245,158,11,0.3)" : "var(--border)" }}>
                  <div className="text-[11px] text-[var(--muted-foreground)] mb-1">CHƯA GHÉP</div>
                  <div className="flex items-baseline gap-2">
                    <span className={`font-mono text-xl font-bold ${unmatchedCount > 0 ? "text-amber-400" : "text-green-400"}`}>{unmatchedCount}</span>
                    {unmatchedCount > 0 && <span className="text-[11px] text-amber-400">Chọn Page ở dropdown</span>}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden mb-4">
                <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Xem trước dữ liệu</span>
                    <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                      {matchedCount}/{parsedRows.length} matched
                    </span>
                  </div>
                  <button onClick={() => { setParsedRows([]); setFileName(""); }} className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
                    <Trash2 size={12} /> Upload lại
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead><tr className="border-b border-[var(--border)]">
                      <th className="w-10 px-3 py-2.5"><input type="checkbox" checked={parsedRows.every(r => r.selected)} onChange={e => toggleAll(e.target.checked)} className="accent-[var(--accent)]" /></th>
                      <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Campaign / Ad</th>
                      <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Page (auto-match)</th>
                      <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Ngày</th>
                      <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Chi Ads</th>
                      <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Impr.</th>
                      <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Clicks</th>
                      <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">CTR</th>
                    </tr></thead>
                    <tbody>
                      {parsedRows.map(row => (
                        <tr key={row.id} className={`border-b border-[var(--border)] transition-colors ${
                          !row.matched_page_id ? "bg-amber-500/[0.03]" : ""
                        } hover:bg-[var(--muted)]`}>
                          <td className="px-3 py-2.5 text-center">
                            <input type="checkbox" checked={row.selected} onChange={() => toggleRow(row.id)} className="accent-[var(--accent)]" />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-sm font-medium truncate max-w-[250px]">{row.campaign_name || row.ad_name}</div>
                            {row.ad_set_name && <div className="text-[11px] text-[var(--muted-foreground)] truncate max-w-[250px]">{row.ad_set_name}</div>}
                          </td>
                          <td className="px-3 py-2.5">
                            {row.matched_page_id ? (
                              <div className="flex items-center gap-1.5">
                                <Check size={13} className="text-green-400" />
                                <span className="text-sm">{row.matched_page_name}</span>
                              </div>
                            ) : (
                              <select value="" onChange={e => setRowPage(row.id, e.target.value)}
                                className="bg-[var(--input)] border border-amber-500/40 text-amber-400 px-2 py-1 rounded-md text-xs w-full max-w-[180px]">
                                <option value="">— Chọn Page —</option>
                                {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono text-[var(--muted-foreground)]">{row.date}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-sm font-semibold text-red-400">{formatFullMoney(row.spend)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs text-[var(--muted-foreground)]">{row.impressions.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs text-[var(--muted-foreground)]">{row.clicks.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: row.ctr >= 1.5 ? "#22c55e" : "#f59e0b" }}>{row.ctr}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between">
                  <div className="text-sm text-[var(--muted-foreground)]">
                    Tổng: <span className="font-mono font-bold text-red-400 text-base">{formatFullMoney(totalSpend)}</span>
                    <span className="mx-2 text-[var(--border)]">|</span>
                    {parsedRows.filter(r => r.selected).length} dòng được chọn
                  </div>
                  <div className="flex items-center gap-3">
                    {importMsg && <span className={`text-sm ${importMsg.includes("✅") ? "text-green-400" : "text-red-400"}`}>{importMsg}</span>}
                    <button onClick={handleImport} disabled={importing} className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-green-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                      <Check size={14} /> {importing ? "Đang import..." : `Xác nhận import ${parsedRows.filter(r => r.selected).length} dòng`}
                    </button>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl px-5 py-4 flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle size={16} className="text-indigo-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold mb-1">Auto-matching</div>
                  <div className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                    Hệ thống ghép tự động bằng cách tìm tên Page trong tên Campaign/Ad. Dòng chưa ghép được hiện dropdown vàng để chọn thủ công.
                    Chi phí sẽ được gộp theo Page + Ngày khi import.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: MANUAL ═══ */}
      {tab === "manual" && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            <span className="text-sm font-semibold">Nhập chi phí thủ công</span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Ngày</label>
                <input type="date" value={manualForm.date} onChange={e => setManualForm({...manualForm, date: e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Page</label>
                <select value={manualForm.page_id} onChange={e => setManualForm({...manualForm, page_id: e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                  <option value="">Chung</option>
                  {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[{k:"ads_cost",l:"Chi Ads",c:"#ef4444"},{k:"tool_cost",l:"Chi Tool",c:"#6366f1"},{k:"bm_cost",l:"Chi BM",c:"#f59e0b"},{k:"via_cost",l:"Chi Via",c:"#f59e0b"},{k:"proxy_cost",l:"Chi Proxy",c:"#22c55e"},{k:"vps_cost",l:"Chi VPS",c:"#22c55e"},{k:"staff_cost",l:"Chi Nhân sự",c:"#8b5cf6"},{k:"other_cost",l:"Chi Khác",c:"#6b7280"}].map(f => (
                <div key={f.k}>
                  <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] mb-1">
                    <span className="w-1.5 h-1.5 rounded-sm" style={{background:f.c}} />{f.l}
                  </label>
                  <input type="number" value={(manualForm as any)[f.k]} onChange={e => setManualForm({...manualForm,[f.k]:e.target.value})}
                    placeholder="0" className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
              <span className="text-sm text-[var(--muted-foreground)]">Tổng: <span className="font-mono font-bold text-lg text-red-400">{formatFullMoney(totalManual)}</span></span>
              <div className="flex items-center gap-3">
                {manualMsg && <span className="text-sm text-green-400">{manualMsg}</span>}
                <button onClick={handleManualSave} disabled={manualSaving} className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  <Plus size={14} /> {manualSaving ? "Đang lưu..." : "Lưu chi phí"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: HISTORY ═══ */}
      {tab === "history" && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead><tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Ngày</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Page</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Ads</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Khác</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Tổng</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Nguồn</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">Ghi chú</th>
              </tr></thead>
              <tbody>
                {historyLoading ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">Đang tải...</td></tr>
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">Chưa có chi phí nào</td></tr>
                ) : expenses.map(e => (
                  <tr key={e.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                    <td className="px-4 py-2.5 text-xs font-mono text-[var(--muted-foreground)]">{e.date}</td>
                    <td className="px-4 py-2.5 text-sm">{e.page?.name || "Chung"}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-red-400">{formatMoney(Number(e.ads_cost))}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-[var(--muted-foreground)]">{formatMoney(Number(e.total_cost) - Number(e.ads_cost))}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold text-red-400">{formatMoney(Number(e.total_cost))}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${e.source === "import_fb" ? "bg-indigo-500/10 text-indigo-400" : "bg-amber-500/10 text-amber-400"}`}>
                        {e.source === "import_fb" ? "Import FB" : "Thủ công"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[var(--muted-foreground)] max-w-[200px] truncate">{e.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
