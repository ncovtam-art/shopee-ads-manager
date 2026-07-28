import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getAdmin();
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const pageId = searchParams.get("pageId");
    const type = searchParams.get("type") || "summary"; // summary | by-campaign | by-page | by-date

    // FB Ads — fetch all, filter in JS to handle NULL report_date
    let fbQuery = supabase.from("fb_ads_data").select("campaign_name, ad_spend, page_id, report_date, created_at");
    if (pageId) fbQuery = fbQuery.eq("page_id", pageId);
    const { data: fbAll } = await fbQuery;

    // Filter by date (use report_date if exists, else created_at)
    const fbRaw = (fbAll || []).filter(r => {
      const d = r.report_date || (r.created_at ? r.created_at.split("T")[0] : null);
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      return true;
    });

    // Shopee Affiliate — same approach
    const { data: shopeeAll } = await supabase.from("shopee_affiliate_data").select("sub_id1, sub_id2, order_value, net_commission, report_date, created_at, channel");

    const shopeeRaw = (shopeeAll || []).filter(r => {
      const d = r.report_date || (r.created_at ? r.created_at.split("T")[0] : null);
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      return true;
    });

    // Aggregate based on type
    if (type === "summary") {
      const totalAdSpend = fbRaw?.reduce((s, r) => s + Number(r.ad_spend || 0), 0) || 0;
      const totalGMV = shopeeRaw?.reduce((s, r) => s + Number(r.order_value || 0), 0) || 0;
      const totalCommission = shopeeRaw?.reduce((s, r) => s + Number(r.net_commission || 0), 0) || 0;
      const totalOrders = shopeeRaw?.length || 0;
      const profit = totalCommission - totalAdSpend;
      const roi = totalAdSpend > 0 ? Math.round((profit / totalAdSpend) * 1000) / 10 : null;
      const commRoas = totalAdSpend > 0 ? Math.round((totalCommission / totalAdSpend) * 100) / 100 : null;
      const gmvRoas = totalAdSpend > 0 ? Math.round((totalGMV / totalAdSpend) * 100) / 100 : null;

      return NextResponse.json({
        success: true,
        data: { adSpend: totalAdSpend, gmv: totalGMV, commission: totalCommission, orders: totalOrders, profit, roi, commRoas, gmvRoas },
      });
    }

    if (type === "by-campaign") {
      const fbMap = new Map<string, number>();
      fbRaw?.forEach(r => fbMap.set(r.campaign_name, (fbMap.get(r.campaign_name) || 0) + Number(r.ad_spend || 0)));

      const shopeeMap = new Map<string, { page: string; gmv: number; commission: number; orders: number }>();
      shopeeRaw?.forEach(r => {
        const key = r.sub_id2 || "__none__";
        const ex = shopeeMap.get(key) || { page: "", gmv: 0, commission: 0, orders: 0 };
        ex.gmv += Number(r.order_value || 0);
        ex.commission += Number(r.net_commission || 0);
        ex.orders += 1;
        if (r.sub_id1 && !ex.page) ex.page = r.sub_id1;
        shopeeMap.set(key, ex);
      });

      const allKeys = new Set([...fbMap.keys(), ...shopeeMap.keys()]);
      allKeys.delete("__none__");
      const campaigns = Array.from(allKeys).map(name => {
        const spend = fbMap.get(name) || 0;
        const s = shopeeMap.get(name) || { page: "", gmv: 0, commission: 0, orders: 0 };
        const profit = s.commission - spend;
        return {
          campaignName: name, pageCode: s.page, adSpend: spend,
          gmv: s.gmv, commission: s.commission, orders: s.orders, profit,
          roi: spend > 0 ? Math.round((profit / spend) * 1000) / 10 : null,
          roas: spend > 0 ? Math.round((s.commission / spend) * 100) / 100 : null,
        };
      });
      campaigns.sort((a, b) => b.profit - a.profit);
      return NextResponse.json({ success: true, data: campaigns });
    }

    if (type === "by-page") {
      // Group by page
      const pageMap = new Map<string, { adSpend: number; gmv: number; commission: number; orders: number }>();
      
      // Get pages
      const { data: pages } = await supabase.from("pages").select("id, name, assignee_id, status");
      const pageNames = new Map<string, string>();
      pages?.forEach(p => pageNames.set(p.id, p.name));

      fbRaw?.forEach(r => {
        if (!r.page_id) return;
        const ex = pageMap.get(r.page_id) || { adSpend: 0, gmv: 0, commission: 0, orders: 0 };
        ex.adSpend += Number(r.ad_spend || 0);
        pageMap.set(r.page_id, ex);
      });

      // Get campaign->page mapping
      const { data: mappings } = await supabase.from("campaign_subid_mapping").select("sub_id2, page_id").eq("is_current", true);
      const subToPage = new Map<string, string>();
      mappings?.forEach(m => { if (m.page_id) subToPage.set(m.sub_id2, m.page_id); });

      shopeeRaw?.forEach(r => {
        const pid = subToPage.get(r.sub_id2 || "");
        if (!pid) return;
        const ex = pageMap.get(pid) || { adSpend: 0, gmv: 0, commission: 0, orders: 0 };
        ex.gmv += Number(r.order_value || 0);
        ex.commission += Number(r.net_commission || 0);
        ex.orders += 1;
        pageMap.set(pid, ex);
      });

      const result = Array.from(pageMap.entries()).map(([pageId, d]) => {
        const profit = d.commission - d.adSpend;
        return {
          pageId, pageName: pageNames.get(pageId) || pageId,
          ...d, profit,
          roi: d.adSpend > 0 ? Math.round((profit / d.adSpend) * 1000) / 10 : null,
          roas: d.adSpend > 0 ? Math.round((d.commission / d.adSpend) * 100) / 100 : null,
        };
      });
      result.sort((a, b) => b.profit - a.profit);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: "Invalid type" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
