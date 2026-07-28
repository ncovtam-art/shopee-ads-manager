-- ═══════════════════════════════════════════
-- SHOPEE ADS MANAGER - DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUM TYPES ──
CREATE TYPE user_role AS ENUM ('ADMIN', 'LEADER', 'EMPLOYEE');
CREATE TYPE entity_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE report_status AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- ═══════════════════════════════════════════
-- PROFILES (extends Supabase Auth)
-- ═══════════════════════════════════════════
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role user_role DEFAULT 'EMPLOYEE',
  status entity_status DEFAULT 'ACTIVE',
  join_date DATE DEFAULT CURRENT_DATE,
  can_input_revenue BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- TEAMS
-- ═══════════════════════════════════════════
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  leader_id UUID REFERENCES profiles(id),
  status entity_status DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);

-- ═══════════════════════════════════════════
-- PAGES (Facebook Pages)
-- ═══════════════════════════════════════════
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  facebook_url TEXT,
  facebook_uid TEXT UNIQUE,
  assignee_id UUID REFERENCES profiles(id),
  status entity_status DEFAULT 'ACTIVE',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- CAMPAIGNS
-- ═══════════════════════════════════════════
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  budget DECIMAL(15,2),
  status entity_status DEFAULT 'ACTIVE',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- PRODUCTS
-- ═══════════════════════════════════════════
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  shopee_url TEXT,
  shopee_id TEXT UNIQUE,
  category TEXT,
  image_url TEXT,
  status entity_status DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- SUB IDs
-- ═══════════════════════════════════════════
CREATE TABLE sub_ids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sub_id_code TEXT UNIQUE NOT NULL,
  name TEXT,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  status entity_status DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- EXPENSES
-- ═══════════════════════════════════════════
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  page_id UUID REFERENCES pages(id),
  campaign_id UUID REFERENCES campaigns(id),
  sub_id_id UUID REFERENCES sub_ids(id),
  ads_cost DECIMAL(15,2) DEFAULT 0,
  tool_cost DECIMAL(15,2) DEFAULT 0,
  bm_cost DECIMAL(15,2) DEFAULT 0,
  via_cost DECIMAL(15,2) DEFAULT 0,
  proxy_cost DECIMAL(15,2) DEFAULT 0,
  vps_cost DECIMAL(15,2) DEFAULT 0,
  staff_cost DECIMAL(15,2) DEFAULT 0,
  other_cost DECIMAL(15,2) DEFAULT 0,
  total_cost DECIMAL(15,2) GENERATED ALWAYS AS (
    ads_cost + tool_cost + bm_cost + via_cost + proxy_cost + vps_cost + staff_cost + other_cost
  ) STORED,
  source TEXT DEFAULT 'manual', -- 'manual' | 'import_fb'
  note TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- IMPORT BATCHES
-- ═══════════════════════════════════════════
CREATE TABLE import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'shopee', -- 'shopee' | 'facebook_ads'
  total_rows INT DEFAULT 0,
  matched_rows INT DEFAULT 0,
  unmatched_rows INT DEFAULT 0,
  status TEXT DEFAULT 'PROCESSING', -- PROCESSING | COMPLETED | FAILED
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- AFFILIATE REPORTS (Shopee data)
-- ═══════════════════════════════════════════
CREATE TABLE affiliate_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  sub_id_code TEXT NOT NULL,
  sub_id_id UUID REFERENCES sub_ids(id),
  clicks INT DEFAULT 0,
  orders INT DEFAULT 0,
  revenue DECIMAL(15,2) DEFAULT 0,
  commission DECIMAL(15,2) DEFAULT 0,
  matched BOOLEAN DEFAULT FALSE,
  import_batch_id UUID REFERENCES import_batches(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- DAILY REPORTS (Reconciliation)
-- ═══════════════════════════════════════════
CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  employee_id UUID NOT NULL REFERENCES profiles(id),
  page_id UUID NOT NULL REFERENCES pages(id),
  campaign_id UUID REFERENCES campaigns(id),
  sub_id_id UUID REFERENCES sub_ids(id),
  product_id UUID REFERENCES products(id),
  ads_cost DECIMAL(15,2) DEFAULT 0,
  commission DECIMAL(15,2) DEFAULT 0,
  revenue DECIMAL(15,2) DEFAULT 0,
  orders INT DEFAULT 0,
  video_url TEXT,
  hook TEXT,
  caption TEXT,
  note TEXT,
  status report_status DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, employee_id, page_id)
);

-- ═══════════════════════════════════════════
-- APPROVALS
-- ═══════════════════════════════════════════
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_report_id UUID UNIQUE NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id),
  status report_status NOT NULL,
  reason TEXT,
  reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- NOTIFICATIONS
-- ═══════════════════════════════════════════
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- ROI_NEGATIVE | ADS_OVER_COMMISSION | PAGE_LOSS_3D | RECONCILE_MISSING
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- AUDIT LOGS
-- ═══════════════════════════════════════════
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL, -- CREATE | UPDATE | DELETE | IMPORT | APPROVE | REJECT | LOGIN
  entity TEXT NOT NULL,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════
