/**
 * Lesson Planner API Client
 * 
 * This module provides functions to interact with the Lesson Planner Edge Function.
 * It handles session creation and lesson plan generation.
 */

import { createClient } from '@/lib/supabase/client'
import type { LessonPlan } from '@/lib/types/lesson'

export interface CreateLessonSessionResult {
  sessionId: string
  lessonPlan: LessonPlan
}

export interface LessonPlannerError {
  message: string
  code?: string
  details?: unknown
}

interface LessonPlannerFunctionResponse {
  success: boolean
  lessonPlan?: LessonPlan
}

type LessonSessionInsertRow = {
  topic_prompt: string
  normalized_topic: string | null
  status: 'planning'
  user_id: string
  lesson_plan_json: null
  media_manifest_json: null
  current_milestone_id: null
  summary_json: null
  article_path: null
  article_generated_at: null
  completed_at: null
}

type LessonSessionCreatedRow = {
  id: string
}

type LessonSessionPlanRow = {
  lesson_plan_json: LessonPlan | null
}

type LessonSessionsTable = {
  insert(values: LessonSessionInsertRow): {
    select(): {
      single(): Promise<{
        data: LessonSessionCreatedRow | null
        error: unknown
      }>
    }
  }
  delete(): {
    eq(column: 'id', value: string): Promise<unknown>
  }
  select(columns: 'lesson_plan_json'): {
    eq(column: 'id', value: string): {
      single(): Promise<{
        data: LessonSessionPlanRow | null
        error: unknown
      }>
    }
  }
}

function lessonSessionsTable(supabase: ReturnType<typeof createClient>) {
  return supabase.from('lesson_sessions') as unknown as LessonSessionsTable
}

/**
 * Creates a new lesson session and generates a lesson plan
 * 
 * @param topicPrompt - The topic the learner wants to learn about
 * @returns Session ID and generated lesson plan
 * @throws LessonPlannerError if creation fails
 * 
 * @example
 * ```typescript
 * const { sessionId, lessonPlan } = await createLessonSession('Introduction to fractions')
 * console.log(`Created session ${sessionId} with ${lessonPlan.milestones.length} milestones`)
 * ```
 */
export async function createLessonSession(
  topicPrompt: string
): Promise<CreateLessonSessionResult> {
  const supabase = createClient()
  const lessonSessions = lessonSessionsTable(supabase)

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw {
      message: 'User must be authenticated to create a lesson session',
      code: 'UNAUTHENTICATED'
    } as LessonPlannerError
  }

  // Create session record with status "planning"
  const { data: session, error: sessionError } = await lessonSessions
    .insert({
      topic_prompt: topicPrompt,
      normalized_topic: null,
      status: 'planning',
      user_id: user.id,
      lesson_plan_json: null,
      media_manifest_json: null,
      current_milestone_id: null,
      summary_json: null,
      article_path: null,
      article_generated_at: null,
      completed_at: null,
    })
    .select()
    .single()

  if (sessionError || !session) {
    throw {
      message: 'Failed to create lesson session',
      code: 'SESSION_CREATE_FAILED',
      details: sessionError
    } as LessonPlannerError
  }

  const sessionId = session.id

  try {
    // Call lesson planner Edge Function
    const { data: planResult, error: planError } = await supabase.functions.invoke<LessonPlannerFunctionResponse>(
      'lesson-planner',
      {
        body: {
          sessionId,
          topicPrompt: topicPrompt
        }
      }
    )

    if (planError) {
      throw {
        message: 'Lesson planner function failed',
        code: 'PLANNER_FAILED',
        details: planError
      } as LessonPlannerError
    }

    if (!planResult?.success || !planResult?.lessonPlan) {
      throw {
        message: 'Invalid response from lesson planner',
        code: 'INVALID_RESPONSE',
        details: planResult
      } as LessonPlannerError
    }

    return {
      sessionId,
      lessonPlan: planResult.lessonPlan
    }

  } catch (error) {
    // Clean up session on failure
    await lessonSessions
      .delete()
      .eq('id', sessionId)
      .then(() => console.log('Cleaned up failed session'))

    throw error
  }
}

/**
 * Retrieves an existing lesson plan for a session
 * 
 * @param sessionId - The session ID
 * @returns The lesson plan or null if not found
 * 
 * @example
 * ```typescript
 * const lessonPlan = await getLessonPlan('session-id')
 * if (lessonPlan) {
 *   console.log(`Lesson: ${lessonPlan.topic}`)
 * }
 * ```
 */
export async function getLessonPlan(sessionId: string): Promise<LessonPlan | null> {
  const supabase = createClient()
  const lessonSessions = lessonSessionsTable(supabase)

  const { data: session, error } = await lessonSessions
    .select('lesson_plan_json')
    .eq('id', sessionId)
    .single()

  if (error || !session || !session.lesson_plan_json) {
    return null
  }

  return session.lesson_plan_json
}

/**
 * Checks if a lesson plan has been generated for a session
 * 
 * @param sessionId - The session ID
 * @returns True if lesson plan exists, false otherwise
 */
export async function hasLessonPlan(sessionId: string): Promise<boolean> {
  const plan = await getLessonPlan(sessionId)
  return plan !== null
}
