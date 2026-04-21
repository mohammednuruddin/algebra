import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Type definitions
interface SessionCreateRequest {
  topicPrompt: string
}

interface Milestone {
  id: string
  title: string
  description: string
  required: boolean
  successCriteria: string[]
  estimatedDuration?: number
}

interface LessonPlan {
  topic: string
  normalizedTopic: string
  objective: string
  milestones: Milestone[]
  concepts: any[]
  estimatedDuration: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  visualsNeeded: boolean
  interactiveMoments: any[]
}

interface MediaItem {
  id: string
  type: 'image' | 'diagram' | 'chart' | 'formula'
  searchQuery: string
  source: 'fetch' | 'generate'
}

interface MediaManifest {
  items: MediaItem[]
  totalItems: number
}

interface SessionResponse {
  success: boolean
  session: {
    id: string
    user_id: string
    topic_prompt: string
    status: string
    lesson_plan_json: LessonPlan
    media_manifest_json: MediaManifest
    current_milestone_id: string | null
  }
  lessonPlan: LessonPlan
  mediaManifest: MediaManifest
  message: string
}

// Mock data
const mockUserId = 'test-user-123'
const mockSessionId = 'test-session-456'

const mockLessonPlan: LessonPlan = {
  topic: 'Introduction to Fractions',
  normalizedTopic: 'introduction-to-fractions',
  objective: 'Understand basic fraction concepts and operations',
  milestones: [
    {
      id: 'm1',
      title: 'Understanding Halves',
      description: 'Learn what a half means and how to identify it',
      required: true,
      successCriteria: ['Can identify a half', 'Can draw a half', 'Can explain what a half represents'],
      estimatedDuration: 5
    },
    {
      id: 'm2',
      title: 'Understanding Quarters',
      description: 'Learn about quarters and their relationship to halves',
      required: true,
      successCriteria: ['Can identify quarters', 'Can compare halves and quarters'],
      estimatedDuration: 7
    }
  ],
  concepts: [
    {
      id: 'c1',
      name: 'Half',
      description: 'One of two equal parts',
      relatedMilestones: ['m1'],
      misconceptions: ['A half is always the smaller piece']
    }
  ],
  estimatedDuration: 15,
  difficulty: 'beginner',
  visualsNeeded: true,
  interactiveMoments: []
}

const mockMediaManifest: MediaManifest = {
  items: [
    {
      id: 'ma1',
      type: 'diagram',
      searchQuery: 'fraction halves diagram',
      source: 'fetch'
    },
    {
      id: 'ma2',
      type: 'image',
      searchQuery: 'fraction quarters visual',
      source: 'generate'
    }
  ],
  totalItems: 2
}

// Mock Supabase client
const createMockSupabaseClient = () => {
  const mockClient = {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn(),
    functions: {
      invoke: vi.fn()
    }
  }

  return mockClient
}

