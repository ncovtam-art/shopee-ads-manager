"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Upload, Check, Trash2, FileText, AlertTriangle,
  Megaphone, ShoppingBag, ArrowRight
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatMoney, formatFullMoney } from "@/lib/utils";
import Papa from "papaparse";

type Tab = "fb" | "shopee";

type FbRow = {
  id: number;
  campaign_name: string;
  ad_spend: number;
  selected: boolean;
};

type ShopeeRow = {
  id: number;
  sub_id1: string;
  sub_id2: string;
  order_value: number;
  net_commission: number;
  selected: boolean;
};

export default function ImportPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("fb");
  const [fileName, setFileName] = useState("");
  const [fbRows, setFbRows] = useState<FbRow[]>([]);
  const [shopeeRows, setShopeeRows] = useState<ShopeeRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");
  const [batches, setBatches] = useState<any[]>([]);

  useEffect(() => { fetchBatches(); }, []);

  const fetchBatches = async () => {
    const { data } = await supabase
      .from("import_batches")
      .select("*")
      .in("type", ["fb_ads", "shopee_affiliate"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setBatches(data);
  };

  const reset = () => {
    setFbRows([]);
    setShopeeRows([]);
    setFileName("");
    setMsg("");
  };

  // ── Parse FB Ads CSV ──
  const parseFbCsv = (file: File) => {
    setFileName(file.name);
    setMsg("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        const rows: FbRow[] = r.data
          .map((row: any, i: number) => {
            const campaign =
              row["Tên chiến dịch"] ||
              row["Campaign name"] ||
              row["campaign_name"] ||
              "";
            const spend = parseFloat(
              (row["Số tiền đã chi tiêu (VND)"] ||
               row["Amount spent (VND)"] ||
               row["amount_spent"] ||
               "0"
              ).toString().replace(/[,.]/g, (m: string) => m === "," ? "" : m)
            );
            return { id: i, campaign_name: campaign.trim(), ad_spend: spend, selected: true };
          })
          .filter((r: FbRow) => r.campaign_name);

        // Gộp cùng campaign name
        const merged = new Map<string, FbRow>();
        rows.forEach((r) => {
          const existing = merged.get(r.campaign_name);
          if (existing) {
            existing.ad_spend += r.ad_spend;
          } else {
            merged.set(r.campaign_name, { ...r });
          }
        });
        setFbRows(Array.from(merged.values()).map((r, i) => ({ ...r, id: i })));
      },
    });
  };

  // ── Parse Shopee Affiliate CSV ──
  const parseShopeeCsv = (file: File) => {
    setFileName(file.name);
    setMsg("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        const rows: ShopeeRow[] = r.data
          .map((row: any, i: number) => {
            const sub1 =
              row["Sub_id1"] || row["sub_id1"] || row["Sub ID 1"] || "";
            const sub2 =
              row["Sub_id2"] || row["sub_id2"] || row["Sub ID 2"] || "";
            const orderVal = parseFloat(
              (row["Giá trị đơn hàng (₫)"] ||
               row["Order Value"] ||
               row["order_value"] ||
               "0"
              ).toString().replace(/[,.]/g, (m: string) => m === "," ? "" : m)
            );
            const commission = parseFloat(
              (row["Hoa hồng ròng tiếp thị liên kết(₫)"] ||
               row["Hoa hồng ròng tiếp thị liên kết (₫)"] ||
               row["Net Commission"] ||
               row["net_commission"] ||
               "0"
              ).toString().replace(/[,.]/g, (m: string) => m === "," ? "" : m)
            );
            return {
              id: i,
              sub_id1: sub1.trim(),
              sub_id2: sub2.trim(),
              order_value: orderVal,
              net_commission: commission,
              selected: true,
            };
          })
          .filter((r: ShopeeRow) => r.sub_id2 || r.order_value > 0 || r.net_commission > 0);
        setShopeeRows(rows);
      },
    });
  };

  const handleFile = (file: File) => {
    if (tab === "fb") parseFbCsv(file);
    else parseShopeeCsv(file);
  };

  // ── Import FB ──
  const importFb = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const selected = fbRows.filter((r) => r.selected);
    if (!selected.length) { setMsg("Chọn ít nhất 1 dòng"); return; }

    setImporting(true);
    const { data: batch } = await supabase
      .from("import_batches")
      .insert({
        filename: fileName,
        type: "fb_ads",
        total_rows: selected.length,
        matched_rows: selected.length,
        unmatched_rows: 0,
        status: "COMPLETED",
        created_by: user.id,
      })
      .select()
      .single();

    if (batch) {
      const inserts = selected.map((r) => ({
        batch_id: batch.id,
        campaign_name: r.campaign_name,
        ad_spend: r.ad_spend,
      }));
      const { error } = await supabase.from("fb_ads_data").insert(inserts);
      if (error) setMsg("Lỗi: " + error.message);
      else {
        setMsg(`✅ Import ${selected.length} chiến dịch FB thành công!`);
        setFbRows([]);
        setFileName("");
        fetchBatches();
      }
    }
    setImporting(false);
  };

  // ── Import Shopee ──
  const importShopee = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const selected = shopeeRows.filter((r) => r.selected);
    if (!selected.length) { setMsg("Chọn ít nhất 1 dòng"); return; }

    setImporting(true);
    const matched = selected.filter((r) => r.sub_id2).length;
    const { data: batch } = await supabase
      .from("import_batches")
      .insert({
        filename: fileName,
        type: "shopee_affiliate",
        total_rows: selected.length,
        matched_rows: matched,
        unmatched_rows: selected.length - matched,
        status: "COMPLETED",
        created_by: user.id,
      })
      .select()
      .single();

    if (batch) {
      const inserts = selected.map((r) => ({
        batch_id: batch.id,
        sub_id1: r.sub_id1,
        sub_id2: r.sub_id2,
        order_value: r.order_value,
        net_commission: r.net_commission,
      }));
      const { error } = await supabase.from("shopee_affiliate_data").insert(inserts);
      if (error) setMsg("Lỗi: " + error.message);
      else {
        setMsg(`✅ Import ${selected.length} đơn Shopee thành công! (${matched} có Sub_id2)`);
        setShopeeRows([]);
        setFileName("");
        fetchBatches();
      }
    }
    setImporting(false);
  };

  const hasData = tab === "fb" ? fbRows.length > 0 : shopeeRows.length > 0;

  // ── Summaries ──
  const fbTotal = fbRows.filter((r) => r.selected).reduce((s, r) => s + r.ad_spend, 0);
  const fbCount = fbRows.filter((r) => r.selected).length;

  const shopeeSelRows = shopeeRows.filter((r) => r.selected);
  const shopeeOrderVal = shopeeSelRows.reduce((s, r) => s + r.order_value, 0);
  const shopeeComm = shopeeSelRows.reduce((s, r) => s + r.net_commission, 0);
  const shopeeHasSub2 = shopeeSelRows.filter((r) => r.sub_id2).length;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Import dữ liệu</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Upload CSV từ Facebook Ads và Shopee Affiliate — hệ thống tự ghép qua tên chiến dịch
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--card)] border border-[var(--border)] rounded-lg p-0.5 mb-5 w-fit">
        <button
          onClick={() => { setTab("fb"); reset(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            tab === "fb"
              ? "bg-[#1877f2] text-white"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          }`}
        >
          <Megaphone size={16} /> FB Ads
        </button>
        <button
          onClick={() => { setTab("shopee"); reset(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            tab === "shopee"
              ? "bg-[#ee4d2d] text-white"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          }`}
        >
          <ShoppingBag size={16} /> Shopee Affiliate
        </button>
      </div>

      {/* Upload zone */}
      {!hasData && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl mb-5">
          <label className="block cursor-pointer">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="p-12 flex flex-col items-center text-center hover:bg-[var(--muted)] transition-colors rounded-xl">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{
                  background: tab === "fb" ? "rgba(24,119,242,0.1)" : "rgba(238,77,45,0.1)",
                }}
              >
                <Upload size={28} style={{ color: tab === "fb" ? "#1877f2" : "#ee4d2d" }} />
              </div>
              <div className="text-base font-semibold mb-1">
                {tab === "fb" ? "Upload báo cáo FB Ads" : "Upload báo cáo Shopee Affiliate"}
              </div>
              <div className="text-sm text-[var(--muted-foreground)] mb-4 max-w-lg">
                {tab === "fb" ? (
                  <>Cần cột: <code className="bg-[var(--muted)] px-1.5 py-0.5 rounded text-xs">Tên chiến dịch</code> + <code className="bg-[var(--muted)] px-1.5 py-0.5 rounded text-xs">Số tiền đã chi tiêu (VND)</code></>
                ) : (
                  <>Cần cột: <code className="bg-[var(--muted)] px-1.5 py-0.5 rounded text-xs">Sub_id2</code> (tên chiến dịch), <code className="bg-[var(--muted)] px-1.5 py-0.5 rounded text-xs">Sub_id1</code> (mã page), <code className="bg-[var(--muted)] px-1.5 py-0.5 rounded text-xs">Giá trị đơn hàng (₫)</code>, <code className="bg-[var(--muted)] px-1.5 py-0.5 rounded text-xs">Hoa hồng ròng TTLK(₫)</code></>
                )}
              </div>
              <span className="bg-[var(--muted)] border border-[var(--border)] px-3 py-1 rounded-md text-xs font-semibold text-[var(--muted-foreground)]">
                .csv
              </span>
            </div>
          </label>
        </div>
      )}

      {msg && !hasData && (
        <div
          className={`text-sm rounded-lg px-4 py-3 mb-4 ${
            msg.includes("✅") ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
          }`}
        >
          {msg}
        </div>
      )}

      {/* ══════════ FB ADS PREVIEW ══════════ */}
      {tab === "fb" && fbRows.length > 0 && (
        <div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-[11px] text-[var(--muted-foreground)] mb-1">CHIẾN DỊCH</div>
              <div className="font-mono text-xl font-bold">{fbCount}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-[11px] text-[var(--muted-foreground)] mb-1">TỔNG CHI ADS</div>
              <div className="font-mono text-xl font-bold text-red-400">{formatFullMoney(fbTotal)}</div>
            </div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-2">
                <Megaphone size={16} className="text-[#1877f2]" /> {fileName}
              </span>
              <button onClick={reset} className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
                <Trash2 size={12} /> Upload lại
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={fbRows.every((r) => r.selected)}
                        onChange={(e) => setFbRows(fbRows.map((r) => ({ ...r, selected: e.target.checked })))}
                        className="accent-[#1877f2]"
                      />
                    </th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">
                      Tên chiến dịch
                    </th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">
                      Chi tiêu (VND)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fbRows.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={r.selected}
                          onChange={() => setFbRows(fbRows.map((x) => (x.id === r.id ? { ...x, selected: !x.selected } : x)))}
                          className="accent-[#1877f2]"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-sm font-medium">{r.campaign_name}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm text-red-400 font-semibold">
                        {formatFullMoney(r.ad_spend)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between">
              <span className="text-sm text-[var(--muted-foreground)]">{fbCount} chiến dịch</span>
              <div className="flex items-center gap-3">
                {msg && <span className={`text-sm ${msg.includes("✅") ? "text-green-400" : "text-red-400"}`}>{msg}</span>}
                <button
                  onClick={importFb}
                  disabled={importing}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#1877f2] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  <Check size={14} /> {importing ? "Đang import..." : "Import FB Ads"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ SHOPEE PREVIEW ══════════ */}
      {tab === "shopee" && shopeeRows.length > 0 && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-[11px] text-[var(--muted-foreground)] mb-1">TỔNG ĐƠN</div>
              <div className="font-mono text-xl font-bold">{shopeeSelRows.length}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-[11px] text-[var(--muted-foreground)] mb-1">GIÁ TRỊ ĐƠN HÀNG</div>
              <div className="font-mono text-xl font-bold text-green-400">{formatMoney(shopeeOrderVal)}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-[11px] text-[var(--muted-foreground)] mb-1">HOA HỒNG RÒNG</div>
              <div className="font-mono text-xl font-bold text-indigo-400">{formatMoney(shopeeComm)}</div>
            </div>
            <div className="bg-[var(--card)] border border-green-500/20 rounded-xl p-4">
              <div className="text-[11px] text-[var(--muted-foreground)] mb-1">CÓ SUB_ID2</div>
              <div className="font-mono text-xl font-bold text-green-400">
                {shopeeHasSub2}
                <span className="text-sm text-[var(--muted-foreground)]">/{shopeeSelRows.length}</span>
              </div>
            </div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-2">
                <ShoppingBag size={16} className="text-[#ee4d2d]" /> {fileName}
              </span>
              <button onClick={reset} className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
                <Trash2 size={12} /> Upload lại
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={shopeeRows.every((r) => r.selected)}
                        onChange={(e) => setShopeeRows(shopeeRows.map((r) => ({ ...r, selected: e.target.checked })))}
                        className="accent-[var(--accent)]"
                      />
                    </th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">
                      Sub_id2 (chiến dịch)
                    </th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">
                      Sub_id1 (page)
                    </th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">
                      Giá trị đơn hàng
                    </th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">
                      Hoa hồng ròng
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shopeeRows.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={r.selected}
                          onChange={() =>
                            setShopeeRows(shopeeRows.map((x) => (x.id === r.id ? { ...x, selected: !x.selected } : x)))
                          }
                          className="accent-[var(--accent)]"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {r.sub_id2 ? (
                            <Check size={13} className="text-green-400" />
                          ) : (
                            <AlertTriangle size={13} className="text-amber-400" />
                          )}
                          <span className="text-sm font-medium">{r.sub_id2 || "—"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-sm font-mono text-[var(--muted-foreground)]">
                        {r.sub_id1 || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm text-green-400">
                        {formatMoney(r.order_value)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm font-semibold text-indigo-400">
                        {formatMoney(r.net_commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between">
              <span className="text-sm text-[var(--muted-foreground)]">{shopeeSelRows.length} dòng</span>
              <div className="flex items-center gap-3">
                {msg && <span className={`text-sm ${msg.includes("✅") ? "text-green-400" : "text-red-400"}`}>{msg}</span>}
                <button
                  onClick={importShopee}
                  disabled={importing}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#ee4d2d] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  <Check size={14} /> {importing ? "Đang import..." : "Import Shopee"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ HISTORY ══════════ */}
      {!hasData && batches.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <span className="text-sm font-semibold">Lịch sử import</span>
          </div>
          {batches.map((b) => (
            <div key={b.id} className="px-4 py-3 flex items-center gap-4 border-b border-[var(--border)] text-sm">
              <span className="font-mono text-xs text-[var(--muted-foreground)]">#{b.id.slice(0, 8)}</span>
              <span className="font-mono text-xs text-[var(--muted-foreground)]">
                {new Date(b.created_at).toLocaleDateString("vi-VN")}
              </span>
              <div className="flex items-center gap-1.5 flex-1">
                {b.type === "fb_ads" ? (
                  <Megaphone size={14} className="text-[#1877f2]" />
                ) : (
                  <ShoppingBag size={14} className="text-[#ee4d2d]" />
                )}
                <span>{b.filename}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                  {b.type === "fb_ads" ? "FB Ads" : "Shopee"}
                </span>
              </div>
              <span className="text-[var(--muted-foreground)]">{b.total_rows} dòng</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