CREATE INDEX idx_profiles_role ON profiles(role, status);
CREATE INDEX idx_pages_assignee ON pages(assignee_id, status);
CREATE INDEX idx_campaigns_page ON campaigns(page_id, status);
CREATE INDEX idx_sub_ids_campaign ON sub_ids(campaign_id);
CREATE INDEX idx_sub_ids_code ON sub_ids(sub_id_code);
CREATE INDEX idx_expenses_date_page ON expenses(date, page_id);
CREATE INDEX idx_expenses_created_by ON expenses(created_by);
CREATE INDEX idx_affiliate_date_subid ON affiliate_reports(date, sub_id_code);
CREATE INDEX idx_daily_reports_date ON daily_reports(date, status);
CREATE INDEX idx_daily_reports_employee ON daily_reports(employee_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at);
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at);

-- ═══════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin can see everything
CREATE POLICY "Admin full access" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());

-- Pages: Admin sees all, Employee sees assigned only
CREATE POLICY "Admin pages" ON pages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Employee sees assigned pages" ON pages FOR SELECT USING (assignee_id = auth.uid());

-- Expenses: Admin sees all, users see own
CREATE POLICY "Admin expenses" ON expenses FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "User own expenses" ON expenses FOR SELECT USING (created_by = auth.uid());
CREATE POLICY "User create expenses" ON expenses FOR INSERT WITH CHECK (created_by = auth.uid());

-- Daily reports: Admin sees all, employee sees own
CREATE POLICY "Admin daily reports" ON daily_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Employee own reports" ON daily_reports FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "Employee create reports" ON daily_reports FOR INSERT WITH CHECK (employee_id = auth.uid());
CREATE POLICY "Employee update own reports" ON daily_reports FOR UPDATE USING (employee_id = auth.uid());

-- Notifications: users see own only
CREATE POLICY "Own notifications" ON notifications FOR ALL USING (user_id = auth.uid());

-- Audit logs: admin only
CREATE POLICY "Admin audit logs" ON audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Anyone insert audit" ON audit_logs FOR INSERT WITH CHECK (true);

-- Open policies for other tables (admin-managed)
CREATE POLICY "Admin teams" ON teams FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'LEADER'))
);
CREATE POLICY "View teams" ON team_members FOR SELECT USING (true);
CREATE POLICY "Admin campaigns" ON campaigns FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "View campaigns" ON campaigns FOR SELECT USING (true);
CREATE POLICY "Admin sub_ids" ON sub_ids FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "View sub_ids" ON sub_ids FOR SELECT USING (true);
CREATE POLICY "Admin products" ON products FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "View products" ON products FOR SELECT USING (true);
CREATE POLICY "Admin import_batches" ON import_batches FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'LEADER'))
);
CREATE POLICY "Admin affiliate" ON affiliate_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'LEADER'))
);
CREATE POLICY "Admin approvals" ON approvals FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'LEADER'))
);

-- ═══════════════════════════════════════════
-- FUNCTION: Auto-create profile on signup
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'EMPLOYEE')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ═══════════════════════════════════════════
-- VIEW: Page P&L Summary
-- ═══════════════════════════════════════════
CREATE OR REPLACE VIEW page_pnl AS
SELECT
  p.id AS page_id,
  p.name AS page_name,
  p.assignee_id,
  pr.name AS assignee_name,
  COALESCE(e.total_expense, 0) AS total_expense,
  COALESCE(e.total_ads_cost, 0) AS total_ads_cost,
  COALESCE(a.total_revenue, 0) AS total_revenue,
  COALESCE(a.total_commission, 0) AS total_commission,
  COALESCE(a.total_orders, 0) AS total_orders,
  COALESCE(a.total_commission, 0) - COALESCE(e.total_expense, 0) AS profit,
  CASE WHEN COALESCE(e.total_expense, 0) > 0
    THEN ROUND(((COALESCE(a.total_commission, 0) - COALESCE(e.total_expense, 0)) / COALESCE(e.total_expense, 0)) * 100, 1)
    ELSE 0
  END AS roi,
  CASE WHEN COALESCE(e.total_ads_cost, 0) > 0
    THEN ROUND(COALESCE(a.total_revenue, 0) / COALESCE(e.total_ads_cost, 0), 2)
    ELSE 0
  END AS roas,
  p.status
FROM pages p
LEFT JOIN profiles pr ON pr.id = p.assignee_id
LEFT JOIN LATERAL (
  SELECT
    SUM(total_cost) AS total_expense,
    SUM(ads_cost) AS total_ads_cost
  FROM expenses WHERE page_id = p.id
) e ON true
LEFT JOIN LATERAL (
  SELECT
    SUM(ar.revenue) AS total_revenue,
    SUM(ar.commission) AS total_commission,
    SUM(ar.orders) AS total_orders
  FROM affiliate_reports ar
  JOIN sub_ids si ON si.id = ar.sub_id_id
  JOIN campaigns c ON c.id = si.campaign_id
  WHERE c.page_id = p.id
) a ON true;

-- ═══════════════════════════════════════════
-- SEED: Create first admin user
-- (Run AFTER creating the user via Supabase Auth)
-- ═══════════════════════════════════════════
-- UPDATE profiles SET role = 'ADMIN' WHERE email = 'your-admin-email@gmail.com';
