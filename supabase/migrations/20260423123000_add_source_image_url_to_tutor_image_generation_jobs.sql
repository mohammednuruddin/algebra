ALTER TABLE tutor_image_generation_jobs
    ADD COLUMN IF NOT EXISTS source_image_url TEXT;
