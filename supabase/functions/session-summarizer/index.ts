/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SessionSummarizerRequest {
  sessionId: string
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

interface MilestoneProgressData {
  milestone_id: string
  status: 'not_started' | 'introduced' | 'practiced' | 'covered' | 'confirmed'
  evidence_json: {
    attempts: number
    correctAttempts: number
    evidence: string[]
  }
  updated_at: string
}

interface LessonSummary {
  sessionId: string
  topic: string
  objective: string
  duration: {
    startTime: string
    endTime: string
    totalMinutes: number
  }
  milestonesOverview: {
    total: number
    completed: number
    percentComplete: number
    milestones: Array<{
      id: string
      title: string
      status: string
      attempts: number
      accuracy: number
      keyInsights: string[]
    }>
  }
  learnerPerformance: {
    overallEngagement: 'high' | 'medium' | 'low'
    strengthAreas: string[]
    improvementAreas: string[]
    misconceptionsAddressed: string[]
    notableAchievements: string[]
  }
  interactionSummary: {
    totalTurns: number
    inputModesUsed: string[]
    canvasInteractions: number
    voiceInteractions: number
    textInteractions: number
  }
  keyTakeaways: string[]
  recommendedNextSteps: string[]
  generatedAt: string
}

// Generate lesson summary using AI
async function generateLessonSummary(
  sessionId: string,
  lessonPlan: LessonPlan,
  turns: TurnData[],
  milestoneProgress: MilestoneProgressData[],
  sessionMetadata: {
    createdAt: string
    completedAt: string
  }
): Promise<LessonSummary> {
  const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')
  const useOpenAI = !!Deno.env.get('OPENAI_API_KEY')
  
  if (!apiKey) {
    throw new Error('No AI API key configured')
  }

  const systemPrompt = `You are an expert educational analyst that generates comprehensive lesson summaries. Analyze the complete teaching session to provide insights on:
- Learner performance and progress
- Milestone completion and mastery
- Engagement patterns and interaction modes
- Strengths and areas for improvement
- Misconceptions addressed during the lesson
- Key takeaways and achievements
- Recommended next steps for continued learning

Return ONLY valid JSON matching this structure:
{
  "overallEngagement": "high" | "medium" | "low",
  "strengthAreas": ["string"],
  "improvementAreas": ["string"],
  "misconceptionsAddressed": ["string"],
  "notableAchievements": ["string"],
  "keyTakeaways": ["string"],
  "recommendedNextSteps": ["string"],
  "milestoneInsights": {
    "milestoneId": {
      "keyInsights": ["string"]
    }
  }
}

Analysis Guidelines:
- Assess engagement based on response quality, interaction frequency, and persistence
- Identify specific strengths demonstrated by the learner
- Note areas where the learner struggled or needs more practice
- Highlight misconceptions that were successfully addressed
- Celebrate notable achievements and breakthroughs
- Provide 3-5 key takeaways from the lesson
- Suggest 2-4 concrete next steps for continued learning
- For each milestone, provide 1-3 key insights about learner performance`

  // Prepare turn summary
  const turnSummary = turns.map(turn => {
    if (turn.actor === 'learner') {
      const input = turn.raw_input_json?.raw?.text || 
                   turn.interpreted_input_json?.text || 
                   turn.interpreted_input_json?.overallInterpretation ||
                   'non-text input'
      return `Learner (${turn.input_mode}): ${input}`
    } else {
      const response = turn.teacher_response_json
      const feedback = response?.feedback
      return `Teacher: ${response?.speech || 'No speech'} [Feedback: ${feedback?.type || 'neutral'}]`
    }
  }).join('\n')

  // Prepare milestone progress summary
  const progressSummary = milestoneProgress.map(mp => {
    const milestone = lessonPlan.milestones.find(m => m.id === mp.milestone_id)
    return `Milestone: ${milestone?.title || mp.milestone_id}
Status: ${mp.status}
Attempts: ${mp.evidence_json.attempts}
Correct: ${mp.evidence_json.correctAttempts}
Accuracy: ${mp.evidence_json.attempts > 0 ? ((mp.evidence_json.correctAttempts / mp.evidence_json.attempts) * 100).toFixed(0) : 0}%
Evidence: ${mp.evidence_json.evidence.slice(-3).join('; ')}`
  }).join('\n\n')

  const userPrompt = `Analyze this completed lesson session:

Topic: ${lessonPlan.topic}
Objective: ${lessonPlan.objective}
Difficulty: ${lessonPlan.difficulty}
Duration: ${Math.round((new Date(sessionMetadata.completedAt).getTime() - new Date(sessionMetadata.createdAt).getTime()) / 60000)} minutes

Milestones (${lessonPlan.milestones.length} total):
${lessonPlan.milestones.map(m => `- ${m.title}: ${m.description}`).join('\n')}

Milestone Progress:
${progressSummary}

Teaching Interaction (${turns.length} turns):
${turnSummary.length > 5000 ? turnSummary.substring(0, 5000) + '...[truncated]' : turnSummary}

Concepts Covered:
${lessonPlan.concepts.map(c => `- ${c.name}: ${c.description}${c.misconceptions ? ` (Misconceptions: ${c.misconceptions.join(', ')})` : ''}`).join('\n')}

Generate a comprehensive summary analyzing the learner's performance, engagement, achievements, and recommended next steps.`

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
        temperature: 0.3,
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
        temperature: 0.3,
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

  const aiAnalysis = JSON.parse(content)

  // Calculate interaction statistics
  const inputModes = new Set(turns.filter(t => t.actor === 'learner' && t.input_mode).map(t => t.input_mode))
  const canvasInteractions = turns.filter(t => 
    t.actor === 'learner' && 
    (t.input_mode === 'canvas_draw' || t.input_mode === 'canvas_mark' || t.input_mode === 'image_annotation')
  ).length
  const voiceInteractions = turns.filter(t => t.actor === 'learner' && t.input_mode === 'voice').length
  const textInteractions = turns.filter(t => t.actor === 'learner' && t.input_mode === 'text').length

  // Calculate duration
  const startTime = new Date(sessionMetadata.createdAt)
  const endTime = new Date(sessionMetadata.completedAt)
  const totalMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

  // Build milestone overview
  const completedMilestones = milestoneProgress.filter(mp => 
    mp.status === 'confirmed' || mp.status === 'covered'
  ).length

  const milestonesOverview = {
    total: lessonPlan.milestones.length,
    completed: completedMilestones,
    percentComplete: (completedMilestones / lessonPlan.milestones.length) * 100,
    milestones: milestoneProgress.map(mp => {
      const milestone = lessonPlan.milestones.find(m => m.id === mp.milestone_id)
      const insights = aiAnalysis.milestoneInsights?.[mp.milestone_id]?.keyInsights || []
      
      return {
        id: mp.milestone_id,
        title: milestone?.title || mp.milestone_id,
        status: mp.status,
        attempts: mp.evidence_json.attempts,
        accuracy: mp.evidence_json.attempts > 0 
          ? (mp.evidence_json.correctAttempts / mp.evidence_json.attempts) * 100 
          : 0,
        keyInsights: insights
      }
    })
  }

  const summary: LessonSummary = {
    sessionId,
    topic: lessonPlan.topic,
    objective: lessonPlan.objective,
    duration: {
      startTime: sessionMetadata.createdAt,
      endTime: sessionMetadata.completedAt,
      totalMinutes
    },
    milestonesOverview,
    learnerPerformance: {
      overallEngagement: aiAnalysis.overallEngagement,
      strengthAreas: aiAnalysis.strengthAreas,
      improvementAreas: aiAnalysis.improvementAreas,
      misconceptionsAddressed: aiAnalysis.misconceptionsAddressed,
      notableAchievements: aiAnalysis.notableAchievements
    },
    interactionSummary: {
      totalTurns: turns.filter(t => t.actor === 'learner').length,
      inputModesUsed: Array.from(inputModes),
      canvasInteractions,
      voiceInteractions,
      textInteractions
    },
    keyTakeaways: aiAnalysis.keyTakeaways,
    recommendedNextSteps: aiAnalysis.recommendedNextSteps,
    generatedAt: new Date().toISOString()
  }

  return summary
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { sessionId }: SessionSummarizerRequest = await req.json()

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: sessionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Generating summary for session ${sessionId}`)

    // Fetch session data
    const { data: session, error: sessionError } = await supabase
      .from('lesson_sessions')
      .select('lesson_plan_json, created_at, completed_at, status')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      throw new Error(`Failed to fetch session: ${sessionError?.message || 'Session not found'}`)
    }

    if (session.status !== 'completed') {
      throw new Error('Session is not completed yet')
    }

    const lessonPlan = session.lesson_plan_json as LessonPlan
    if (!lessonPlan || !lessonPlan.milestones) {
      throw new Error('Session has no lesson plan')
    }

    // Fetch all turns
    const { data: turns, error: turnsError } = await supabase
      .from('lesson_turns')
      .select('*')
      .eq('session_id', sessionId)
      .order('turn_index', { ascending: true })

    if (turnsError) {
      throw new Error(`Failed to fetch turns: ${turnsError.message}`)
    }

    // Fetch milestone progress
    const { data: milestoneProgress, error: progressError } = await supabase
      .from('lesson_milestone_progress')
      .select('*')
      .eq('session_id', sessionId)

    if (progressError) {
      throw new Error(`Failed to fetch milestone progress: ${progressError.message}`)
    }

    // Generate summary
    console.log('Generating lesson summary with AI...')
    const summary = await generateLessonSummary(
      sessionId,
      lessonPlan,
      turns as TurnData[],
      milestoneProgress as MilestoneProgressData[],
      {
        createdAt: session.created_at,
        completedAt: session.completed_at
      }
    )

    console.log(`Summary generated successfully: ${summary.milestonesOverview.completed}/${summary.milestonesOverview.total} milestones completed`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary,
        message: 'Lesson summary generated successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in session-summarizer function:', error)
    
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
