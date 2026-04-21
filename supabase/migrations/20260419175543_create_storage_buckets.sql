-- Create storage buckets for lesson media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('media-assets', 'media-assets', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']),
    ('canvas-snapshots', 'canvas-snapshots', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('lesson-articles', 'lesson-articles', false, 1048576, ARRAY['text/markdown', 'text/plain'])
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for media-assets bucket (public read, authenticated write)
CREATE POLICY "Public can view media assets"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'media-assets');

CREATE POLICY "Authenticated users can upload media assets"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'media-assets'
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Users can update their own media assets"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'media-assets'
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Users can delete their own media assets"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'media-assets'
        AND auth.role() = 'authenticated'
    );

-- Create storage policies for canvas-snapshots bucket (private, user-owned)
CREATE POLICY "Users can view their own canvas snapshots"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'canvas-snapshots'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can upload their own canvas snapshots"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'canvas-snapshots'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their own canvas snapshots"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'canvas-snapshots'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own canvas snapshots"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'canvas-snapshots'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Create storage policies for lesson-articles bucket (private, user-owned)
CREATE POLICY "Users can view their own lesson articles"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'lesson-articles'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can upload their own lesson articles"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'lesson-articles'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their own lesson articles"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'lesson-articles'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own lesson articles"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'lesson-articles'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
