/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TeacherConductorRequest {
  sessionId: string
  turnId: string
  learnerInput: {
    mode: 'voice' | 'text' | 'canvas_draw' | 'canvas_mark' | 'image_annotation' | 'selection' | 'mixed'
    raw: {
      text?: string
      audioUrl?: string
      canvasSnapshotUrl?: string
      imageAnnotationUrl?: string
      selection?: string | number
    }
    interpreted?: {
      text?: string
      intent?: string
      confidence?: number
      markings?: Array<{
        type: string
        target?: string
        coordinates?: { x: number; y: number; width?: number; height?: number }
        confidence: number
        meaning?: string
      }>
    }
  }
}

interface LessonPlan {
  topic: string
  normalizedTopic: string
  objective: string
  milestones: Array<{
    id: string
    title: string
    description: string
    required: boolean
    successCriteria: string[]
    estimatedDuration?: number
  }>
  concepts: Array<{
    id: string
    name: string
    description: string
    relatedMilestones: string[]
    misconceptions?: string[]
  }>
  estimatedDuration: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  visualsNeeded: boolean
  interactiveMoments: Array<{
    id: string
    type: string
    milestoneId: string
    prompt: string
    expectedResponseType: string
  }>
}

interface TurnData {
  turn_index: number
  actor: 'learner' | 'teacher'
  input_mode: string | null
  raw_input_json: any
  interpreted_input_json: any
  teacher_response_json: any
  created_at: string
}

interface ProgressTrackerResult {
  sessionId: string
  currentMilestoneId: string | null
  nextMilestoneId: string | null
  allMilestonesProgress: Array<{
    milestoneId: string
    status: 'not_started' | 'introduced' | 'practiced' | 'covered' | 'confirmed'
    attempts: number
    correctAttempts: number
    accuracy: number
    evidence: string[]
    shouldAdvance: boolean
    reasoning: string
  }>
  overallProgress: {
    totalMilestones: number
    completedMilestones: number
    currentMilestoneIndex: number
    percentComplete: number
  }
  shouldCompleteLesson: boolean
  timestamp: string
}

interface TeachingAction {
  type: 'speak' | 'display_text' | 'show_media' | 'highlight_concept' | 'enable_canvas' | 'enable_voice' | 'provide_feedback' | 'advance_milestone'
  params: Record<string, unknown>
  sequenceOrder: number
}

interface TeacherResponse {
  speech: string
  displayText?: string
  actions: TeachingAction[]
  awaitedInputMode: 'voice' | 'text' | 'canvas_draw' | 'canvas_mark' | 'image_annotation' | 'selection' | 'mixed'
  currentMilestoneId: string
  isCorrectAnswer?: boolean
  feedback?: {
    type: 'positive' | 'corrective' | 'neutral'
    message: string
  }
  shouldCompleteLesson?: boolean
  nextMilestoneId?: string
}

// Invoke Progress Tracker
async function invokeProgressTracker(
  sessionId: string,
  currentMilestoneId: string
): Promise<ProgressTrackerResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  
  const response = await fetch(`${supabaseUrl}/functions/v1/progress-tracker`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      sessionId,
      currentMilestoneId
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Progress Tracker failed: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.result
}

