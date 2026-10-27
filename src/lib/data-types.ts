export type PageSummary = {
  page_id: string; page_name: string;
  total_ad_spend: number | string | null; total_gmv: number | string | null;
  total_commission: number | string | null; total_orders: number | string | null;
};
export type PageRecord = {
  id: string; name: string; status: string; assignee_id?: string | null;
  assignee?: { name: string } | null;
};
export type DailySummary = {
  report_date: string; ad_spend: number | string | null; gmv: number | string | null;
  commission: number | string | null; orders: number | string | null;
};
export type CampaignSummary = DailySummary & { campaign_name: string | null; sub_id1: string | null; source: string };
export type ImportBatch = {
  id: string; filename: string; type: string; total_rows: number;
  matched_rows: number; unmatched_rows: number; status: string;
  created_at: string; report_date?: string; pages?: { name: string } | null;
};
