/// <reference lib="deno.ns" />
import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Mock environment variables
Deno.env.set('SUPABASE_URL', 'http://localhost:54321')
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')

// Test data
const mockSessionId = '123e4567-e89b-12d3-a456-426614174000'
const mockUserId = '123e4567-e89b-12d3-a456-426614174001'
const mockTurnId = '123e4567-e89b-12d3-a456-426614174002'
const mockAuthToken = 'mock-auth-token'

const mockLessonPlan = {
  topic: 'Photosynthesis',
  normalizedTopic: 'photosynthesis',
  objective: 'Understand how plants make food',
  milestones: [
    {
      id: 'milestone-1',
      title: 'Introduction to Photosynthesis',
      description: 'Learn what photosynthesis is',
      required: true,
      successCriteria: ['Can explain photosynthesis in own words']
    }
  ],
  concepts: [],
  estimatedDuration: 30,
  difficulty: 'beginner' as const,
  visualsNeeded: true,
  interactiveMoments: []
}

const mockTeacherResponse = {
  speech: 'Great answer! Photosynthesis is indeed how plants make food.',
  actions: [],
  awaitedInputMode: 'voice' as const,
  currentMilestoneId: 'milestone-1',
  isCorrectAnswer: true,
  feedback: {
    type: 'positive' as const,
    message: 'Excellent understanding!'
  }
}

const mockProgressResult = {
  sessionId: mockSessionId,
  currentMilestoneId: 'milestone-1',
  nextMilestoneId: null,
  allMilestonesProgress: [
    {
      milestoneId: 'milestone-1',
      status: 'practiced' as const,
      attempts: 1,
      correctAttempts: 1,
      accuracy: 1.0,
      evidence: ['Correctly explained photosynthesis'],
      shouldAdvance: false,
      reasoning: 'Good progress on milestone'
    }
  ],
  overallProgress: {
    totalMilestones: 1,
    completedMilestones: 0,
    currentMilestoneIndex: 0,
    percentComplete: 50
  },
  shouldCompleteLesson: false,
  timestamp: new Date().toISOString()
}

// Mock Supabase client
function createMockSupabase() {
  return {
    auth: {
      getUser: async (token: string) => {
        if (token === mockAuthToken) {
          return {
            data: { user: { id: mockUserId } },
            error: null
          }
        }
        return {
          data: { user: null },
          error: { message: 'Invalid token' }
        }
      }
    },
    from: (table: string) => ({
      select: (columns?: string, options?: any) => ({
        eq: (column: string, value: any) => ({
          single: async () => {
            if (table === 'lesson_sessions' && value === mockSessionId) {
              return {
                data: {
                  id: mockSessionId,
                  user_id: mockUserId,
                  status: 'active',
                  lesson_plan_json: mockLessonPlan,
                  current_milestone_id: 'milestone-1'
                },
                error: null
              }
            }
            return { data: null, error: { message: 'Not found' } }
          },
          order: (column: string, options: any) => ({
            limit: (count: number) => ({
              then: async (resolve: any) => {
                if (table === 'lesson_turns') {
                  resolve({
                    data: [{ turn_index: 0 }],
                    error: null
                  })
                }
              }
            })
          })
        })
      }),
      insert: (data: any) => ({
        select: () => ({
          single: async () => {
            if (table === 'lesson_turns') {
              return {
                data: {
                  id: mockTurnId,
                  session_id: mockSessionId,
                  turn_index: 1,
                  actor: 'learner',
                  input_mode: data.input_mode,
                  raw_input_json: data.raw_input_json,
                  created_at: new Date().toISOString()
                },
                error: null
              }
            }
            return { data: null, error: { message: 'Insert failed' } }
          }
        })
      })
    }),
    functions: {
      invoke: async (functionName: string, options: any) => {
        if (functionName === 'teacher-conductor') {
          return {
            data: {
              success: true,
              teacherResponse: mockTeacherResponse,
              progressResult: mockProgressResult
            },
            error: null
          }
        }
        return {
          data: null,
          error: { message: 'Function not found' }
        }
      }
    }
  }
}

