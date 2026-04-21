-- Create lesson_sessions table
CREATE TABLE IF NOT EXISTS lesson_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_prompt TEXT NOT NULL,
    normalized_topic TEXT,
    status TEXT NOT NULL CHECK (status IN ('planning', 'ready', 'active', 'completed')),
    lesson_plan_json JSONB,
    media_manifest_json JSONB,
    current_milestone_id TEXT,
    summary_json JSONB,
    article_path TEXT,
    article_generated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create lesson_turns table
CREATE TABLE IF NOT EXISTS lesson_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
    turn_index INTEGER NOT NULL,
    actor TEXT NOT NULL CHECK (actor IN ('learner', 'teacher')),
    input_mode TEXT,
    raw_input_json JSONB,
    interpreted_input_json JSONB,
    teacher_response_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create lesson_milestone_progress table
CREATE TABLE IF NOT EXISTS lesson_milestone_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
    milestone_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('not_started', 'introduced', 'practiced', 'covered', 'confirmed')),
    evidence_json JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create lesson_media_assets table
CREATE TABLE IF NOT EXISTS lesson_media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('searched', 'generated', 'uploaded')),
    storage_path TEXT NOT NULL,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create canvas_snapshots table
CREATE TABLE IF NOT EXISTS canvas_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
    turn_id UUID REFERENCES lesson_turns(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL,
    snapshot_type TEXT,
    interpreter_result_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create lesson_articles table
CREATE TABLE IF NOT EXISTS lesson_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    article_markdown TEXT NOT NULL,
    article_storage_path TEXT NOT NULL,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lesson_sessions_user_id ON lesson_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_sessions_status ON lesson_sessions(status);
CREATE INDEX IF NOT EXISTS idx_lesson_sessions_created_at ON lesson_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lesson_turns_session_id ON lesson_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_lesson_turns_created_at ON lesson_turns(created_at);

CREATE INDEX IF NOT EXISTS idx_lesson_milestone_progress_session_id ON lesson_milestone_progress(session_id);

CREATE INDEX IF NOT EXISTS idx_lesson_media_assets_session_id ON lesson_media_assets(session_id);

CREATE INDEX IF NOT EXISTS idx_canvas_snapshots_session_id ON canvas_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_canvas_snapshots_turn_id ON canvas_snapshots(turn_id);

CREATE INDEX IF NOT EXISTS idx_lesson_articles_session_id ON lesson_articles(session_id);
CREATE INDEX IF NOT EXISTS idx_lesson_articles_user_id ON lesson_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_articles_created_at ON lesson_articles(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at columns
CREATE TRIGGER update_lesson_sessions_updated_at
    BEFORE UPDATE ON lesson_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lesson_articles_updated_at
    BEFORE UPDATE ON lesson_articles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE lesson_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_milestone_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_articles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for lesson_sessions
CREATE POLICY "Users can view their own sessions"
    ON lesson_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
    ON lesson_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
    ON lesson_sessions FOR UPDATE
    USING (auth.uid() = user_id);

-- Create RLS policies for lesson_turns
CREATE POLICY "Users can view turns from their sessions"
    ON lesson_turns FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM lesson_sessions
        WHERE lesson_sessions.id = lesson_turns.session_id
        AND lesson_sessions.user_id = auth.uid()
    ));

CREATE POLICY "Users can create turns in their sessions"
    ON lesson_turns FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM lesson_sessions
        WHERE lesson_sessions.id = lesson_turns.session_id
        AND lesson_sessions.user_id = auth.uid()
    ));

-- Create RLS policies for lesson_milestone_progress
CREATE POLICY "Users can view progress from their sessions"
    ON lesson_milestone_progress FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM lesson_sessions
        WHERE lesson_sessions.id = lesson_milestone_progress.session_id
        AND lesson_sessions.user_id = auth.uid()
    ));

CREATE POLICY "Users can update progress in their sessions"
    ON lesson_milestone_progress FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM lesson_sessions
        WHERE lesson_sessions.id = lesson_milestone_progress.session_id
        AND lesson_sessions.user_id = auth.uid()
    ));

CREATE POLICY "Users can modify progress in their sessions"
    ON lesson_milestone_progress FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM lesson_sessions
        WHERE lesson_sessions.id = lesson_milestone_progress.session_id
        AND lesson_sessions.user_id = auth.uid()
    ));

-- Create RLS policies for lesson_media_assets
CREATE POLICY "Users can view media from their sessions"
    ON lesson_media_assets FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM lesson_sessions
        WHERE lesson_sessions.id = lesson_media_assets.session_id
        AND lesson_sessions.user_id = auth.uid()
    ));

CREATE POLICY "Users can create media in their sessions"
    ON lesson_media_assets FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM lesson_sessions
        WHERE lesson_sessions.id = lesson_media_assets.session_id
        AND lesson_sessions.user_id = auth.uid()
    ));

-- Create RLS policies for canvas_snapshots
CREATE POLICY "Users can view snapshots from their sessions"
    ON canvas_snapshots FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM lesson_sessions
        WHERE lesson_sessions.id = canvas_snapshots.session_id
        AND lesson_sessions.user_id = auth.uid()
    ));

CREATE POLICY "Users can create snapshots in their sessions"
    ON canvas_snapshots FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM lesson_sessions
        WHERE lesson_sessions.id = canvas_snapshots.session_id
        AND lesson_sessions.user_id = auth.uid()
    ));

-- Create RLS policies for lesson_articles
CREATE POLICY "Users can view their own articles"
    ON lesson_articles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own articles"
    ON lesson_articles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own articles"
    ON lesson_articles FOR UPDATE
    USING (auth.uid() = user_id);
