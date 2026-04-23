alter table if exists public.tutor_image_generation_jobs
  add column if not exists processing_claim_token text,
  add column if not exists processing_claimed_at timestamptz,
  add column if not exists processing_lease_expires_at timestamptz;
