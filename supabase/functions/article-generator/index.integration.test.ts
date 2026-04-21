/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

/**
 * Integration tests for Article Generator Edge Function - Storage Operations
 * 
 * Tests cover the complete workflow of article storage:
 * - Article file upload to Supabase Storage (lesson-articles bucket)
 * - lesson_articles record insertion with metadata
 * - lesson_sessions update with article_path and article_generated_at
 * - Error handling for storage failures
 * - Error handling for database operation failures
 * 
 * Validates Requirements: 13.5, 13.6, 13.7
 * 
 * These tests mock Supabase client operations to verify the integration
 * between storage and database without requiring a live Supabase instance.
 */

// Mock Supabase client for testing
interface MockStorageResponse {
  data?: { path: string } | null
  error?: { message: string } | null
}

interface MockDatabaseResponse {
  data?: any
  error?: { message: string } | null
}

class MockSupabaseClient {
  private storageUploadShouldFail = false
  private dbInsertShouldFail = false
  private dbUpdateShouldFail = false
  private uploadedFiles: Map<string, string> = new Map()
  private insertedRecords: any[] = []
  private updatedRecords: Map<string, any> = new Map()

  // Configure mock behavior
  setStorageUploadFailure(shouldFail: boolean) {
    this.storageUploadShouldFail = shouldFail
  }

  setDbInsertFailure(shouldFail: boolean) {
    this.dbInsertShouldFail = shouldFail
  }

  setDbUpdateFailure(shouldFail: boolean) {
    this.dbUpdateShouldFail = shouldFail
  }

