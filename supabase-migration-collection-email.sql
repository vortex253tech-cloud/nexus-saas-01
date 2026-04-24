-- NEXUS Migration — Add email support to collection_logs

-- Add method column to collection_logs if not exists
ALTER TABLE collection_logs 
ADD COLUMN IF NOT EXISTS method text DEFAULT 'whatsapp' CHECK (method IN ('whatsapp', 'email', 'none'));

-- Update existing rows to have method 'whatsapp' (historical data)
UPDATE collection_logs 
SET method = 'whatsapp' 
WHERE method IS NULL;

-- Add index for method filtering
CREATE INDEX IF NOT EXISTS idx_collection_logs_method ON collection_logs (method);

-- Comment on new column
COMMENT ON COLUMN collection_logs.method IS 'Collection method used: whatsapp, email, or none';