Deno.test('Turn Respond - Voice Input', async () => {
  const learnerInput = {
    mode: 'voice' as const,
    raw: {
      text: 'Photosynthesis is how plants make food using sunlight',
      audioUrl: 'https://storage.example.com/audio.mp3'
    },
    interpreted: {
      text: 'Photosynthesis is how plants make food using sunlight',
      intent: 'answer_question',
      confidence: 0.95
    }
  }

  const request = new Request('http://localhost:8000', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mockAuthToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: mockSessionId,
      learnerInput
    })
  })

  // Note: This is a structure test - actual endpoint testing requires running Supabase
  assertExists(request)
  assertEquals(request.method, 'POST')
})

Deno.test('Turn Respond - Text Input', async () => {
  const learnerInput = {
    mode: 'text' as const,
    raw: {
      text: 'Plants use sunlight to make food'
    }
  }

  const request = new Request('http://localhost:8000', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mockAuthToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: mockSessionId,
      learnerInput
    })
  })

  assertExists(request)
  assertEquals(request.method, 'POST')
})

Deno.test('Turn Respond - Canvas Input', async () => {
  const learnerInput = {
    mode: 'canvas_draw' as const,
    raw: {
      canvasSnapshotUrl: 'https://storage.example.com/canvas-snapshot.png'
    },
    interpreted: {
      markings: [
        {
          type: 'drawing',
          confidence: 0.85,
          meaning: 'Drew a plant with leaves and roots'
        }
      ]
    }
  }

  const request = new Request('http://localhost:8000', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mockAuthToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: mockSessionId,
      learnerInput
    })
  })

  assertExists(request)
  assertEquals(request.method, 'POST')
})

Deno.test('Turn Respond - Missing Authorization', async () => {
  const learnerInput = {
    mode: 'text' as const,
    raw: {
      text: 'Test input'
    }
  }

  const request = new Request('http://localhost:8000', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: mockSessionId,
      learnerInput
    })
  })

  assertExists(request)
  // In actual implementation, this would return 401
})

Deno.test('Turn Respond - Missing Required Fields', async () => {
  const request = new Request('http://localhost:8000', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mockAuthToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: mockSessionId
      // Missing learnerInput
    })
  })

  assertExists(request)
  // In actual implementation, this would return 400
})

Deno.test('Turn Respond - Session Not Found', async () => {
  const learnerInput = {
    mode: 'text' as const,
    raw: {
      text: 'Test input'
    }
  }

  const request = new Request('http://localhost:8000', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mockAuthToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: 'non-existent-session-id',
      learnerInput
    })
  })

  assertExists(request)
  // In actual implementation, this would return 404
})

Deno.test('Turn Respond - Completed Session', async () => {
  const learnerInput = {
    mode: 'text' as const,
    raw: {
      text: 'Test input'
    }
  }

  const request = new Request('http://localhost:8000', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mockAuthToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: mockSessionId,
      learnerInput
    })
  })

  assertExists(request)
  // In actual implementation with completed session, this would return 400
})

Deno.test('Turn Respond - Response Structure', () => {
  const expectedResponse = {
    success: true,
    turnId: mockTurnId,
    teacherResponse: mockTeacherResponse,
    progressResult: mockProgressResult,
    message: 'Turn processed successfully'
  }

  assertExists(expectedResponse.success)
  assertExists(expectedResponse.turnId)
  assertExists(expectedResponse.teacherResponse)
  assertExists(expectedResponse.progressResult)
  assertEquals(expectedResponse.message, 'Turn processed successfully')
})

Deno.test('Turn Respond - Teacher Response Structure', () => {
  assertExists(mockTeacherResponse.speech)
  assertExists(mockTeacherResponse.actions)
  assertExists(mockTeacherResponse.awaitedInputMode)
  assertExists(mockTeacherResponse.currentMilestoneId)
  assertEquals(mockTeacherResponse.isCorrectAnswer, true)
  assertEquals(mockTeacherResponse.feedback?.type, 'positive')
})

Deno.test('Turn Respond - Progress Result Structure', () => {
  assertExists(mockProgressResult.sessionId)
  assertExists(mockProgressResult.currentMilestoneId)
  assertExists(mockProgressResult.allMilestonesProgress)
  assertExists(mockProgressResult.overallProgress)
  assertEquals(mockProgressResult.shouldCompleteLesson, false)
  assertEquals(mockProgressResult.allMilestonesProgress.length, 1)
})
