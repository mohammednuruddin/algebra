-- Create tutor_image_generation_jobs table
CREATE TABLE IF NOT EXISTS tutor_image_generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    prediction_id TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('generate', 'edit')),
    purpose TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    prompt TEXT NOT NULL,
    source_image_id TEXT,
    requested_edits_json JSONB,
    asset_storage_path TEXT,
    asset_url TEXT,
    asset_alt_text TEXT,
    asset_description TEXT,
    asset_metadata_json JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tutor_image_generation_jobs_session_id
    ON tutor_image_generation_jobs(session_id);

CREATE INDEX IF NOT EXISTS idx_tutor_image_generation_jobs_status
    ON tutor_image_generation_jobs(status);

CREATE INDEX IF NOT EXISTS idx_tutor_image_generation_jobs_created_at
    ON tutor_image_generation_jobs(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tutor_image_generation_jobs_prediction_id
    ON tutor_image_generation_jobs(prediction_id);

CREATE TRIGGER update_tutor_image_generation_jobs_updated_at
    BEFORE UPDATE ON tutor_image_generation_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE tutor_image_generation_jobs ENABLE ROW LEVEL SECURITY;
