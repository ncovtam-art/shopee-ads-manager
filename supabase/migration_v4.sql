-- Migration v4: Thêm page_id vào shopee_affiliate_data
ALTER TABLE shopee_affiliate_data ADD COLUMN IF NOT EXISTS page_id UUID REFERENCES pages(id);
CREATE INDEX IF NOT EXISTS idx_shopee_page ON shopee_affiliate_data(page_id);

-- Thêm page_id vào import_batches để biết batch thuộc page nào
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS page_id UUID REFERENCES pages(id);
