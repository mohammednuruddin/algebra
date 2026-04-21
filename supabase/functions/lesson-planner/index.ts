import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LessonPlanRequest {
  sessionId: string
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

interface Concept {
  id: string
  name: string
  description: string
  relatedMilestones: string[]
  misconceptions?: string[]
}

interface InteractiveMoment {
  id: string
  type: 'question' | 'canvas_task' | 'image_annotation' | 'voice_response'
  milestoneId: string
  prompt: string
  expectedResponseType: string
}

interface LessonPlan {
  topic: string
  normalizedTopic: string
  objective: string
  milestones: Milestone[]
  concepts: Concept[]
  estimatedDuration: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  visualsNeeded: boolean
  interactiveMoments: InteractiveMoment[]
}

// Exponential backoff retry logic
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt)
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

// Generate lesson plan using AI service
async function generateLessonPlan(topicPrompt: string): Promise<LessonPlan> {
  const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')
  const useOpenAI = !!Deno.env.get('OPENAI_API_KEY')
  
  if (!apiKey) {
    throw new Error('No AI API key configured')
  }

  const systemPrompt = `You are an expert lesson planner for an AI teaching platform. Generate a structured lesson plan that:
- Breaks down the topic into clear, achievable milestones
- Identifies key concepts and common misconceptions
- Suggests interactive moments for learner engagement
- Estimates realistic durations
- Determines if visual aids would be helpful

Return ONLY valid JSON matching this structure:
{
  "topic": "string",
  "normalizedTopic": "string (lowercase, hyphenated)",
  "objective": "string (what learner will achieve)",
  "milestones": [
    {
      "id": "string (m1, m2, etc)",
      "title": "string",
      "description": "string",
      "required": boolean,
      "successCriteria": ["string"],
      "estimatedDuration": number (minutes)
    }
  ],
  "concepts": [
    {
      "id": "string (c1, c2, etc)",
      "name": "string",
      "description": "string",
      "relatedMilestones": ["string"],
      "misconceptions": ["string"]
    }
  ],
  "estimatedDuration": number (total minutes),
  "difficulty": "beginner" | "intermediate" | "advanced",
  "visualsNeeded": boolean,
  "interactiveMoments": [
    {
      "id": "string (im1, im2, etc)",
      "type": "question" | "canvas_task" | "image_annotation" | "voice_response",
      "milestoneId": "string",
      "prompt": "string",
      "expectedResponseType": "string"
    }
  ]
}`

  const userPrompt = `Create a lesson plan for: ${topicPrompt}`

  if (useOpenAI) {
    // OpenAI GPT-4o-mini
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
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    return JSON.parse(content)
  } else {
    // Anthropic Claude 3.5 Haiku
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4000,
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
    const content = data.content[0].text
    return JSON.parse(content)
  }
}

// Validate lesson plan structure
function validateLessonPlan(plan: any): plan is LessonPlan {
  if (!plan || typeof plan !== 'object') return false
  
  const required = [
    'topic',
    'normalizedTopic',
    'objective',
    'milestones',
    'concepts',
    'estimatedDuration',
    'difficulty',
    'visualsNeeded',
    'interactiveMoments'
  ]
  
  for (const field of required) {
    if (!(field in plan)) {
      console.error(`Missing required field: ${field}`)
      return false
    }
  }
  
  if (!Array.isArray(plan.milestones) || plan.milestones.length === 0) {
    console.error('Milestones must be a non-empty array')
    return false
  }
  
  if (!Array.isArray(plan.concepts)) {
    console.error('Concepts must be an array')
    return false
  }
  
  if (!['beginner', 'intermediate', 'advanced'].includes(plan.difficulty)) {
    console.error('Invalid difficulty level')
    return false
  }
  
  return true
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse request
    const { sessionId, topicPrompt }: LessonPlanRequest = await req.json()

    if (!sessionId || !topicPrompt) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId or topicPrompt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Generating lesson plan for session ${sessionId}: ${topicPrompt}`)

    // Generate lesson plan with retry logic
    const lessonPlan = await retryWithBackoff(() => generateLessonPlan(topicPrompt))

    // Validate lesson plan structure
    if (!validateLessonPlan(lessonPlan)) {
      throw new Error('Generated lesson plan failed validation')
    }

    console.log(`Lesson plan generated successfully with ${lessonPlan.milestones.length} milestones`)

    // Update session with lesson plan
    const { error: updateError } = await supabase
      .from('lesson_sessions')
      .update({
        lesson_plan_json: lessonPlan,
        normalized_topic: lessonPlan.normalizedTopic,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (updateError) {
      throw new Error(`Failed to update session: ${updateError.message}`)
    }

    // Initialize milestone progress records
    const progressRecords = lessonPlan.milestones.map(milestone => ({
      session_id: sessionId,
      milestone_id: milestone.id,
      status: 'not_started',
      evidence_json: { attempts: 0, correctAttempts: 0, evidence: [] },
      updated_at: new Date().toISOString()
    }))

    const { error: progressError } = await supabase
      .from('lesson_milestone_progress')
      .insert(progressRecords)

    if (progressError) {
      console.error('Failed to initialize milestone progress:', progressError)
      // Don't fail the request, just log the error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        lessonPlan,
        message: 'Lesson plan generated successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in lesson-planner function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
