-- ═══════════════════════════════════════════
-- SHOPEE ADS MANAGER v3 — FULL MIGRATION
-- Chạy trên Supabase SQL Editor
-- Giữ lại bảng cũ, thêm cột mới + bảng mới
-- ═══════════════════════════════════════════

-- ── 1. Thêm report_date vào fb_ads_data ──
ALTER TABLE fb_ads_data ADD COLUMN IF NOT EXISTS report_date DATE;
ALTER TABLE fb_ads_data ADD COLUMN IF NOT EXISTS facebook_campaign_id TEXT;
ALTER TABLE fb_ads_data ADD COLUMN IF NOT EXISTS impressions INT DEFAULT 0;
ALTER TABLE fb_ads_data ADD COLUMN IF NOT EXISTS clicks INT DEFAULT 0;
ALTER TABLE fb_ads_data ADD COLUMN IF NOT EXISTS link_clicks INT DEFAULT 0;
ALTER TABLE fb_ads_data ADD COLUMN IF NOT EXISTS cpc DECIMAL(10,2) DEFAULT 0;
ALTER TABLE fb_ads_data ADD COLUMN IF NOT EXISTS cpm DECIMAL(10,2) DEFAULT 0;
ALTER TABLE fb_ads_data ADD COLUMN IF NOT EXISTS ctr DECIMAL(8,4) DEFAULT 0;
ALTER TABLE fb_ads_data ADD COLUMN IF NOT EXISTS row_hash TEXT;
ALTER TABLE fb_ads_data ADD COLUMN IF NOT EXISTS page_id UUID REFERENCES pages(id);

-- ── 2. Thêm report_date + fields vào shopee_affiliate_data ──
ALTER TABLE shopee_affiliate_data ADD COLUMN IF NOT EXISTS report_date DATE;
ALTER TABLE shopee_affiliate_data ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE shopee_affiliate_data ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE shopee_affiliate_data ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE shopee_affiliate_data ADD COLUMN IF NOT EXISTS clicks INT DEFAULT 0;
ALTER TABLE shopee_affiliate_data ADD COLUMN IF NOT EXISTS orders_count INT DEFAULT 0;
ALTER TABLE shopee_affiliate_data ADD COLUMN IF NOT EXISTS order_status TEXT;
ALTER TABLE shopee_affiliate_data ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE shopee_affiliate_data ADD COLUMN IF NOT EXISTS row_hash TEXT;

-- ── 3. Campaign-SubID Mapping ──
CREATE TABLE IF NOT EXISTS campaign_subid_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_name TEXT NOT NULL,
  sub_id2 TEXT NOT NULL,
  page_id UUID REFERENCES pages(id),
  is_current BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_name, sub_id2)
);

-- ── 4. Page assignments history ──
CREATE TABLE IF NOT EXISTS page_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID NOT NULL REFERENCES pages(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  assigned_from DATE DEFAULT CURRENT_DATE,
  assigned_to DATE,
  assigned_by UUID REFERENCES profiles(id),
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Indexes ──
CREATE INDEX IF NOT EXISTS idx_fb_ads_report_date ON fb_ads_data(report_date);
CREATE INDEX IF NOT EXISTS idx_fb_ads_page ON fb_ads_data(page_id);
CREATE INDEX IF NOT EXISTS idx_fb_ads_hash ON fb_ads_data(row_hash);
CREATE INDEX IF NOT EXISTS idx_shopee_report_date ON shopee_affiliate_data(report_date);
CREATE INDEX IF NOT EXISTS idx_shopee_hash ON shopee_affiliate_data(row_hash);
CREATE INDEX IF NOT EXISTS idx_mapping_campaign ON campaign_subid_mapping(campaign_name);
CREATE INDEX IF NOT EXISTS idx_mapping_subid ON campaign_subid_mapping(sub_id2);
CREATE INDEX IF NOT EXISTS idx_page_assign_page ON page_assignments(page_id, is_current);
CREATE INDEX IF NOT EXISTS idx_page_assign_user ON page_assignments(user_id, is_current);

-- ── 6. RLS cho bảng mới ──
ALTER TABLE campaign_subid_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All access campaign_mapping" ON campaign_subid_mapping FOR ALL 
  USING (true);
CREATE POLICY "All access page_assignments" ON page_assignments FOR ALL 
  USING (true);

-- ── 7. View: Page P&L tổng hợp ──
CREATE OR REPLACE VIEW page_finance_summary AS
WITH fb AS (
  SELECT
    f.page_id,
    COALESCE(f.report_date, f.created_at::date) AS rdate,
    SUM(f.ad_spend) AS ad_spend,
    SUM(f.impressions) AS impressions,
    SUM(f.clicks) AS clicks
  FROM fb_ads_data f
  WHERE f.page_id IS NOT NULL
  GROUP BY f.page_id, rdate
),
shopee AS (
  SELECT
    m.page_id,
    COALESCE(s.report_date, s.created_at::date) AS rdate,
    SUM(s.order_value) AS gmv,
    SUM(s.net_commission) AS commission,
    COUNT(*) AS orders
  FROM shopee_affiliate_data s
  JOIN campaign_subid_mapping m ON m.sub_id2 = s.sub_id2 AND m.is_current = TRUE
  WHERE m.page_id IS NOT NULL
  GROUP BY m.page_id, rdate
)
SELECT
  COALESCE(fb.page_id, shopee.page_id) AS page_id,
  COALESCE(fb.rdate, shopee.rdate) AS report_date,
  COALESCE(fb.ad_spend, 0) AS ad_spend,
  COALESCE(fb.impressions, 0) AS impressions,
  COALESCE(fb.clicks, 0) AS clicks,
  COALESCE(shopee.gmv, 0) AS gmv,
  COALESCE(shopee.commission, 0) AS commission,
  COALESCE(shopee.orders, 0) AS orders
FROM fb FULL OUTER JOIN shopee 
  ON fb.page_id = shopee.page_id AND fb.rdate = shopee.rdate;

-- ── 8. Cập nhật campaign_pnl view ──
CREATE OR REPLACE VIEW campaign_pnl AS
WITH fb AS (
  SELECT campaign_name, SUM(ad_spend) AS total_ad_spend
  FROM fb_ads_data GROUP BY campaign_name
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
  CASE WHEN COALESCE(fb.total_ad_spend, 0) > 0
    THEN ROUND(((COALESCE(shopee.total_commission, 0) - COALESCE(fb.total_ad_spend, 0)) / fb.total_ad_spend) * 100, 1)
    ELSE NULL END AS roi_percent,
  CASE WHEN COALESCE(fb.total_ad_spend, 0) > 0
    THEN ROUND(COALESCE(shopee.total_order_value, 0) / fb.total_ad_spend, 2)
    ELSE NULL END AS roas
FROM fb FULL OUTER JOIN shopee ON fb.campaign_name = shopee.campaign_name;