// Generate teacher response using AI
async function generateTeacherResponse(
  lessonPlan: LessonPlan,
  currentMilestone: any,
  priorTurns: TurnData[],
  learnerInput: TeacherConductorRequest['learnerInput'],
  progressResult: ProgressTrackerResult,
  interpretedMarkings: any[]
): Promise<TeacherResponse> {
  const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')
  const useOpenAI = !!Deno.env.get('OPENAI_API_KEY')
  
  if (!apiKey) {
    throw new Error('No AI API key configured')
  }

  const currentProgress = progressResult.allMilestonesProgress.find(
    p => p.milestoneId === currentMilestone.id
  )

  const systemPrompt = `You are an expert AI teacher conducting an interactive lesson. Your role is to:
- Guide the learner through milestones in a structured lesson plan
- Provide clear, encouraging, and pedagogically sound instruction
- Assess learner understanding and provide appropriate feedback
- Adapt teaching based on learner responses and progress
- Use natural, conversational language optimized for voice synthesis
- Determine when to advance to the next milestone or complete the lesson

Current Teaching Context:
Topic: ${lessonPlan.topic}
Objective: ${lessonPlan.objective}
Difficulty: ${lessonPlan.difficulty}

Current Milestone: ${currentMilestone.title}
Description: ${currentMilestone.description}
Success Criteria:
${currentMilestone.successCriteria.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}

Progress Status: ${currentProgress?.status || 'not_started'}
Attempts: ${currentProgress?.attempts || 0}
Accuracy: ${currentProgress ? (currentProgress.accuracy * 100).toFixed(0) : 0}%
Should Advance: ${currentProgress?.shouldAdvance || false}

Overall Progress: ${progressResult.overallProgress.completedMilestones}/${progressResult.overallProgress.totalMilestones} milestones (${progressResult.overallProgress.percentComplete.toFixed(0)}%)
Should Complete Lesson: ${progressResult.shouldCompleteLesson}

Related Concepts:
${lessonPlan.concepts
  .filter(c => c.relatedMilestones.includes(currentMilestone.id))
  .map(c => `- ${c.name}: ${c.description}${c.misconceptions ? `\n  Common misconceptions: ${c.misconceptions.join(', ')}` : ''}`)
  .join('\n')}

Return ONLY valid JSON matching this structure:
{
  "speech": "string (natural teaching response optimized for voice synthesis)",
  "displayText": "string (optional text to display alongside speech)",
  "actions": [
    {
      "type": "speak|display_text|show_media|highlight_concept|enable_canvas|enable_voice|provide_feedback|advance_milestone",
      "params": { "key": "value" },
      "sequenceOrder": number
    }
  ],
  "awaitedInputMode": "voice|text|canvas_draw|canvas_mark|image_annotation|selection|mixed",
  "currentMilestoneId": "string",
  "isCorrectAnswer": boolean (optional),
  "feedback": {
    "type": "positive|corrective|neutral",
    "message": "string"
  },
  "shouldCompleteLesson": boolean (optional, true if all milestones covered),
  "nextMilestoneId": "string (optional, if advancing)"
}

Teaching Guidelines:
- Keep speech natural and conversational (optimized for ElevenLabs TTS)
- Provide specific, actionable feedback
- Celebrate correct answers enthusiastically
- For incorrect answers, guide toward understanding without giving away the answer
- Use Socratic questioning to deepen understanding
- Reference prior turns to show continuity
- Suggest appropriate input modes for next interaction
- Advance milestone only when success criteria are met
- Signal lesson completion when all required milestones are covered`

  const recentTurns = priorTurns.slice(-5).map(turn => {
    if (turn.actor === 'learner') {
      const input = turn.raw_input_json?.raw?.text || 
                   turn.interpreted_input_json?.text || 
                   turn.interpreted_input_json?.overallInterpretation ||
                   'non-text input'
      return `Learner (${turn.input_mode}): ${input}`
    } else {
      const response = turn.teacher_response_json
      return `Teacher: ${response?.speech || 'No speech recorded'}`
    }
  }).join('\n')

  const learnerInputText = learnerInput.raw.text || 
                          learnerInput.interpreted?.text || 
                          learnerInput.interpreted?.markings?.map(m => m.meaning).join(', ') ||
                          'non-text input'

  const markingsContext = interpretedMarkings.length > 0
    ? `\n\nInterpreted Canvas/Image Markings:\n${interpretedMarkings.map(m => 
        `- ${m.overallInterpretation || 'No interpretation'}`
      ).join('\n')}`
    : ''

  const userPrompt = `Recent Conversation:
${recentTurns}

Current Learner Input (${learnerInput.mode}): ${learnerInputText}${markingsContext}

Progress Assessment: ${currentProgress?.reasoning || 'No assessment yet'}

Generate an appropriate teaching response that:
1. Acknowledges the learner's input
2. Provides feedback (positive, corrective, or neutral)
3. Advances learning toward milestone success criteria
4. Determines if milestone should advance or lesson should complete
5. Specifies next expected input mode`

  let content: string

  if (useOpenAI) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7, // Natural teaching responses
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    content = data.choices[0].message.content
  } else {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        temperature: 0.7, // Natural teaching responses
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    content = data.content[0].text
  }

  return JSON.parse(content)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { sessionId, turnId, learnerInput }: TeacherConductorRequest = await req.json()

    if (!sessionId || !turnId || !learnerInput) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId, turnId, learnerInput' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing teaching turn for session ${sessionId}, turn ${turnId}`)

    // Fetch session data
    const { data: session, error: sessionError } = await supabase
      .from('lesson_sessions')
      .select('lesson_plan_json, current_milestone_id, status')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      throw new Error(`Failed to fetch session: ${sessionError?.message || 'Session not found'}`)
    }

    if (session.status === 'completed') {
      throw new Error('Session is already completed')
    }

    const lessonPlan = session.lesson_plan_json as LessonPlan
    if (!lessonPlan || !lessonPlan.milestones) {
      throw new Error('Session has no lesson plan')
    }

    // Determine current milestone
    const currentMilestoneId = session.current_milestone_id || lessonPlan.milestones[0].id
    const currentMilestone = lessonPlan.milestones.find(m => m.id === currentMilestoneId)
    
    if (!currentMilestone) {
      throw new Error(`Current milestone ${currentMilestoneId} not found in lesson plan`)
    }

    // Fetch all prior turns
    const { data: priorTurns, error: turnsError } = await supabase
      .from('lesson_turns')
      .select('*')
      .eq('session_id', sessionId)
      .order('turn_index', { ascending: true })

    if (turnsError) {
      throw new Error(`Failed to fetch turns: ${turnsError.message}`)
    }

    // Fetch interpreted markings if canvas/image input
    let interpretedMarkings: any[] = []
    if (learnerInput.mode === 'canvas_draw' || learnerInput.mode === 'canvas_mark' || learnerInput.mode === 'image_annotation') {
      const { data: snapshots, error: snapshotsError } = await supabase
        .from('canvas_snapshots')
        .select('interpreter_result_json')
        .eq('session_id', sessionId)
        .eq('turn_id', turnId)

      if (!snapshotsError && snapshots) {
        interpretedMarkings = snapshots
          .map(s => s.interpreter_result_json)
          .filter(Boolean)
      }
    }

    // Invoke Progress Tracker
    console.log('Invoking Progress Tracker...')
    const progressResult = await invokeProgressTracker(sessionId, currentMilestoneId)
    console.log(`Progress: ${progressResult.overallProgress.completedMilestones}/${progressResult.overallProgress.totalMilestones} milestones`)

    // Generate teacher response
    console.log('Generating teacher response...')
    const teacherResponse = await generateTeacherResponse(
      lessonPlan,
      currentMilestone,
      priorTurns as TurnData[],
      learnerInput,
      progressResult,
      interpretedMarkings
    )

    // Update turn with interpreted input and teacher response
    const { error: updateTurnError } = await supabase
      .from('lesson_turns')
      .update({
        interpreted_input_json: learnerInput.interpreted || learnerInput.raw,
        teacher_response_json: teacherResponse
      })
      .eq('id', turnId)

    if (updateTurnError) {
      console.error('Failed to update turn:', updateTurnError)
    }

    // Update milestone progress if needed
    const currentProgress = progressResult.allMilestonesProgress.find(
      p => p.milestoneId === currentMilestoneId
    )

    if (currentProgress) {
      const { error: progressUpdateError } = await supabase
        .from('lesson_milestone_progress')
        .update({
          status: currentProgress.status,
          evidence_json: {
            attempts: currentProgress.attempts,
            correctAttempts: currentProgress.correctAttempts,
            evidence: currentProgress.evidence
          },
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('milestone_id', currentMilestoneId)

      if (progressUpdateError) {
        console.error('Failed to update milestone progress:', progressUpdateError)
      }
    }

    // Update session if advancing milestone or completing lesson
    const sessionUpdates: any = {
      updated_at: new Date().toISOString()
    }

    if (teacherResponse.nextMilestoneId) {
      sessionUpdates.current_milestone_id = teacherResponse.nextMilestoneId
      console.log(`Advancing to milestone: ${teacherResponse.nextMilestoneId}`)
    }

    if (teacherResponse.shouldCompleteLesson || progressResult.shouldCompleteLesson) {
      sessionUpdates.status = 'completed'
      sessionUpdates.completed_at = new Date().toISOString()
      console.log('Lesson marked for completion')
    } else if (session.status === 'ready') {
      sessionUpdates.status = 'active'
    }

    const { error: sessionUpdateError } = await supabase
      .from('lesson_sessions')
      .update(sessionUpdates)
      .eq('id', sessionId)

    if (sessionUpdateError) {
      console.error('Failed to update session:', sessionUpdateError)
    }

    console.log('Teaching turn processed successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        teacherResponse,
        progressResult,
        message: 'Teaching turn processed successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in teacher-conductor function:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    const errorDetails = error instanceof Error ? error.toString() : String(error)
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
