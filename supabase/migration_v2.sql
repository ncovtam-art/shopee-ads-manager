-- ═══════════════════════════════════════════
-- SHOPEE ADS MANAGER v2 — MIGRATION
-- Thêm bảng flat import cho FB Ads + Shopee Affiliate
-- Ghép tự động qua campaign_name = sub_id2
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════

-- ── FB ADS DATA (from Facebook Ads CSV export) ──
CREATE TABLE IF NOT EXISTS fb_ads_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID REFERENCES import_batches(id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL,        -- "Tên chiến dịch"
  ad_spend DECIMAL(15,2) DEFAULT 0,   -- "Số tiền đã chi tiêu (VND)"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SHOPEE AFFILIATE DATA (from Shopee Affiliate CSV export) ──
CREATE TABLE IF NOT EXISTS shopee_affiliate_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID REFERENCES import_batches(id) ON DELETE CASCADE,
  sub_id1 TEXT,                       -- Mã page
  sub_id2 TEXT,                       -- Tên chiến dịch FB (match key)
  order_value DECIMAL(15,2) DEFAULT 0,    -- "Giá trị đơn hàng (₫)"
  net_commission DECIMAL(15,2) DEFAULT 0, -- "Hoa hồng ròng tiếp thị liên kết(₫)"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ──
CREATE INDEX IF NOT EXISTS idx_fb_ads_campaign ON fb_ads_data(campaign_name);
CREATE INDEX IF NOT EXISTS idx_fb_ads_batch ON fb_ads_data(batch_id);
CREATE INDEX IF NOT EXISTS idx_shopee_aff_sub2 ON shopee_affiliate_data(sub_id2);
CREATE INDEX IF NOT EXISTS idx_shopee_aff_sub1 ON shopee_affiliate_data(sub_id1);
CREATE INDEX IF NOT EXISTS idx_shopee_aff_batch ON shopee_affiliate_data(batch_id);

-- ── RLS ──
ALTER TABLE fb_ads_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopee_affiliate_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin fb_ads" ON fb_ads_data FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'LEADER'))
);
CREATE POLICY "Admin shopee_aff" ON shopee_affiliate_data FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'LEADER'))
);

-- ── VIEW: Campaign P&L (auto-join via campaign_name = sub_id2) ──
CREATE OR REPLACE VIEW campaign_pnl AS
WITH fb AS (
  SELECT
    campaign_name,
    SUM(ad_spend) AS total_ad_spend
  FROM fb_ads_data
  GROUP BY campaign_name
),
shopee AS (
  SELECT
    sub_id2 AS campaign_name,
    sub_id1,
    SUM(order_value) AS total_order_value,
    SUM(net_commission) AS total_commission,
    COUNT(*) AS total_orders
  FROM shopee_affiliate_data
  GROUP BY sub_id2, sub_id1
)
SELECT
  COALESCE(fb.campaign_name, shopee.campaign_name) AS campaign_name,
  shopee.sub_id1 AS page_code,
  COALESCE(fb.total_ad_spend, 0) AS ad_spend,
  COALESCE(shopee.total_order_value, 0) AS order_value,
  COALESCE(shopee.total_commission, 0) AS commission,
  COALESCE(shopee.total_orders, 0) AS orders,
  COALESCE(shopee.total_commission, 0) - COALESCE(fb.total_ad_spend, 0) AS profit,
  CASE
    WHEN COALESCE(fb.total_ad_spend, 0) > 0
    THEN ROUND(((COALESCE(shopee.total_commission, 0) - COALESCE(fb.total_ad_spend, 0)) / fb.total_ad_spend) * 100, 1)
    ELSE NULL
  END AS roi_percent,
  CASE
    WHEN COALESCE(fb.total_ad_spend, 0) > 0
    THEN ROUND(COALESCE(shopee.total_order_value, 0) / fb.total_ad_spend, 2)
    ELSE NULL
  END AS roas
FROM fb
FULL OUTER JOIN shopee ON fb.campaign_name = shopee.campaign_name;
