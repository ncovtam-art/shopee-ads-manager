"use client";
import { useState, useEffect } from "react";
import { Upload, Check, Trash2, AlertTriangle, Megaphone, ShoppingBag, FileText, ChevronRight, X, Download } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCompact, parseVNNumber, findColumn } from "@/lib/finance";
import Papa from "papaparse";

type Tab = "fb" | "shopee";
type Step = 1 | 2 | 3;

type FbRow = { id: number; campaign_name: string; ad_spend: number; selected: boolean; duplicate: boolean };
type ShopeeRow = { id: number; sub_id1: string; sub_id2: string; order_value: number; net_commission: number; product_name: string; order_id: string; channel: string; selected: boolean; duplicate: boolean };

export default function ImportPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("fb");
  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [fbRows, setFbRows] = useState<FbRow[]>([]);
  const [shopeeRows, setShopeeRows] = useState<ShopeeRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");
  const [batches, setBatches] = useState<any[]>([]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { fetchBatches(); }, []);

  const fetchBatches = async () => {
    const { data } = await supabase.from("import_batches").select("*").in("type", ["fb_ads", "shopee_affiliate"]).order("created_at", { ascending: false }).limit(30);
    if (data) setBatches(data);
  };

  const reset = () => { setFbRows([]); setShopeeRows([]); setFileName(""); setFileSize(""); setMsg(""); setStep(1); };

  const handleFile = (file: File) => {
    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(0) + " KB");
    setMsg("");
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: (r) => {
      if (!r.data?.length) { setMsg("File trống hoặc không đọc được"); return; }
      if (tab === "fb") parseFb(r.data); else parseShopee(r.data);
      setStep(2);
    }});
  };

  const parseFb = (data: any[]) => {
    const rows: FbRow[] = data.map((row, i) => {
      const campaign = findColumn(row, ["Tên chiến dịch", "Campaign name", "campaign_name"]);
      const spend = parseVNNumber(findColumn(row, ["Số tiền đã chi tiêu", "Amount spent", "amount_spent"]));
      return { id: i, campaign_name: campaign.trim(), ad_spend: spend, selected: true, duplicate: false };
    }).filter(r => r.campaign_name);
    // Merge same campaign
    const merged = new Map<string, FbRow>();
    rows.forEach(r => {
      const ex = merged.get(r.campaign_name);
      if (ex) ex.ad_spend += r.ad_spend;
      else merged.set(r.campaign_name, { ...r });
    });
    setFbRows(Array.from(merged.values()).map((r, i) => ({ ...r, id: i })));
  };

  const parseShopee = (data: any[]) => {
    const rows: ShopeeRow[] = data.map((row, i) => {
      const sub1 = findColumn(row, ["Sub_id1", "sub_id1"]);
      const sub2 = findColumn(row, ["Sub_id2", "sub_id2"]);
      const orderVal = parseVNNumber(findColumn(row, ["Giá trị đơn hàng", "Order Value"]));
      const commission = parseVNNumber(findColumn(row, ["Hoa hồng ròng tiếp thị liên kết", "hoa hồng ròng", "Net Commission"]));
      const productName = findColumn(row, ["Tên Item", "Tên sản phẩm", "Product name"]);
      const orderId = findColumn(row, ["ID đơn hàng", "Order ID"]);
      const channel = findColumn(row, ["Kênh", "Channel"]);
      return { id: i, sub_id1: sub1.trim(), sub_id2: sub2.trim(), order_value: orderVal, net_commission: commission, product_name: productName, order_id: orderId, channel, selected: true, duplicate: false };
    }).filter(r => r.sub_id2 || r.order_value > 0 || r.net_commission > 0);
    setShopeeRows(rows);
  };

  const importFb = async () => {
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (!user) { setMsg("Chưa đăng nhập"); return; }
    const selected = fbRows.filter(r => r.selected && !r.duplicate);
    if (!selected.length) { setMsg("Không có dòng hợp lệ"); return; }
    setImporting(true);
    try {
      const { data: batch, error: bErr } = await supabase.from("import_batches").insert({ filename: fileName, type: "fb_ads", total_rows: selected.length, matched_rows: selected.length, unmatched_rows: 0, status: "COMPLETED", created_by: user.id }).select().single();
      if (bErr || !batch) { setMsg("Lỗi: " + (bErr?.message || "Tạo batch thất bại")); setImporting(false); return; }
      const inserts = selected.map(r => ({ batch_id: batch.id, campaign_name: r.campaign_name, ad_spend: r.ad_spend }));
      const { error } = await supabase.from("fb_ads_data").insert(inserts);
      if (error) setMsg("Lỗi: " + error.message);
      else { setMsg(`✅ Import ${selected.length} chiến dịch FB thành công!`); setStep(3); fetchBatches(); }
    } catch (e: any) { setMsg("Lỗi: " + e?.message); }
    setImporting(false);
  };

  const importShopee = async () => {
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (!user) { setMsg("Chưa đăng nhập"); return; }
    const selected = shopeeRows.filter(r => r.selected && !r.duplicate);
    if (!selected.length) { setMsg("Không có dòng hợp lệ"); return; }
    setImporting(true);
    try {
      const matched = selected.filter(r => r.sub_id2).length;
      const { data: batch, error: bErr } = await supabase.from("import_batches").insert({ filename: fileName, type: "shopee_affiliate", total_rows: selected.length, matched_rows: matched, unmatched_rows: selected.length - matched, status: "COMPLETED", created_by: user.id }).select().single();
      if (bErr || !batch) { setMsg("Lỗi: " + (bErr?.message || "Tạo batch thất bại")); setImporting(false); return; }
      const inserts = selected.map(r => ({ batch_id: batch.id, sub_id1: r.sub_id1, sub_id2: r.sub_id2, order_value: r.order_value, net_commission: r.net_commission }));
      const { error } = await supabase.from("shopee_affiliate_data").insert(inserts);
      if (error) setMsg("Lỗi: " + error.message);
      else { setMsg(`✅ Import ${selected.length} đơn Shopee thành công!`); setStep(3); fetchBatches(); }
    } catch (e: any) { setMsg("Lỗi: " + e?.message); }
    setImporting(false);
  };

  const deleteBatch = async (b: any) => {
    if (!confirm(`Xoá import "${b.filename}" (${b.total_rows} dòng)?\nDữ liệu sẽ bị xoá hoàn toàn.`)) return;
    if (b.type === "fb_ads") await supabase.from("fb_ads_data").delete().eq("batch_id", b.id);
    else await supabase.from("shopee_affiliate_data").delete().eq("batch_id", b.id);
    const { error } = await supabase.from("import_batches").delete().eq("id", b.id);
    if (error) setMsg("Lỗi: " + error.message);
    else { setMsg(`✅ Đã xoá "${b.filename}"`); fetchBatches(); }
  };

  const rows = tab === "fb" ? fbRows : shopeeRows;
  const hasData = rows.length > 0;
  const selCount = tab === "fb" ? fbRows.filter(r => r.selected).length : shopeeRows.filter(r => r.selected).length;
  const fbTotal = fbRows.filter(r => r.selected).reduce((s, r) => s + r.ad_spend, 0);
  const spSelRows = shopeeRows.filter(r => r.selected);
  const spGMV = spSelRows.reduce((s, r) => s + r.order_value, 0);
  const spComm = spSelRows.reduce((s, r) => s + r.net_commission, 0);

  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-5">
      {[{ n: 1, l: "Tải file" }, { n: 2, l: "Kiểm tra" }, { n: 3, l: "Hoàn tất" }].map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${step >= s.n ? "bg-[var(--accent)] text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>{s.n}</div>
          <span className={`text-xs ${step >= s.n ? "text-[var(--foreground)] font-medium" : "text-[var(--muted-foreground)]"}`}>{s.l}</span>
          {i < 2 && <ChevronRight size={12} className="text-[var(--muted-foreground)]" />}
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold">Import dữ liệu</h1>
      </div>
      <p className="text-xs text-[var(--muted-foreground)] mb-4">Upload CSV từ Facebook Ads và Shopee Affiliate — hệ thống tự ghép qua tên chiến dịch</p>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-[var(--card)] border border-[var(--border)] rounded-md p-0.5 mb-4 w-fit">
        <button onClick={() => { setTab("fb"); reset(); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${tab === "fb" ? "bg-[#1877f2] text-white" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"}`}>
          <Megaphone size={13} /> FB Ads
        </button>
        <button onClick={() => { setTab("shopee"); reset(); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${tab === "shopee" ? "bg-[#ee4d2d] text-white" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"}`}>
          <ShoppingBag size={13} /> Shopee Affiliate
        </button>
      </div>

      <StepIndicator />

      {/* STEP 1: Upload */}
      {step === 1 && (
        <div className={`bg-[var(--card)] border rounded-xl mb-4 transition-colors ${dragOver ? "border-[var(--accent)] bg-[rgba(238,77,45,0.05)]" : "border-[var(--border)]"}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); e.dataTransfer.files?.[0] && handleFile(e.dataTransfer.files[0]); }}>
          <label className="block cursor-pointer">
            <input type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <div className="p-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: tab === "fb" ? "rgba(24,119,242,0.1)" : "rgba(238,77,45,0.1)" }}>
                <Upload size={22} style={{ color: tab === "fb" ? "#1877f2" : "#ee4d2d" }} />
              </div>
              <div className="text-sm font-semibold mb-1">{tab === "fb" ? "Upload báo cáo Facebook Ads" : "Upload báo cáo Shopee Affiliate"}</div>
              <div className="text-xs text-[var(--muted-foreground)] mb-3 max-w-md">
                {tab === "fb"
                  ? "Cần cột: Tên chiến dịch, Số tiền đã chi tiêu (VND)"
                  : "Cần cột: Sub_id2 (chiến dịch), Sub_id1 (page), Giá trị đơn hàng, Hoa hồng ròng TTLK"
                }
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-[var(--muted)] border border-[var(--border)] px-2 py-0.5 rounded text-[10px] font-semibold text-[var(--muted-foreground)]">.csv</span>
                <span className="text-[10px] text-[var(--muted-foreground)]">Kéo thả hoặc bấm để chọn file</span>
              </div>
            </div>
          </label>
        </div>
      )}

      {msg && step === 1 && (
        <div className={`text-xs rounded-lg px-3 py-2 mb-3 ${msg.includes("✅") ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{msg}</div>
      )}

      {/* STEP 2: Preview */}
      {step === 2 && (
        <div>
          {/* Summary cards */}
          {tab === "fb" ? (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
                <div className="text-[10px] text-[var(--muted-foreground)] mb-0.5">CHIẾN DỊCH</div>
                <div className="font-mono text-lg font-bold">{selCount}</div>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
                <div className="text-[10px] text-[var(--muted-foreground)] mb-0.5">TỔNG CHI ADS</div>
                <div className="font-mono text-lg font-bold text-red-400">{formatCompact(fbTotal)}</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
                <div className="text-[10px] text-[var(--muted-foreground)] mb-0.5">SỐ DÒNG</div>
                <div className="font-mono text-lg font-bold">{selCount}</div>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
                <div className="text-[10px] text-[var(--muted-foreground)] mb-0.5">GIÁ TRỊ ĐƠN</div>
                <div className="font-mono text-lg font-bold text-green-400">{formatCompact(spGMV)}</div>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
                <div className="text-[10px] text-[var(--muted-foreground)] mb-0.5">HOA HỒNG RÒNG</div>
                <div className="font-mono text-lg font-bold text-indigo-400">{formatCompact(spComm)}</div>
              </div>
            </div>
          )}

          {/* File info + actions */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden mb-3">
            <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={14} style={{ color: tab === "fb" ? "#1877f2" : "#ee4d2d" }} />
                <span className="text-xs font-medium">{fileName}</span>
                <span className="text-[10px] text-[var(--muted-foreground)]">{fileSize}</span>
              </div>
              <button onClick={reset} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
                <X size={10} /> Huỷ
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              {tab === "fb" ? (
                <table className="w-full">
                  <thead className="sticky top-0 bg-[var(--card)]"><tr className="border-b border-[var(--border)]">
                    <th className="w-8 px-2 py-2"><input type="checkbox" checked={fbRows.every(r => r.selected)} onChange={e => setFbRows(fbRows.map(r => ({ ...r, selected: e.target.checked })))} className="accent-[#1877f2]" /></th>
                    <th className="text-left px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Tên chiến dịch</th>
                    <th className="text-right px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Chi tiêu (VND)</th>
                  </tr></thead>
                  <tbody>
                    {fbRows.map(r => (
                      <tr key={r.id} className={`border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors ${r.duplicate ? "opacity-40" : ""}`}>
                        <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={r.selected} onChange={() => setFbRows(fbRows.map(x => x.id === r.id ? { ...x, selected: !x.selected } : x))} className="accent-[#1877f2]" /></td>
                        <td className="px-2 py-1.5 text-xs">{r.campaign_name}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs text-red-400">{formatCompact(r.ad_spend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[600px]">
                  <thead className="sticky top-0 bg-[var(--card)]"><tr className="border-b border-[var(--border)]">
                    <th className="w-8 px-2 py-2"><input type="checkbox" checked={shopeeRows.every(r => r.selected)} onChange={e => setShopeeRows(shopeeRows.map(r => ({ ...r, selected: e.target.checked })))} className="accent-[var(--accent)]" /></th>
                    <th className="text-left px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Sub_id2</th>
                    <th className="text-left px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Sub_id1</th>
                    <th className="text-right px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Đơn hàng</th>
                    <th className="text-right px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Hoa hồng</th>
                    <th className="text-left px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Kênh</th>
                  </tr></thead>
                  <tbody>
                    {shopeeRows.map(r => (
                      <tr key={r.id} className={`border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors ${r.duplicate ? "opacity-40" : ""}`}>
                        <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={r.selected} onChange={() => setShopeeRows(shopeeRows.map(x => x.id === r.id ? { ...x, selected: !x.selected } : x))} className="accent-[var(--accent)]" /></td>
                        <td className="px-2 py-1.5"><div className="flex items-center gap-1">{r.sub_id2 ? <Check size={10} className="text-green-400" /> : <AlertTriangle size={10} className="text-amber-400" />}<span className="text-xs truncate max-w-[140px]">{r.sub_id2 || "—"}</span></div></td>
                        <td className="px-2 py-1.5 text-xs font-mono text-[var(--muted-foreground)]">{r.sub_id1 || "—"}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs text-green-400">{formatCompact(r.order_value)}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs text-indigo-400">{formatCompact(r.net_commission)}</td>
                        <td className="px-2 py-1.5 text-[10px] text-[var(--muted-foreground)]">{r.channel || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-[var(--border)] flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">{selCount} dòng được chọn</span>
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

      {/* STEP 3: Done */}
      {step === 3 && (
        <div className="bg-[var(--card)] border border-green-500/20 rounded-xl p-8 text-center mb-4">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
            <Check size={24} className="text-green-400" />
          </div>
          <h2 className="text-base font-semibold mb-1">Import thành công!</h2>
          <p className="text-xs text-[var(--muted-foreground)] mb-4">{msg}</p>
          <button onClick={reset} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90">Import file khác</button>
        </div>
      )}

      {/* History */}
      {step === 1 && batches.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-xs font-semibold">Lịch sử import</span>
            <span className="text-[10px] text-[var(--muted-foreground)]">{batches.length} lần</span>
          </div>
          {batches.map(b => (
            <div key={b.id} className="px-3 py-2 flex items-center gap-2 border-b border-[var(--border)] text-xs hover:bg-[var(--muted)] transition-colors">
              {b.type === "fb_ads" ? <Megaphone size={12} className="text-[#1877f2]" /> : <ShoppingBag size={12} className="text-[#ee4d2d]" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium truncate">{b.filename}</span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">{b.type === "fb_ads" ? "FB" : "Shopee"}</span>
                </div>
                <div className="text-[10px] text-[var(--muted-foreground)]">{new Date(b.created_at).toLocaleString("vi-VN")} · {b.total_rows} dòng</div>
              </div>
              <button onClick={() => deleteBatch(b)} className="flex items-center gap-0.5 px-2 py-1 rounded text-[10px] text-red-400 hover:bg-red-500/10"><Trash2 size={10} /> Xoá</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