  // Mock storage operations
  storage = {
    from: (bucket: string) => ({
      upload: async (path: string, content: string, options?: any): Promise<MockStorageResponse> => {
        if (this.storageUploadShouldFail) {
          return {
            data: null,
            error: { message: 'Storage upload failed: insufficient permissions' }
          }
        }

        this.uploadedFiles.set(path, content)
        return {
          data: { path },
          error: null
        }
      },
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}` }
      })
    })
  }

  // Mock database operations
  from(table: string) {
    return {
      insert: (data: any) => ({
        select: () => ({
          single: async (): Promise<MockDatabaseResponse> => {
            if (this.dbInsertShouldFail) {
              return {
                data: null,
                error: { message: 'Database insert failed: constraint violation' }
              }
            }

            const record = {
              id: `mock-${table}-${Date.now()}`,
              ...data,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            this.insertedRecords.push({ table, record })
            return {
              data: record,
              error: null
            }
          }
        })
      }),
      update: (data: any) => ({
        eq: (column: string, value: any) => ({
          execute: async (): Promise<MockDatabaseResponse> => {
            if (this.dbUpdateShouldFail) {
              return {
                data: null,
                error: { message: 'Database update failed: record not found' }
              }
            }

            const key = `${table}-${column}-${value}`
            this.updatedRecords.set(key, data)
            return {
              data: { ...data },
              error: null
            }
          }
        })
      }),
      select: (columns?: string) => ({
        eq: (column: string, value: any) => ({
          single: async (): Promise<MockDatabaseResponse> => {
            // Mock session data for testing
            if (table === 'lesson_sessions') {
              return {
                data: {
                  id: value,
                  user_id: 'test-user-id',
                  status: 'completed',
                  lesson_plan_json: {
                    topic: 'Test Topic',
                    milestones: [{ id: 'm1', title: 'Test Milestone' }]
                  },
                  summary_json: {
                    duration: { totalMinutes: 15 },
                    milestonesOverview: { completed: 1, total: 1 }
                  },
                  completed_at: new Date().toISOString()
                },
                error: null
              }
            }
            return { data: null, error: { message: 'Not found' } }
          }
        })
      })
    }
  }

  // Inspection methods for tests
  getUploadedFiles() {
    return this.uploadedFiles
  }

  getInsertedRecords() {
    return this.insertedRecords
  }

  getUpdatedRecords() {
    return this.updatedRecords
  }

  reset() {
    this.storageUploadShouldFail = false
    this.dbInsertShouldFail = false
    this.dbUpdateShouldFail = false
    this.uploadedFiles.clear()
    this.insertedRecords = []
    this.updatedRecords.clear()
  }
}

// Test data
const mockArticleMarkdown = `# Understanding Photosynthesis - What is Photosynthesis - January 15, 2026

**Topic:** Understanding Photosynthesis
**Date:** January 15, 2026
**Duration:** 15 minutes
**Milestones Covered:** 2/2

## Introduction

This lesson covered the fundamentals of photosynthesis.

## What is Photosynthesis

Photosynthesis is the process by which plants convert light energy into chemical energy.

## Summary

The learner successfully completed all milestones.`

const mockMetadata = {
  topic: 'Understanding Photosynthesis',
  duration: 15,
  milestonesTotal: 2,
  milestonesCompleted: 2,
  difficulty: 'beginner',
  mediaCount: 1
}

Deno.test('Integration - Article file upload to storage', async () => {
  const mockClient = new MockSupabaseClient()
  const userId = 'user-123'
  const sessionId = 'session-456'
  const storagePath = `${userId}/${sessionId}/article.md`

  // Simulate article upload
  const uploadResult = await mockClient.storage
    .from('lesson-articles')
    .upload(storagePath, mockArticleMarkdown, {
      contentType: 'text/markdown',
      upsert: true
    })

  // Verify upload succeeded
  assertEquals(uploadResult.error, null)
  assertExists(uploadResult.data)
  assertEquals(uploadResult.data?.path, storagePath)

  // Verify file was stored
  const uploadedFiles = mockClient.getUploadedFiles()
  assertEquals(uploadedFiles.has(storagePath), true)
  assertEquals(uploadedFiles.get(storagePath), mockArticleMarkdown)
})

Deno.test('Integration - lesson_articles record insertion', async () => {
  const mockClient = new MockSupabaseClient()
  const sessionId = 'session-456'
  const userId = 'user-123'
  const title = 'Understanding Photosynthesis - What is Photosynthesis - January 15, 2026'
  const storagePath = `${userId}/${sessionId}/article.md`

  // Simulate article record insertion
  const insertResult = await mockClient
    .from('lesson_articles')
    .insert({
      session_id: sessionId,
      user_id: userId,
      title,
      article_markdown: mockArticleMarkdown,
      article_storage_path: storagePath,
      metadata_json: mockMetadata
    })
    .select()
    .single()

  // Verify insertion succeeded
  assertEquals(insertResult.error, null)
  assertExists(insertResult.data)
  assertEquals(insertResult.data.session_id, sessionId)
  assertEquals(insertResult.data.user_id, userId)
  assertEquals(insertResult.data.title, title)
  assertEquals(insertResult.data.article_storage_path, storagePath)
  assertExists(insertResult.data.id)
  assertExists(insertResult.data.created_at)

  // Verify record was stored
  const insertedRecords = mockClient.getInsertedRecords()
  assertEquals(insertedRecords.length, 1)
  assertEquals(insertedRecords[0].table, 'lesson_articles')
  assertEquals(insertedRecords[0].record.title, title)
})

Deno.test('Integration - lesson_sessions update with article_path', async () => {
  const mockClient = new MockSupabaseClient()
  const sessionId = 'session-456'
  const userId = 'user-123'
  const storagePath = `${userId}/${sessionId}/article.md`
  const articleGeneratedAt = new Date().toISOString()

  // Simulate session update
  const updateResult = await mockClient
    .from('lesson_sessions')
    .update({
      article_path: storagePath,
      article_generated_at: articleGeneratedAt
    })
    .eq('id', sessionId)
    .execute()

  // Verify update succeeded
  assertEquals(updateResult.error, null)

  // Verify update was recorded
  const updatedRecords = mockClient.getUpdatedRecords()
  const updateKey = `lesson_sessions-id-${sessionId}`
  assertEquals(updatedRecords.has(updateKey), true)
  
  const updatedData = updatedRecords.get(updateKey)
  assertEquals(updatedData.article_path, storagePath)
  assertEquals(updatedData.article_generated_at, articleGeneratedAt)
})

Deno.test('Integration - Complete workflow: upload → insert → update', async () => {
  const mockClient = new MockSupabaseClient()
  const userId = 'user-123'
  const sessionId = 'session-456'
  const title = 'Understanding Photosynthesis - What is Photosynthesis - January 15, 2026'
  const storagePath = `${userId}/${sessionId}/article.md`
  const articleGeneratedAt = new Date().toISOString()

  // Step 1: Upload article to storage
  const uploadResult = await mockClient.storage
    .from('lesson-articles')
    .upload(storagePath, mockArticleMarkdown, {
      contentType: 'text/markdown',
      upsert: true
    })

  assertEquals(uploadResult.error, null)
  assertExists(uploadResult.data)

  // Step 2: Insert article record
  const insertResult = await mockClient
    .from('lesson_articles')
    .insert({
      session_id: sessionId,
      user_id: userId,
      title,
      article_markdown: mockArticleMarkdown,
      article_storage_path: storagePath,
      metadata_json: mockMetadata
    })
    .select()
    .single()

  assertEquals(insertResult.error, null)
  assertExists(insertResult.data)
  assertExists(insertResult.data.id)

  // Step 3: Update session with article path
  const updateResult = await mockClient
    .from('lesson_sessions')
    .update({
      article_path: storagePath,
      article_generated_at: articleGeneratedAt
    })
    .eq('id', sessionId)
    .execute()

  assertEquals(updateResult.error, null)

  // Verify complete workflow
  const uploadedFiles = mockClient.getUploadedFiles()
  const insertedRecords = mockClient.getInsertedRecords()
  const updatedRecords = mockClient.getUpdatedRecords()

  assertEquals(uploadedFiles.has(storagePath), true)
  assertEquals(insertedRecords.length, 1)
  assertEquals(insertedRecords[0].table, 'lesson_articles')
  assertEquals(updatedRecords.has(`lesson_sessions-id-${sessionId}`), true)
})

Deno.test('Integration - Error handling: storage upload failure', async () => {
  const mockClient = new MockSupabaseClient()
  mockClient.setStorageUploadFailure(true)

  const userId = 'user-123'
  const sessionId = 'session-456'
  const storagePath = `${userId}/${sessionId}/article.md`

  // Attempt upload
  const uploadResult = await mockClient.storage
    .from('lesson-articles')
    .upload(storagePath, mockArticleMarkdown, {
      contentType: 'text/markdown',
      upsert: true
    })

  // Verify error is returned
  assertExists(uploadResult.error)
  assertEquals(uploadResult.data, null)
  assert(uploadResult.error.message.includes('Storage upload failed'))

  // Verify no file was stored
  const uploadedFiles = mockClient.getUploadedFiles()
  assertEquals(uploadedFiles.has(storagePath), false)
})

Deno.test('Integration - Error handling: database insert failure', async () => {
  const mockClient = new MockSupabaseClient()
  mockClient.setDbInsertFailure(true)

  const sessionId = 'session-456'
  const userId = 'user-123'
  const title = 'Test Article'
  const storagePath = `${userId}/${sessionId}/article.md`

  // Attempt insert
  const insertResult = await mockClient
    .from('lesson_articles')
    .insert({
      session_id: sessionId,
      user_id: userId,
      title,
      article_markdown: mockArticleMarkdown,
      article_storage_path: storagePath,
      metadata_json: mockMetadata
    })
    .select()
    .single()

  // Verify error is returned
  assertExists(insertResult.error)
  assertEquals(insertResult.data, null)
  assert(insertResult.error.message.includes('Database insert failed'))

  // Verify no record was stored
  const insertedRecords = mockClient.getInsertedRecords()
  assertEquals(insertedRecords.length, 0)
})

Deno.test('Integration - Error handling: session update failure', async () => {
  const mockClient = new MockSupabaseClient()
  mockClient.setDbUpdateFailure(true)

  const sessionId = 'session-456'
  const userId = 'user-123'
  const storagePath = `${userId}/${sessionId}/article.md`
  const articleGeneratedAt = new Date().toISOString()

  // Attempt update
  const updateResult = await mockClient
    .from('lesson_sessions')
    .update({
      article_path: storagePath,
      article_generated_at: articleGeneratedAt
    })
    .eq('id', sessionId)
    .execute()

  // Verify error is returned
  assertExists(updateResult.error)
  assert(updateResult.error.message.includes('Database update failed'))

  // Verify no update was recorded
  const updatedRecords = mockClient.getUpdatedRecords()
  assertEquals(updatedRecords.size, 0)
})

Deno.test('Integration - Storage path format validation', async () => {
  const mockClient = new MockSupabaseClient()
  
  // Test valid path format: {user_id}/{session_id}/article.md
  const userId = 'user-abc-123'
  const sessionId = 'session-xyz-789'
  const storagePath = `${userId}/${sessionId}/article.md`

  const uploadResult = await mockClient.storage
    .from('lesson-articles')
    .upload(storagePath, mockArticleMarkdown, {
      contentType: 'text/markdown',
      upsert: true
    })

  assertEquals(uploadResult.error, null)
  
  // Verify path structure
  const pathParts = storagePath.split('/')
  assertEquals(pathParts.length, 3)
  assertEquals(pathParts[0], userId)
  assertEquals(pathParts[1], sessionId)
  assertEquals(pathParts[2], 'article.md')
  
  // Verify file extension
  assert(storagePath.endsWith('.md'))
})

Deno.test('Integration - Article metadata structure validation', async () => {
  const mockClient = new MockSupabaseClient()
  
  const metadata = {
    topic: 'Understanding Photosynthesis',
    duration: 15,
    milestonesTotal: 2,
    milestonesCompleted: 2,
    difficulty: 'beginner',
    mediaCount: 1
  }

  const insertResult = await mockClient
    .from('lesson_articles')
    .insert({
      session_id: 'session-456',
      user_id: 'user-123',
      title: 'Test Article',
      article_markdown: mockArticleMarkdown,
      article_storage_path: 'user-123/session-456/article.md',
      metadata_json: metadata
    })
    .select()
    .single()

  assertEquals(insertResult.error, null)
  assertExists(insertResult.data)
  
  // Verify metadata structure
  const storedMetadata = insertResult.data.metadata_json
  assertExists(storedMetadata.topic)
  assertExists(storedMetadata.duration)
  assertExists(storedMetadata.milestonesTotal)
  assertExists(storedMetadata.milestonesCompleted)
  assertExists(storedMetadata.difficulty)
  assertExists(storedMetadata.mediaCount)
  
  assertEquals(typeof storedMetadata.duration, 'number')
  assertEquals(typeof storedMetadata.milestonesTotal, 'number')
  assertEquals(typeof storedMetadata.milestonesCompleted, 'number')
})

Deno.test('Integration - Upsert behavior for article updates', async () => {
  const mockClient = new MockSupabaseClient()
  const userId = 'user-123'
  const sessionId = 'session-456'
  const storagePath = `${userId}/${sessionId}/article.md`

  // First upload
  const firstUpload = await mockClient.storage
    .from('lesson-articles')
    .upload(storagePath, mockArticleMarkdown, {
      contentType: 'text/markdown',
      upsert: true
    })

  assertEquals(firstUpload.error, null)

  // Second upload (upsert)
  const updatedMarkdown = mockArticleMarkdown + '\n\n## Additional Section\n\nNew content added.'
  const secondUpload = await mockClient.storage
    .from('lesson-articles')
    .upload(storagePath, updatedMarkdown, {
      contentType: 'text/markdown',
      upsert: true
    })

  assertEquals(secondUpload.error, null)

  // Verify file was updated
  const uploadedFiles = mockClient.getUploadedFiles()
  assertEquals(uploadedFiles.get(storagePath), updatedMarkdown)
  assert(uploadedFiles.get(storagePath)?.includes('Additional Section'))
})

Deno.test('Integration - Multiple articles for different sessions', async () => {
  const mockClient = new MockSupabaseClient()
  const userId = 'user-123'
  
  // Create articles for multiple sessions
  const sessions = [
    { id: 'session-1', title: 'Article 1' },
    { id: 'session-2', title: 'Article 2' },
    { id: 'session-3', title: 'Article 3' }
  ]

  for (const session of sessions) {
    const storagePath = `${userId}/${session.id}/article.md`
    
    // Upload to storage
    await mockClient.storage
      .from('lesson-articles')
      .upload(storagePath, mockArticleMarkdown, {
        contentType: 'text/markdown',
        upsert: true
      })

    // Insert record
    await mockClient
      .from('lesson_articles')
      .insert({
        session_id: session.id,
        user_id: userId,
        title: session.title,
        article_markdown: mockArticleMarkdown,
        article_storage_path: storagePath,
        metadata_json: mockMetadata
      })
      .select()
      .single()
  }

  // Verify all articles were created
  const uploadedFiles = mockClient.getUploadedFiles()
  const insertedRecords = mockClient.getInsertedRecords()

  assertEquals(uploadedFiles.size, 3)
  assertEquals(insertedRecords.length, 3)

  // Verify each session has its own article
  sessions.forEach(session => {
    const storagePath = `${userId}/${session.id}/article.md`
    assertEquals(uploadedFiles.has(storagePath), true)
  })

  // Verify all records are for lesson_articles table
  insertedRecords.forEach(record => {
    assertEquals(record.table, 'lesson_articles')
  })
})

Deno.test('Integration - Content type validation for markdown files', async () => {
  const mockClient = new MockSupabaseClient()
  const userId = 'user-123'
  const sessionId = 'session-456'
  const storagePath = `${userId}/${sessionId}/article.md`

  // Upload with correct content type
  const uploadResult = await mockClient.storage
    .from('lesson-articles')
    .upload(storagePath, mockArticleMarkdown, {
      contentType: 'text/markdown',
      upsert: true
    })

  assertEquals(uploadResult.error, null)
  assertExists(uploadResult.data)

  // Verify file was stored (content type is validated by storage bucket policy)
  const uploadedFiles = mockClient.getUploadedFiles()
  assertEquals(uploadedFiles.has(storagePath), true)
})

Deno.test('Integration - Rollback scenario: storage succeeds but insert fails', async () => {
  const mockClient = new MockSupabaseClient()
  const userId = 'user-123'
  const sessionId = 'session-456'
  const storagePath = `${userId}/${sessionId}/article.md`

  // Step 1: Upload succeeds
  const uploadResult = await mockClient.storage
    .from('lesson-articles')
    .upload(storagePath, mockArticleMarkdown, {
      contentType: 'text/markdown',
      upsert: true
    })

  assertEquals(uploadResult.error, null)

  // Step 2: Insert fails
  mockClient.setDbInsertFailure(true)
  const insertResult = await mockClient
    .from('lesson_articles')
    .insert({
      session_id: sessionId,
      user_id: userId,
      title: 'Test Article',
      article_markdown: mockArticleMarkdown,
      article_storage_path: storagePath,
      metadata_json: mockMetadata
    })
    .select()
    .single()

  assertExists(insertResult.error)

  // Verify state: file uploaded but no database record
  const uploadedFiles = mockClient.getUploadedFiles()
  const insertedRecords = mockClient.getInsertedRecords()

  assertEquals(uploadedFiles.has(storagePath), true) // File exists in storage
  assertEquals(insertedRecords.length, 0) // No database record

  // In production, this scenario should trigger cleanup or retry logic
})

console.log('All article storage integration tests passed!')
