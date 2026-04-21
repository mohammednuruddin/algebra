# Lesson Articles Storage Bucket - Task 29.3 Verification

## Summary

The `lesson-articles` storage bucket has been successfully created in the migration file `20260419175543_create_storage_buckets.sql`.

## Bucket Configuration

**Bucket Name:** `lesson-articles`

**Settings:**
- **Public Access:** `false` (private bucket)
- **File Size Limit:** 1,048,576 bytes (1 MB)
- **Allowed MIME Types:** 
  - `text/markdown`
  - `text/plain`

## Path Structure

Articles are stored using the following path structure:
```
{user_id}/{session_id}/article.md
```

Example:
```
550e8400-e29b-41d4-a716-446655440000/7c9e6679-7425-40de-944b-e07fc1f90ae7/article.md
```

## Access Policies

The following Row Level Security (RLS) policies have been configured:

### 1. SELECT Policy - "Users can view their own lesson articles"
- Users can only view articles in folders matching their user ID
- Policy: `auth.uid()::text = (storage.foldername(name))[1]`

### 2. INSERT Policy - "Users can upload their own lesson articles"
- Users can only upload articles to folders matching their user ID
- Policy: `auth.uid()::text = (storage.foldername(name))[1]`

### 3. UPDATE Policy - "Users can update their own lesson articles"
- Users can only update articles in folders matching their user ID
- Policy: `auth.uid()::text = (storage.foldername(name))[1]`

### 4. DELETE Policy - "Users can delete their own lesson articles"
- Users can only delete articles in folders matching their user ID
- Policy: `auth.uid()::text = (storage.foldername(name))[1]`

## Security Features

1. **User Isolation:** Each user can only access their own articles through the path-based security model
2. **Private Bucket:** Articles are not publicly accessible
3. **Authenticated Access Only:** All operations require authentication
4. **Path-Based Authorization:** The first folder in the path must match the authenticated user's ID

## Migration Status

The bucket creation is part of migration `20260419175543_create_storage_buckets.sql`, which also creates:
- `media-assets` bucket (public, for lesson images and diagrams)
- `canvas-snapshots` bucket (private, for learner drawings)

## Next Steps

To apply this migration to your Supabase instance:

1. **Local Development:**
   ```bash
   supabase start
   supabase db reset  # If needed to reapply migrations
   ```

2. **Production:**
   ```bash
   supabase db push
   ```

## Verification

To verify the bucket exists and policies are active:

```sql
-- Check bucket exists
SELECT * FROM storage.buckets WHERE id = 'lesson-articles';

-- Check policies
SELECT * FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%lesson articles%';
```

## Requirements Satisfied

✅ **Requirement 13.5:** Backend SHALL store markdown file in Supabase Storage at path `{user_id}/{session_id}/article.md`

The storage bucket is configured to support this exact path structure with appropriate security policies ensuring users can only access their own articles.