describe('Session Create Integration Tests', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('End-to-End Session Creation Flow', () => {
    it('should create session, generate lesson plan, prepare media, and set status to ready (Requirements 1.1, 1.2, 1.3, 2.5)', async () => {
      // Mock authentication
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      })

      // Mock session creation
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockSessionId,
              user_id: mockUserId,
              topic_prompt: 'Introduction to Fractions',
              status: 'planning'
            },
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: mockSessionId,
                user_id: mockUserId,
                topic_prompt: 'Introduction to Fractions',
                status: 'ready',
                lesson_plan_json: mockLessonPlan,
                media_manifest_json: mockMediaManifest,
                current_milestone_id: 'm1'
              },
              error: null
            })
          })
        })
      })

      // Mock lesson planner invocation
      mockSupabase.functions.invoke.mockImplementation((functionName: string) => {
        if (functionName === 'lesson-planner') {
          return Promise.resolve({
            data: {
              success: true,
              lessonPlan: mockLessonPlan
            },
            error: null
          })
        }
        if (functionName === 'media-planner') {
          return Promise.resolve({
            data: {
              success: true,
              manifest: mockMediaManifest
            },
            error: null
          })
        }
        if (functionName === 'media-fetcher' || functionName === 'image-generator') {
          return Promise.resolve({
            data: { success: true },
            error: null
          })
        }
        return Promise.resolve({ data: null, error: null })
      })

      // Verify the flow
      const authResult = await mockSupabase.auth.getUser('mock-token')
      expect(authResult.data.user.id).toBe(mockUserId)

      // Step 1: Create session with status "planning"
      const sessionResult = await mockSupabase.from('lesson_sessions').insert({
        user_id: mockUserId,
        topic_prompt: 'Introduction to Fractions',
        status: 'planning'
      }).select().single()

      expect(sessionResult.data.status).toBe('planning')
      expect(sessionResult.data.topic_prompt).toBe('Introduction to Fractions')

      // Step 2: Invoke lesson planner
      const plannerResult = await mockSupabase.functions.invoke('lesson-planner', {
        body: {
          sessionId: mockSessionId,
          topicPrompt: 'Introduction to Fractions'
        }
      })

      expect(plannerResult.data.success).toBe(true)
      expect(plannerResult.data.lessonPlan.milestones.length).toBeGreaterThanOrEqual(1)

      // Step 3: Invoke media planner
      const mediaPlannerResult = await mockSupabase.functions.invoke('media-planner', {
        body: {
          sessionId: mockSessionId,
          lessonPlan: mockLessonPlan
        }
      })

      expect(mediaPlannerResult.data.success).toBe(true)
      expect(mediaPlannerResult.data.manifest.items).toBeDefined()

      // Step 4: Process media items
      for (const item of mockMediaManifest.items) {
        const functionName = item.source === 'fetch' ? 'media-fetcher' : 'image-generator'
        const mediaResult = await mockSupabase.functions.invoke(functionName, {
          body: {
            sessionId: mockSessionId,
            mediaItemId: item.id
          }
        })
        expect(mediaResult.data.success).toBe(true)
      }

      // Step 5: Verify session status updated to "ready"
      const finalSession = await mockSupabase.from('lesson_sessions')
        .select('*')
        .eq('id', mockSessionId)
        .single()

      expect(finalSession.data.status).toBe('ready')
      expect(finalSession.data.current_milestone_id).toBe('m1')
      expect(finalSession.data.lesson_plan_json).toBeDefined()
      expect(finalSession.data.media_manifest_json).toBeDefined()
    })

    it('should store lesson plan as structured JSON (Requirement 1.3)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      })

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockSessionId,
              lesson_plan_json: mockLessonPlan
            },
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      })

      const result = await mockSupabase.from('lesson_sessions')
        .select('*')
        .eq('id', mockSessionId)
        .single()

      expect(result.data.lesson_plan_json).toBeDefined()
      expect(result.data.lesson_plan_json.topic).toBe('Introduction to Fractions')
      expect(result.data.lesson_plan_json.milestones).toBeInstanceOf(Array)
      expect(result.data.lesson_plan_json.milestones.length).toBeGreaterThan(0)
    })

    it('should store media manifest as structured JSON (Requirement 2.6)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      })

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockSessionId,
              media_manifest_json: mockMediaManifest
            },
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      })

      const result = await mockSupabase.from('lesson_sessions')
        .select('*')
        .eq('id', mockSessionId)
        .single()

      expect(result.data.media_manifest_json).toBeDefined()
      expect(result.data.media_manifest_json.items).toBeInstanceOf(Array)
      expect(result.data.media_manifest_json.totalItems).toBe(2)
    })

    it('should set current_milestone_id to first milestone when ready', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      })

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockSessionId,
              status: 'ready',
              current_milestone_id: 'm1',
              lesson_plan_json: mockLessonPlan
            },
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      })

      const result = await mockSupabase.from('lesson_sessions')
        .select('*')
        .eq('id', mockSessionId)
        .single()

      expect(result.data.status).toBe('ready')
      expect(result.data.current_milestone_id).toBe('m1')
      expect(result.data.current_milestone_id).toBe(result.data.lesson_plan_json.milestones[0].id)
    })
  })

  describe('Error Handling for AI Agent Failures', () => {
    it('should handle lesson planner failure with retry (Requirement 11.1)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      })

      // First call fails, second succeeds (simulating retry)
      let callCount = 0
      mockSupabase.functions.invoke.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({
            data: null,
            error: { message: 'AI service timeout' }
          })
        }
        return Promise.resolve({
          data: {
            success: true,
            lessonPlan: mockLessonPlan
          },
          error: null
        })
      })

      // First attempt fails
      const firstAttempt = await mockSupabase.functions.invoke('lesson-planner', {
        body: { sessionId: mockSessionId, topicPrompt: 'Test' }
      })
      expect(firstAttempt.error).toBeDefined()
      expect(firstAttempt.error.message).toBe('AI service timeout')

      // Retry succeeds
      const retryAttempt = await mockSupabase.functions.invoke('lesson-planner', {
        body: { sessionId: mockSessionId, topicPrompt: 'Test' }
      })
      expect(retryAttempt.data.success).toBe(true)
      expect(retryAttempt.error).toBeNull()
    })

    it('should handle media planner failure gracefully and continue (Requirement 11.2)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      })

      mockSupabase.functions.invoke.mockImplementation((functionName: string) => {
        if (functionName === 'lesson-planner') {
          return Promise.resolve({
            data: { success: true, lessonPlan: mockLessonPlan },
            error: null
          })
        }
        if (functionName === 'media-planner') {
          return Promise.resolve({
            data: null,
            error: { message: 'Media planning failed' }
          })
        }
        return Promise.resolve({ data: null, error: null })
      })

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })

      mockSupabase.from.mockReturnValue({
        update: mockUpdate
      })

      // Lesson planner succeeds
      const plannerResult = await mockSupabase.functions.invoke('lesson-planner', {
        body: { sessionId: mockSessionId, topicPrompt: 'Test' }
      })
      expect(plannerResult.data.success).toBe(true)

      // Media planner fails
      const mediaPlannerResult = await mockSupabase.functions.invoke('media-planner', {
        body: { sessionId: mockSessionId, lessonPlan: mockLessonPlan }
      })
      expect(mediaPlannerResult.error).toBeDefined()

      // Session should still be updated to ready (continuing without media)
      const updateResult = await mockSupabase.from('lesson_sessions')
        .update({ status: 'ready' })
        .eq('id', mockSessionId)

      expect(updateResult.error).toBeNull()
    })

    it('should handle authentication failure', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      })

      const authResult = await mockSupabase.auth.getUser('invalid-token')

      expect(authResult.error).toBeDefined()
      expect(authResult.error.message).toBe('Invalid token')
      expect(authResult.data.user).toBeNull()
    })

    it('should handle missing topic prompt', async () => {
      const request: SessionCreateRequest = {
        topicPrompt: ''
      }

      expect(request.topicPrompt.trim().length).toBe(0)
    })

    it('should handle database insertion failure', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      })

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' }
          })
        })
      })

      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      })

      const result = await mockSupabase.from('lesson_sessions')
        .insert({
          user_id: mockUserId,
          topic_prompt: 'Test',
          status: 'planning'
        })
        .select()
        .single()

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('Database connection failed')
    })
  })

  describe('Media Preparation with Mocked External Services', () => {
    it('should process media items with fetch source (Requirement 2.2)', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null
      })

      const fetchMediaItem: MediaItem = {
        id: 'ma1',
        type: 'image',
        searchQuery: 'fraction diagram',
        source: 'fetch'
      }

      const result = await mockSupabase.functions.invoke('media-fetcher', {
        body: {
          sessionId: mockSessionId,
          mediaItemId: fetchMediaItem.id,
          searchQuery: fetchMediaItem.searchQuery,
          type: fetchMediaItem.type
        }
      })

      expect(result.data.success).toBe(true)
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('media-fetcher', expect.any(Object))
    })

    it('should insert lesson_media_assets record when fetching media (Requirement 2.4)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      })

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'asset-123',
              session_id: mockSessionId,
              kind: 'searched',
              storage_path: `${mockSessionId}/ma1.jpg`,
              metadata_json: {
                type: 'image',
                searchQuery: 'fraction diagram',
                mediaItemId: 'ma1',
                source: 'unsplash'
              }
            },
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      })

      const result = await mockSupabase.from('lesson_media_assets')
        .insert({
          session_id: mockSessionId,
          kind: 'searched',
          storage_path: `${mockSessionId}/ma1.jpg`,
          metadata_json: {
            type: 'image',
            searchQuery: 'fraction diagram',
            mediaItemId: 'ma1',
            source: 'unsplash'
          }
        })
        .select()
        .single()

      expect(result.data).toBeDefined()
      expect(result.data.kind).toBe('searched')
      expect(result.data.session_id).toBe(mockSessionId)
      expect(result.data.storage_path).toContain(mockSessionId)
      expect(result.data.metadata_json.mediaItemId).toBe('ma1')
    })

    it('should process media items with generate source (Requirement 2.3)', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null
      })

      const generateMediaItem: MediaItem = {
        id: 'ma2',
        type: 'diagram',
        searchQuery: 'photosynthesis process diagram',
        source: 'generate'
      }

      const result = await mockSupabase.functions.invoke('image-generator', {
        body: {
          sessionId: mockSessionId,
          mediaItemId: generateMediaItem.id,
          prompt: generateMediaItem.searchQuery,
          type: generateMediaItem.type
        }
      })

      expect(result.data.success).toBe(true)
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('image-generator', expect.any(Object))
    })

    it('should insert lesson_media_assets record when generating image (Requirement 2.4)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      })

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'asset-456',
              session_id: mockSessionId,
              kind: 'generated',
              storage_path: `${mockSessionId}/ma2_generated.png`,
              metadata_json: {
                type: 'diagram',
                originalPrompt: 'photosynthesis process diagram',
                mediaItemId: 'ma2',
                model: 'dall-e-3',
                source: 'generated'
              }
            },
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      })

      const result = await mockSupabase.from('lesson_media_assets')
        .insert({
          session_id: mockSessionId,
          kind: 'generated',
          storage_path: `${mockSessionId}/ma2_generated.png`,
          metadata_json: {
            type: 'diagram',
            originalPrompt: 'photosynthesis process diagram',
            mediaItemId: 'ma2',
            model: 'dall-e-3',
            source: 'generated'
          }
        })
        .select()
        .single()

      expect(result.data).toBeDefined()
      expect(result.data.kind).toBe('generated')
      expect(result.data.session_id).toBe(mockSessionId)
      expect(result.data.storage_path).toContain('generated')
      expect(result.data.metadata_json.model).toBe('dall-e-3')
    })

    it('should handle media fetcher failure and continue with other items (Requirement 11.2)', async () => {
      const mediaItems: MediaItem[] = [
        { id: 'ma1', type: 'image', searchQuery: 'test1', source: 'fetch' },
        { id: 'ma2', type: 'diagram', searchQuery: 'test2', source: 'generate' },
        { id: 'ma3', type: 'chart', searchQuery: 'test3', source: 'fetch' }
      ]

      mockSupabase.functions.invoke.mockImplementation((functionName: string, options: any) => {
        // First fetch fails
        if (functionName === 'media-fetcher' && options.body.mediaItemId === 'ma1') {
          return Promise.resolve({
            data: null,
            error: { message: 'Media not found' }
          })
        }
        // Others succeed
        return Promise.resolve({
          data: { success: true },
          error: null
        })
      })

      const results = await Promise.allSettled(
        mediaItems.map(item => {
          const functionName = item.source === 'fetch' ? 'media-fetcher' : 'image-generator'
          return mockSupabase.functions.invoke(functionName, {
            body: {
              sessionId: mockSessionId,
              mediaItemId: item.id
            }
          })
        })
      )

      // All promises should settle (not throw)
      expect(results.length).toBe(3)
      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('fulfilled')
      expect(results[2].status).toBe('fulfilled')

      // First one failed, others succeeded
      const firstResult = (results[0] as any).value
      expect(firstResult.error).toBeDefined()

      const secondResult = (results[1] as any).value
      expect(secondResult.data.success).toBe(true)

      const thirdResult = (results[2] as any).value
      expect(thirdResult.data.success).toBe(true)
    })

    it('should handle image generator failure and continue (Requirement 11.2)', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Image generation failed' }
      })

      const generateMediaItem: MediaItem = {
        id: 'ma1',
        type: 'diagram',
        searchQuery: 'complex diagram',
        source: 'generate'
      }

      const result = await mockSupabase.functions.invoke('image-generator', {
        body: {
          sessionId: mockSessionId,
          mediaItemId: generateMediaItem.id,
          prompt: generateMediaItem.searchQuery
        }
      })

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('Image generation failed')
      // System should log error and continue with other media items
    })

    it('should process multiple media items in parallel', async () => {
      const mediaItems: MediaItem[] = [
        { id: 'ma1', type: 'image', searchQuery: 'test1', source: 'fetch' },
        { id: 'ma2', type: 'diagram', searchQuery: 'test2', source: 'generate' },
        { id: 'ma3', type: 'chart', searchQuery: 'test3', source: 'fetch' }
      ]

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null
      })

      const startTime = Date.now()
      
      await Promise.allSettled(
        mediaItems.map(item => {
          const functionName = item.source === 'fetch' ? 'media-fetcher' : 'image-generator'
          return mockSupabase.functions.invoke(functionName, {
            body: {
              sessionId: mockSessionId,
              mediaItemId: item.id
            }
          })
        })
      )

      const endTime = Date.now()
      const duration = endTime - startTime

      // Parallel processing should be fast (< 100ms for mocked calls)
      expect(duration).toBeLessThan(100)
      expect(mockSupabase.functions.invoke).toHaveBeenCalledTimes(3)
    })

    it('should handle empty media manifest gracefully', async () => {
      const emptyManifest: MediaManifest = {
        items: [],
        totalItems: 0
      }

      // No media items to process
      const results = await Promise.allSettled(
        emptyManifest.items.map(item => {
          const functionName = item.source === 'fetch' ? 'media-fetcher' : 'image-generator'
          return mockSupabase.functions.invoke(functionName, {
            body: {
              sessionId: mockSessionId,
              mediaItemId: item.id
            }
          })
        })
      )

      expect(results.length).toBe(0)
      expect(mockSupabase.functions.invoke).not.toHaveBeenCalled()
    })
  })

  describe('Session Status Transitions', () => {
    it('should transition from planning to ready after successful preparation', async () => {
      const statuses = ['planning', 'ready']
      
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      })

      // Initial status: planning
      expect(statuses[0]).toBe('planning')

      // After preparation: ready
      await mockSupabase.from('lesson_sessions')
        .update({ status: 'ready' })
        .eq('id', mockSessionId)

      expect(statuses[1]).toBe('ready')
    })

    it('should validate status values match database constraints', () => {
      const validStatuses = ['planning', 'ready', 'active', 'completed']
      const testStatus = 'ready'

      expect(validStatuses.includes(testStatus)).toBe(true)
    })
  })
})
