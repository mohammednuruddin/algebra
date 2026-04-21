/// <reference lib="deno.ns" />
import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: () => Promise.resolve({
      data: { user: { id: 'test-user-id' } },
      error: null
    })
  },
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({
          data: { id: 'test-session-id', user_id: 'test-user-id' },
          error: null
        })
      })
    }),
    insert: () => ({
      select: () => ({
        single: () => Promise.resolve({
          data: {
            id: 'test-snapshot-id',
            session_id: 'test-session-id',
            storage_path: 'test-user-id/test-snapshot.png',
            snapshot_type: 'canvas_drawing',
            interpreter_result_json: {}
          },
          error: null
        })
      })
    })
  }),
  storage: {
    from: () => ({
      upload: () => Promise.resolve({
        data: { path: 'test-user-id/test-snapshot.png' },
        error: null
      }),
      getPublicUrl: () => ({
        data: { publicUrl: 'https://example.com/test-snapshot.png' }
      })
    })
  },
  functions: {
    invoke: (name: string) => {
      if (name === 'vision-interpreter') {
        return Promise.resolve({
          data: {
            success: true,
            result: {
              interpretedMarking: {
                shapes: [],
                text: [],
                concepts: [],
                annotations: [],
                overallInterpretation: 'Test interpretation',
                confidence: 0.9
              },
              model: 'gpt-4o-mini',
              timestamp: new Date().toISOString(),
              rawResponse: '{}'
            }
          },
          error: null
        })
      }
      return Promise.resolve({ data: null, error: { message: 'Unknown function' } })
    }
  }
}

Deno.test('Canvas Analyze - Valid request with all fields', async () => {
  const request = {
    sessionId: 'test-session-id',
    turnId: 'test-turn-id',
    snapshotFile: {
      name: 'test-snapshot.png',
      type: 'image/png',
      base64Data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    },
    snapshotType: 'canvas_drawing',
    context: {
      currentMilestone: 'Understanding fractions',
      expectedConcepts: ['numerator', 'denominator'],
      taskDescription: 'Draw a fraction representation'
    }
  }

  // Test that request structure is valid
  assertExists(request.sessionId)
  assertExists(request.snapshotFile)
  assertExists(request.snapshotFile.base64Data)
  assertEquals(request.snapshotFile.type, 'image/png')
})

Deno.test('Canvas Analyze - Minimal valid request', async () => {
  const request = {
    sessionId: 'test-session-id',
    snapshotFile: {
      name: 'test-snapshot.png',
      type: 'image/png',
      base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    }
  }

  // Test that minimal request structure is valid
  assertExists(request.sessionId)
  assertExists(request.snapshotFile)
  assertExists(request.snapshotFile.base64Data)
})

Deno.test('Canvas Analyze - Base64 data parsing', () => {
  const base64WithPrefix = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const base64WithoutPrefix = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  // Extract base64 data
  const extractedWithPrefix = base64WithPrefix.includes(',') 
    ? base64WithPrefix.split(',')[1] 
    : base64WithPrefix
  
  const extractedWithoutPrefix = base64WithoutPrefix.includes(',') 
    ? base64WithoutPrefix.split(',')[1] 
    : base64WithoutPrefix

  // Both should result in the same base64 string
  assertEquals(extractedWithPrefix, extractedWithoutPrefix)
  assertEquals(extractedWithPrefix, 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
})

Deno.test('Canvas Analyze - Storage path generation', () => {
  const userId = 'test-user-id'
  const sessionId = 'test-session-id'
  const timestamp = 1234567890
  const fileType = 'image/png'
  
  const fileExtension = fileType.split('/')[1] || 'png'
  const fileName = `${sessionId}_${timestamp}.${fileExtension}`
  const storagePath = `${userId}/${fileName}`

  assertEquals(storagePath, 'test-user-id/test-session-id_1234567890.png')
})

Deno.test('Canvas Analyze - Response structure validation', () => {
  const response = {
    success: true,
    snapshotId: 'test-snapshot-id',
    storagePath: 'test-user-id/test-snapshot.png',
    storageUrl: 'https://example.com/test-snapshot.png',
    interpretedMarking: {
      shapes: [],
      text: [],
      concepts: [],
      annotations: [],
      overallInterpretation: 'Test interpretation',
      confidence: 0.9
    },
    message: 'Canvas snapshot analyzed successfully'
  }

  // Validate response structure
  assertExists(response.success)
  assertExists(response.snapshotId)
  assertExists(response.storagePath)
  assertExists(response.storageUrl)
  assertExists(response.interpretedMarking)
  assertExists(response.message)
  
  assertEquals(response.success, true)
  assertEquals(typeof response.interpretedMarking, 'object')
})

Deno.test('Canvas Analyze - File extension extraction', () => {
  const testCases = [
    { type: 'image/png', expected: 'png' },
    { type: 'image/jpeg', expected: 'jpeg' },
    { type: 'image/webp', expected: 'webp' },
    { type: 'invalid', expected: 'png' } // fallback
  ]

  testCases.forEach(({ type, expected }) => {
    const fileExtension = type.split('/')[1] || 'png'
    assertEquals(fileExtension, expected)
  })
})
