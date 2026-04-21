import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MediaPlannerRequest {
  sessionId: string
  lessonPlan: LessonPlan
}

interface LessonPlan {
  topic: string
  normalizedTopic: string
  objective: string
  milestones: Milestone[]
  concepts: Concept[]
  difficulty: string
  visualsNeeded: boolean
}

interface Milestone {
  id: string
  title: string
  description: string
}

interface Concept {
  id: string
  name: string
  description: string
  relatedMilestones: string[]
}

interface MediaItem {
  id: string
  type: 'image' | 'diagram' | 'chart' | 'formula'
  description: string
  searchQuery: string
  relatedMilestones: string[]
  relatedConcepts: string[]
  priority: 'high' | 'medium' | 'low'
  source: 'fetch' | 'generate'
}

interface MediaManifest {
  sessionId: string
  items: MediaItem[]
  totalItems: number
  estimatedFetchTime: number
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

// Generate media manifest using AI
async function generateMediaManifest(lessonPlan: LessonPlan): Promise<MediaManifest> {
  const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')
  const useOpenAI = !!Deno.env.get('OPENAI_API_KEY')
  
  if (!apiKey) {
    throw new Error('No AI API key configured')
  }

  const systemPrompt = `You are a media planning expert for an educational platform. Analyze the lesson plan and determine what visual assets would enhance learning.

For each concept and milestone, decide:
- What type of media would be most helpful (image, diagram, chart, formula)
- Whether to fetch existing media or generate new media
- Search queries for fetching or generation prompts
- Priority level (high/medium/low)

Return ONLY valid JSON matching this structure:
{
  "items": [
    {
      "id": "string (ma1, ma2, etc)",
      "type": "image" | "diagram" | "chart" | "formula",
      "description": "string (what this media shows)",
      "searchQuery": "string (for fetching) or generation prompt",
      "relatedMilestones": ["string"],
      "relatedConcepts": ["string"],
      "priority": "high" | "medium" | "low",
      "source": "fetch" | "generate"
    }
  ]
}

Guidelines:
- Prioritize diagrams for complex concepts
- Use images for concrete examples
- Use charts for comparisons or processes
- Generate media when specific educational diagrams are needed
- Fetch media when real-world photos or generic images work
- High priority for core concepts, medium for examples, low for optional enrichment`

  const userPrompt = `Analyze this lesson plan and create a media manifest:

Topic: ${lessonPlan.topic}
Objective: ${lessonPlan.objective}
Difficulty: ${lessonPlan.difficulty}
Visuals Needed: ${lessonPlan.visualsNeeded}

Milestones:
${lessonPlan.milestones.map(m => `- ${m.title}: ${m.description}`).join('\n')}

Concepts:
${lessonPlan.concepts.map(c => `- ${c.name}: ${c.description}`).join('\n')}`

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

  const parsed = JSON.parse(content)
  
  return {
    sessionId: '',
    items: parsed.items || [],
    totalItems: parsed.items?.length || 0,
    estimatedFetchTime: (parsed.items?.length || 0) * 2 // 2 seconds per item estimate
  }
}

// Validate media manifest
function validateMediaManifest(manifest: any): manifest is MediaManifest {
  if (!manifest || typeof manifest !== 'object') return false
  
  if (!Array.isArray(manifest.items)) {
    console.error('Items must be an array')
    return false
  }
  
  for (const item of manifest.items) {
    if (!item.id || !item.type || !item.description || !item.searchQuery) {
      console.error('Media item missing required fields')
      return false
    }
    
    if (!['image', 'diagram', 'chart', 'formula'].includes(item.type)) {
      console.error(`Invalid media type: ${item.type}`)
      return false
    }
    
    if (!['fetch', 'generate'].includes(item.source)) {
      console.error(`Invalid source: ${item.source}`)
      return false
    }
  }
  
  return true
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { sessionId, lessonPlan }: MediaPlannerRequest = await req.json()

    if (!sessionId || !lessonPlan) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId or lessonPlan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Generating media manifest for session ${sessionId}`)

    // Generate media manifest with retry logic
    const manifest = await retryWithBackoff(() => generateMediaManifest(lessonPlan))
    manifest.sessionId = sessionId

    // Validate manifest
    if (!validateMediaManifest(manifest)) {
      throw new Error('Generated media manifest failed validation')
    }

    console.log(`Media manifest generated with ${manifest.totalItems} items`)

    // Update session with media manifest
    const { error: updateError } = await supabase
      .from('lesson_sessions')
      .update({
        media_manifest_json: manifest,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (updateError) {
      throw new Error(`Failed to update session: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        manifest,
        message: 'Media manifest generated successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in media-planner function:', error)
    
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
