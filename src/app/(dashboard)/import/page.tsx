"use client";
import { useState, useEffect } from "react";
import { Upload, Check, Trash2, AlertTriangle, Megaphone, ShoppingBag, FileText, ChevronRight, X, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCompact, parseVNNumber, findColumn } from "@/lib/finance";
import Papa from "papaparse";

type Tab = "fb" | "shopee";
type Step = 1 | 2 | 3;
type FbRow = { id: number; campaign_name: string; ad_spend: number; selected: boolean };
type ShopeeRow = { id: number; sub_id1: string; sub_id2: string; order_value: number; net_commission: number; channel: string; selected: boolean };
type PageOption = { id: string; name: string };

export default function ImportPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("fb");
  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState("");
  const [fbRows, setFbRows] = useState<FbRow[]>([]);
  const [shopeeRows, setShopeeRows] = useState<ShopeeRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");
  const [batches, setBatches] = useState<any[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { fetchBatches(); fetchPages(); }, []);

  const fetchPages = async () => {
    const { data } = await supabase.from("pages").select("id, name").eq("status", "ACTIVE").order("name");
    if (data) setPages(data);
  };

  const fetchBatches = async () => {
    const { data } = await supabase.from("import_batches").select("*, pages:page_id(name)").in("type", ["fb_ads", "shopee_affiliate"]).order("created_at", { ascending: false }).limit(30);
    if (data) setBatches(data);
  };

  const reset = () => { setFbRows([]); setShopeeRows([]); setFileName(""); setMsg(""); setStep(1); };

  const handleFile = (file: File) => {
    if (!selectedPageId) { setMsg("Vui lòng chọn Page trước khi upload file"); return; }
    setFileName(file.name); setMsg("");
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: (r) => {
      if (!r.data?.length) { setMsg("File trống"); return; }
      if (tab === "fb") parseFb(r.data); else parseShopee(r.data);
      setStep(2);
    }});
  };

  const parseFb = (data: any[]) => {
    const rows: FbRow[] = data.map((row, i) => {
      const campaign = findColumn(row, ["Tên chiến dịch", "Campaign name", "campaign_name", "Tên nhóm quảng cáo", "Ad set name", "Tên quảng cáo", "Ad name"]);
      const spend = parseVNNumber(findColumn(row, ["Số tiền đã chi tiêu", "Amount spent", "amount_spent"]));
      return { id: i, campaign_name: campaign.trim(), ad_spend: spend, selected: true };
    }).filter(r => r.campaign_name);
    const merged = new Map<string, FbRow>();
    rows.forEach(r => { const ex = merged.get(r.campaign_name); if (ex) ex.ad_spend += r.ad_spend; else merged.set(r.campaign_name, { ...r }); });
    setFbRows(Array.from(merged.values()).map((r, i) => ({ ...r, id: i })));
  };

  const parseShopee = (data: any[]) => {
    const rows: ShopeeRow[] = data.map((row, i) => ({
      id: i,
      sub_id1: findColumn(row, ["Sub_id1", "sub_id1"]).trim(),
      sub_id2: findColumn(row, ["Sub_id2", "sub_id2"]).trim(),
      order_value: parseVNNumber(findColumn(row, ["Giá trị đơn hàng", "Order Value"])),
      net_commission: parseVNNumber(findColumn(row, ["Hoa hồng ròng tiếp thị liên kết", "hoa hồng ròng", "Net Commission"])),
      channel: findColumn(row, ["Kênh", "Channel"]),
      selected: true,
    })).filter(r => r.sub_id2 || r.order_value > 0 || r.net_commission > 0);
    setShopeeRows(rows);
  };

  const importFb = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMsg("Chưa đăng nhập"); return; }
    const selected = fbRows.filter(r => r.selected);
    if (!selected.length) { setMsg("Không có dòng hợp lệ"); return; }
    setImporting(true);
    try {
      const { data: batch, error: bErr } = await supabase.from("import_batches").insert({ filename: fileName, type: "fb_ads", total_rows: selected.length, matched_rows: selected.length, unmatched_rows: 0, status: "COMPLETED", created_by: user.id, page_id: selectedPageId }).select().single();
      if (bErr || !batch) { setMsg("Lỗi: " + (bErr?.message || "Tạo batch thất bại")); setImporting(false); return; }
      const inserts = selected.map(r => ({ batch_id: batch.id, campaign_name: r.campaign_name, ad_spend: r.ad_spend, page_id: selectedPageId, report_date: reportDate }));
      const { error } = await supabase.from("fb_ads_data").insert(inserts);
      if (error) setMsg("Lỗi: " + error.message);
      else { setMsg(`✅ Import ${selected.length} chiến dịch FB thành công!`); setStep(3); fetchBatches(); }
    } catch (e: any) { setMsg("Lỗi: " + e?.message); }
    setImporting(false);
  };

  const importShopee = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMsg("Chưa đăng nhập"); return; }
    const selected = shopeeRows.filter(r => r.selected);
    if (!selected.length) { setMsg("Không có dòng hợp lệ"); return; }
    setImporting(true);
    try {
      const matched = selected.filter(r => r.sub_id2).length;
      const { data: batch, error: bErr } = await supabase.from("import_batches").insert({ filename: fileName, type: "shopee_affiliate", total_rows: selected.length, matched_rows: matched, unmatched_rows: selected.length - matched, status: "COMPLETED", created_by: user.id, page_id: selectedPageId }).select().single();
      if (bErr || !batch) { setMsg("Lỗi: " + (bErr?.message || "Tạo batch thất bại")); setImporting(false); return; }
      const inserts = selected.map(r => ({ batch_id: batch.id, sub_id1: r.sub_id1, sub_id2: r.sub_id2, order_value: r.order_value, net_commission: r.net_commission, page_id: selectedPageId, report_date: reportDate }));
      const { error } = await supabase.from("shopee_affiliate_data").insert(inserts);
      if (error) setMsg("Lỗi: " + error.message);
      else { setMsg(`✅ Import ${selected.length} đơn Shopee thành công!`); setStep(3); fetchBatches(); }
    } catch (e: any) { setMsg("Lỗi: " + e?.message); }
    setImporting(false);
  };

  const deleteBatch = async (b: any) => {
    if (!confirm(`Xoá "${b.filename}"?`)) return;
    if (b.type === "fb_ads") await supabase.from("fb_ads_data").delete().eq("batch_id", b.id);
    else await supabase.from("shopee_affiliate_data").delete().eq("batch_id", b.id);
    await supabase.from("import_batches").delete().eq("id", b.id);
    setMsg(`✅ Đã xoá`); fetchBatches();
  };

  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);

  const toggleBatch = (id: string) => setSelectedBatches(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAllBatches = () => setSelectedBatches(prev => prev.length === batches.length ? [] : batches.map(b => b.id));

  const deleteBulk = async () => {
    if (!selectedBatches.length) return;
    if (!confirm(`Xoá ${selectedBatches.length} lần import đã chọn?\nDữ liệu sẽ bị xoá hoàn toàn.`)) return;
    const toDelete = batches.filter(b => selectedBatches.includes(b.id));
    for (const b of toDelete) {
      if (b.type === "fb_ads") await supabase.from("fb_ads_data").delete().eq("batch_id", b.id);
      else await supabase.from("shopee_affiliate_data").delete().eq("batch_id", b.id);
    }
    await supabase.from("import_batches").delete().in("id", selectedBatches);
    setSelectedBatches([]); setMsg(`✅ Đã xoá ${toDelete.length} lần import`); fetchBatches();
  };

  // Cảnh báo ngày chưa up báo cáo (7 ngày gần nhất)
  const getMissingDays = () => {
    const uploaded = new Set<string>();
    batches.forEach(b => {
      const d = b.report_date || (b.created_at ? b.created_at.split("T")[0] : null);
      if (d) uploaded.add(d);
    });
    const missing: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      if (!uploaded.has(ds)) missing.push(ds);
    }
    return missing;
  };
  const missingDays = getMissingDays();

  const hasData = tab === "fb" ? fbRows.length > 0 : shopeeRows.length > 0;
  const selCount = tab === "fb" ? fbRows.filter(r => r.selected).length : shopeeRows.filter(r => r.selected).length;
  const fbTotal = fbRows.filter(r => r.selected).reduce((s, r) => s + r.ad_spend, 0);
  const spComm = shopeeRows.filter(r => r.selected).reduce((s, r) => s + r.net_commission, 0);
  const spGMV = shopeeRows.filter(r => r.selected).reduce((s, r) => s + r.order_value, 0);

  return (
    <div>
      <h1 className="text-lg font-bold mb-1">Import dữ liệu</h1>
      <p className="text-xs text-[var(--muted-foreground)] mb-4">Chọn Page → Upload CSV → Dữ liệu tự gắn vào Page đó</p>

      {/* Page selector + Tabs */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 max-w-xs">
          <label className="block text-[10px] text-[var(--muted-foreground)] mb-1 font-medium">CHỌN PAGE *</label>
          <select value={selectedPageId} onChange={e => setSelectedPageId(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
            <option value="">— Chọn page —</option>
            {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="max-w-[160px]">
          <label className="block text-[10px] text-[var(--muted-foreground)] mb-1 font-medium">NGÀY BÁO CÁO *</label>
          <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} max={new Date().toISOString().split("T")[0]}
            className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
        </div>
        <div className="flex gap-0.5 glass-card rounded-md p-0.5 border border-[var(--border)] self-end">
          <button onClick={() => { setTab("fb"); reset(); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${tab === "fb" ? "bg-[#1877f2] text-white" : "text-[var(--muted-foreground)]"}`}><Megaphone size={13} /> FB Ads</button>
          <button onClick={() => { setTab("shopee"); reset(); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${tab === "shopee" ? "bg-[#ee4d2d] text-white" : "text-[var(--muted-foreground)]"}`}><ShoppingBag size={13} /> Shopee</button>
        </div>
      </div>

      {!selectedPageId && (
        <div className="glass-card rounded-xl border border-amber-500/20 p-6 text-center mb-4">
          <AlertTriangle size={20} className="text-amber-400 mx-auto mb-2" />
          <div className="text-xs text-amber-400 font-medium">Chọn Page trước khi upload file</div>
          <div className="text-[10px] text-[var(--muted-foreground)] mt-1">Nếu chưa có Page, vào <a href="/pages" className="text-[var(--accent)] underline">Pages</a> để thêm.</div>
        </div>
      )}

      {/* ⚠️ Cảnh báo ngày chưa up báo cáo */}
      {step === 1 && missingDays.length > 0 && (
        <div className="glass-card rounded-xl border border-amber-500/20 glow-amber p-4 mb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <AlertTriangle size={15} className="text-amber-400" />
            <span className="text-xs font-semibold text-amber-400">Có {missingDays.length} ngày chưa upload báo cáo (7 ngày gần nhất)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {missingDays.map(d => {
              const dateObj = new Date(d);
              const isToday = d === new Date().toISOString().split("T")[0];
              return (
                <button key={d} onClick={() => { setReportDate(d); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:scale-105 ${isToday ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] hover:border-amber-500/30 hover:text-amber-400"}`}>
                  {isToday && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 pulse-dot" />}
                  {isToday ? "Hôm nay" : dateObj.toLocaleDateString("vi-VN", { weekday: "short", day: "numeric", month: "numeric" })}
                </button>
              );
            })}
          </div>
          <div className="text-[10px] text-[var(--muted-foreground)] mt-2">Bấm vào ngày để chọn nhanh ngày báo cáo, rồi upload file.</div>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 1 && selectedPageId && (
        <div className={`glass-card border rounded-xl mb-4 transition-colors ${dragOver ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); e.dataTransfer.files?.[0] && handleFile(e.dataTransfer.files[0]); }}>
          <label className="block cursor-pointer">
            <input type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <div className="p-10 flex flex-col items-center text-center">
              <Upload size={28} style={{ color: tab === "fb" ? "#1877f2" : "#ee4d2d" }} className="mb-3" />
              <div className="text-sm font-semibold mb-1">Upload {tab === "fb" ? "FB Ads" : "Shopee Affiliate"} cho page: <span className="text-[var(--accent)]">{pages.find(p => p.id === selectedPageId)?.name}</span></div>
              <div className="text-xs text-[var(--muted-foreground)] mb-1">Ngày báo cáo: <span className="font-semibold text-[var(--foreground)]">{new Date(reportDate).toLocaleDateString("vi-VN")}</span></div>
              <div className="text-[10px] text-[var(--muted-foreground)]">Kéo thả hoặc bấm chọn file .csv</div>
            </div>
          </label>
        </div>
      )}

      {msg && step <= 1 && <div className={`text-xs rounded-lg px-3 py-2 mb-3 ${msg.includes("✅") ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{msg}</div>}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="glass-card rounded-lg p-3 border border-[var(--border)]"><div className="text-[10px] text-[var(--muted-foreground)]">DÒNG</div><div className="font-mono text-lg font-bold">{selCount}</div></div>
            {tab === "fb" ? (
              <div className="glass-card rounded-lg p-3 border border-[var(--border)]"><div className="text-[10px] text-[var(--muted-foreground)]">CHI ADS</div><div className="font-mono text-lg font-bold text-red-400">{formatCompact(fbTotal)}</div></div>
            ) : (<>
              <div className="glass-card rounded-lg p-3 border border-[var(--border)]"><div className="text-[10px] text-[var(--muted-foreground)]">GMV</div><div className="font-mono text-lg font-bold text-green-400">{formatCompact(spGMV)}</div></div>
              <div className="glass-card rounded-lg p-3 border border-[var(--border)]"><div className="text-[10px] text-[var(--muted-foreground)]">HOA HỒNG</div><div className="font-mono text-lg font-bold text-indigo-400">{formatCompact(spComm)}</div></div>
            </>)}
          </div>

          <div className="glass-card rounded-xl border border-[var(--border)] overflow-hidden mb-3">
            <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2"><FileText size={14} style={{ color: tab === "fb" ? "#1877f2" : "#ee4d2d" }} /><span className="text-xs font-medium">{fileName}</span></div>
              <button onClick={reset} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"><X size={10} /> Huỷ</button>
            </div>
            <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
              {tab === "fb" ? (
                <table className="w-full"><thead className="sticky top-0 bg-[var(--card)]"><tr className="border-b border-[var(--border)]">
                  <th className="w-8 px-2 py-2"><input type="checkbox" checked={fbRows.every(r => r.selected)} onChange={e => setFbRows(fbRows.map(r => ({...r, selected: e.target.checked})))} /></th>
                  <th className="text-left px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)]">CHIẾN DỊCH</th>
                  <th className="text-right px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)]">CHI TIÊU</th>
                </tr></thead><tbody>
                  {fbRows.map(r => (<tr key={r.id} className="border-b border-[var(--border)] row-hover"><td className="px-2 py-1.5 text-center"><input type="checkbox" checked={r.selected} onChange={() => setFbRows(fbRows.map(x => x.id===r.id?{...x,selected:!x.selected}:x))} /></td><td className="px-2 py-1.5 text-xs">{r.campaign_name}</td><td className="px-2 py-1.5 text-right font-mono text-xs text-red-400">{formatCompact(r.ad_spend)}</td></tr>))}
                </tbody></table>
              ) : (
                <table className="w-full min-w-[600px]"><thead className="sticky top-0 bg-[var(--card)]"><tr className="border-b border-[var(--border)]">
                  <th className="w-8 px-2 py-2"><input type="checkbox" checked={shopeeRows.every(r => r.selected)} onChange={e => setShopeeRows(shopeeRows.map(r => ({...r, selected: e.target.checked})))} /></th>
                  <th className="text-left px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)]">SUB_ID1</th>
                  <th className="text-left px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)]">SUB_ID2</th>
                  <th className="text-right px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)]">ĐƠN HÀNG</th>
                  <th className="text-right px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)]">HOA HỒNG</th>
                  <th className="text-left px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)]">KÊNH</th>
                </tr></thead><tbody>
                  {shopeeRows.map(r => (<tr key={r.id} className="border-b border-[var(--border)] row-hover"><td className="px-2 py-1.5 text-center"><input type="checkbox" checked={r.selected} onChange={() => setShopeeRows(shopeeRows.map(x => x.id===r.id?{...x,selected:!x.selected}:x))} /></td><td className="px-2 py-1.5 text-xs font-mono text-[var(--muted-foreground)]">{r.sub_id1 || "—"}</td><td className="px-2 py-1.5 text-xs font-mono">{r.sub_id2 || "—"}</td><td className="px-2 py-1.5 text-right font-mono text-xs text-green-400">{formatCompact(r.order_value)}</td><td className="px-2 py-1.5 text-right font-mono text-xs text-indigo-400">{formatCompact(r.net_commission)}</td><td className="px-2 py-1.5 text-[10px] text-[var(--muted-foreground)]">{r.channel || "—"}</td></tr>))}
                </tbody></table>
              )}
            </div>
            <div className="px-3 py-2 border-t border-[var(--border)] flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">{selCount} dòng → <span className="font-semibold text-[var(--foreground)]">{pages.find(p => p.id === selectedPageId)?.name}</span></span>
              <div className="flex items-center gap-2">
                {msg && <span className={`text-xs ${msg.includes("✅") ? "text-green-400" : "text-red-400"}`}>{msg}</span>}
                <button onClick={tab === "fb" ? importFb : importShopee} disabled={importing}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  style={{ background: tab === "fb" ? "#1877f2" : "#ee4d2d" }}>
                  <Check size={12} /> {importing ? "Đang import..." : "Xác nhận import"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="glass-card border border-green-500/20 glow-green rounded-xl p-8 text-center mb-4">
          <Check size={28} className="text-green-400 mx-auto mb-2" />
          <div className="text-sm font-semibold mb-1">Import thành công!</div>
          <p className="text-xs text-[var(--muted-foreground)] mb-4">{msg}</p>
          <div className="flex justify-center gap-2">
            <button onClick={reset} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold">Import tiếp</button>
            <a href={`/pages`} className="px-4 py-2 rounded-lg border border-[var(--border)] text-xs font-semibold hover:bg-[var(--muted)]">Xem Pages</a>
          </div>
        </div>
      )}

      {/* History */}
      {step === 1 && batches.length > 0 && (
        <div className="glass-card rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={selectedBatches.length === batches.length && batches.length > 0} onChange={toggleAllBatches} className="accent-[var(--accent)]" />
              <span className="text-xs font-semibold">Lịch sử import</span>
              <span className="text-[10px] text-[var(--muted-foreground)]">({batches.length})</span>
            </div>
            {selectedBatches.length > 0 && (
              <button onClick={deleteBulk} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
                <Trash2 size={11} /> Xoá {selectedBatches.length} mục
              </button>
            )}
          </div>
          {batches.map(b => (
            <div key={b.id} className={`px-3 py-2 flex items-center gap-2 border-b border-[var(--border)] text-xs row-hover ${selectedBatches.includes(b.id) ? "bg-red-500/5" : ""}`}>
              <input type="checkbox" checked={selectedBatches.includes(b.id)} onChange={() => toggleBatch(b.id)} className="accent-[var(--accent)]" />
              {b.type === "fb_ads" ? <Megaphone size={12} className="text-[#1877f2]" /> : <ShoppingBag size={12} className="text-[#ee4d2d]" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium truncate">{b.filename}</span>
                  {(b.pages as any)?.name && <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">{(b.pages as any).name}</span>}
                </div>
                <div className="text-[10px] text-[var(--muted-foreground)]">
                  {b.report_date ? `📅 ${new Date(b.report_date).toLocaleDateString("vi-VN")}` : new Date(b.created_at).toLocaleDateString("vi-VN")} · {b.total_rows} dòng
                </div>
              </div>
              <button onClick={() => deleteBatch(b)} className="flex items-center gap-0.5 px-2 py-1 rounded text-[10px] text-red-400 hover:bg-red-500/10"><Trash2 size={10} /> Xoá</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
