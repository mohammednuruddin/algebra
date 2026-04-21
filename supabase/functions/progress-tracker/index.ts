/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProgressTrackerRequest {
  sessionId: string
  currentMilestoneId?: string
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
  objective: string
  milestones: Milestone[]
  concepts: Array<{
    id: string
    name: string
    description: string
    relatedMilestones: string[]
    misconceptions?: string[]
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

interface ProgressAssessment {
  milestoneId: string
  status: 'not_started' | 'introduced' | 'practiced' | 'covered' | 'confirmed'
  attempts: number
  correctAttempts: number
  accuracy: number
  evidence: string[]
  shouldAdvance: boolean
  reasoning: string
}

interface ProgressTrackerResult {
  sessionId: string
  currentMilestoneId: string | null
  nextMilestoneId: string | null
  allMilestonesProgress: ProgressAssessment[]
  overallProgress: {
    totalMilestones: number
    completedMilestones: number
    currentMilestoneIndex: number
    percentComplete: number
  }
  shouldCompleteLesson: boolean
  timestamp: string
}

// Assess milestone progress using AI
async function assessMilestoneProgress(
  milestone: Milestone,
  currentProgress: MilestoneProgressData,
  turns: TurnData[],
  lessonPlan: LessonPlan
): Promise<ProgressAssessment> {
  const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')
  const useOpenAI = !!Deno.env.get('OPENAI_API_KEY')
  
  if (!apiKey) {
    throw new Error('No AI API key configured')
  }

  // Filter turns relevant to this milestone
  const relevantTurns = turns.filter(turn => {
    if (turn.teacher_response_json?.currentMilestoneId === milestone.id) {
      return true
    }
    return false
  })

  const systemPrompt = `You are an expert educational assessment AI that evaluates learner progress against milestone success criteria.

Analyze the learner's responses and interactions to determine:
1. Current mastery level (not_started, introduced, practiced, covered, confirmed)
2. Whether the learner has met the success criteria
3. Whether to advance to the next milestone
4. Evidence of understanding or misconceptions

Milestone Status Definitions:
- not_started: Milestone hasn't been introduced yet
- introduced: Milestone has been presented but learner hasn't practiced
- practiced: Learner has attempted tasks but hasn't demonstrated mastery
- covered: Learner has demonstrated understanding of core concepts
- confirmed: Learner has consistently demonstrated mastery (ready to advance)

Return ONLY valid JSON matching this structure:
{
  "status": "not_started" | "introduced" | "practiced" | "covered" | "confirmed",
  "shouldAdvance": boolean,
  "reasoning": "string (brief explanation of assessment)",
  "evidence": ["string (specific examples from learner responses)"]
}`

  const userPrompt = `Assess learner progress for this milestone:

Milestone: ${milestone.title}
Description: ${milestone.description}
Success Criteria:
${milestone.successCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Current Progress:
- Status: ${currentProgress.status}
- Attempts: ${currentProgress.evidence_json.attempts}
- Correct Attempts: ${currentProgress.evidence_json.correctAttempts}
- Previous Evidence: ${currentProgress.evidence_json.evidence.join('; ')}

Recent Learner Interactions (${relevantTurns.length} turns):
${relevantTurns.slice(-5).map(turn => {
  if (turn.actor === 'learner') {
    const input = turn.raw_input_json?.raw?.text || turn.interpreted_input_json?.text || 'non-text input'
    return `Learner: ${input}`
  } else {
    const feedback = turn.teacher_response_json?.feedback
    const isCorrect = turn.teacher_response_json?.isCorrectAnswer
    return `Teacher feedback: ${feedback?.type || 'neutral'} (correct: ${isCorrect !== undefined ? isCorrect : 'unknown'})`
  }
}).join('\n')}

Assess whether the learner has met the success criteria and should advance.`

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
        max_tokens: 1000,
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
        max_tokens: 1000,
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

  const assessment = JSON.parse(content)

  return {
    milestoneId: milestone.id,
    status: assessment.status,
    attempts: currentProgress.evidence_json.attempts,
    correctAttempts: currentProgress.evidence_json.correctAttempts,
    accuracy: currentProgress.evidence_json.attempts > 0 
      ? currentProgress.evidence_json.correctAttempts / currentProgress.evidence_json.attempts 
      : 0,
    evidence: [...currentProgress.evidence_json.evidence, ...assessment.evidence],
    shouldAdvance: assessment.shouldAdvance,
    reasoning: assessment.reasoning
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { sessionId, currentMilestoneId }: ProgressTrackerRequest = await req.json()

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: sessionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Tracking progress for session ${sessionId}`)

    // Fetch session data
    const { data: session, error: sessionError } = await supabase
      .from('lesson_sessions')
      .select('lesson_plan_json, current_milestone_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      throw new Error(`Failed to fetch session: ${sessionError?.message || 'Session not found'}`)
    }

    const lessonPlan = session.lesson_plan_json as LessonPlan
    if (!lessonPlan || !lessonPlan.milestones) {
      throw new Error('Session has no lesson plan')
    }

    // Fetch all turns for this session
    const { data: turns, error: turnsError } = await supabase
      .from('lesson_turns')
      .select('*')
      .eq('session_id', sessionId)
      .order('turn_index', { ascending: true })

    if (turnsError) {
      throw new Error(`Failed to fetch turns: ${turnsError.message}`)
    }

    // Fetch current milestone progress
    const { data: progressRecords, error: progressError } = await supabase
      .from('lesson_milestone_progress')
      .select('*')
      .eq('session_id', sessionId)

    if (progressError) {
      throw new Error(`Failed to fetch progress: ${progressError.message}`)
    }

    // Assess progress for all milestones
    const allProgress: ProgressAssessment[] = []
    
    for (const milestone of lessonPlan.milestones) {
      const progressRecord = progressRecords?.find(p => p.milestone_id === milestone.id)
      
      if (!progressRecord) {
        // Milestone not yet tracked
        allProgress.push({
          milestoneId: milestone.id,
          status: 'not_started',
          attempts: 0,
          correctAttempts: 0,
          accuracy: 0,
          evidence: [],
          shouldAdvance: false,
          reasoning: 'Milestone not yet introduced'
        })
        continue
      }

      // Use AI to assess progress
      const assessment = await assessMilestoneProgress(
        milestone,
        progressRecord as MilestoneProgressData,
        turns as TurnData[],
        lessonPlan
      )

      allProgress.push(assessment)
    }

    // Determine current and next milestone
    const activeMilestoneId = currentMilestoneId || session.current_milestone_id
    const currentIndex = lessonPlan.milestones.findIndex(m => m.id === activeMilestoneId)
    
    let nextMilestoneId: string | null = null
    if (currentIndex >= 0 && currentIndex < lessonPlan.milestones.length - 1) {
      const currentAssessment = allProgress.find(p => p.milestoneId === activeMilestoneId)
      if (currentAssessment?.shouldAdvance) {
        nextMilestoneId = lessonPlan.milestones[currentIndex + 1].id
      }
    }

    // Check if all required milestones are confirmed
    const completedMilestones = allProgress.filter(p => 
      p.status === 'confirmed' || p.status === 'covered'
    ).length
    
    const requiredMilestones = lessonPlan.milestones.filter(m => m.required)
    const requiredCompleted = allProgress.filter(p => {
      const milestone = lessonPlan.milestones.find(m => m.id === p.milestoneId)
      return milestone?.required && (p.status === 'confirmed' || p.status === 'covered')
    }).length

    const shouldCompleteLesson = requiredCompleted === requiredMilestones.length

    const result: ProgressTrackerResult = {
      sessionId,
      currentMilestoneId: activeMilestoneId,
      nextMilestoneId,
      allMilestonesProgress: allProgress,
      overallProgress: {
        totalMilestones: lessonPlan.milestones.length,
        completedMilestones,
        currentMilestoneIndex: currentIndex >= 0 ? currentIndex : 0,
        percentComplete: (completedMilestones / lessonPlan.milestones.length) * 100
      },
      shouldCompleteLesson,
      timestamp: new Date().toISOString()
    }

    console.log(`Progress tracking completed: ${completedMilestones}/${lessonPlan.milestones.length} milestones`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        result,
        message: 'Progress tracking completed successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in progress-tracker function:', error)
    
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
