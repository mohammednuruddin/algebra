/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ArticleGeneratorRequest {
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

interface MediaAsset {
  id: string
  kind: string
  storage_path: string
  metadata_json: any
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
    overallEngagement: string
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

// Generate article title following pattern: [Topic] - [Key Concept] - [Date]
function generateArticleTitle(lessonPlan: LessonPlan, completedAt: string): string {
  const date = new Date(completedAt)
  const formattedDate = date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  
  // Extract key concept from first milestone or objective
  const keyConcept = lessonPlan.milestones[0]?.title || lessonPlan.objective.split(' ').slice(0, 5).join(' ')
  
  return `${lessonPlan.topic} - ${keyConcept} - ${formattedDate}`
}

// Generate article markdown using AI
async function generateArticleMarkdown(
  lessonPlan: LessonPlan,
  turns: TurnData[],
  mediaAssets: MediaAsset[],
  summary: LessonSummary,
  sessionMetadata: {
    completedAt: string
  }
): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')
  const useOpenAI = !!Deno.env.get('OPENAI_API_KEY')
  
  if (!apiKey) {
    throw new Error('No AI API key configured')
  }

  const systemPrompt = `You are an expert educational content writer that creates comprehensive lesson articles. Generate a well-structured markdown article that:
- Synthesizes the lesson plan, teaching turns, and media into a cohesive narrative
- Embeds media assets at appropriate positions using markdown image syntax
- Includes formulas and equations using LaTeX notation ($...$ for inline, $$...$$ for block)
- Structures content with clear sections for each milestone
- Preserves key concepts, examples, and explanations from the teaching session
- Writes in an engaging, educational tone suitable for review and reference

Return ONLY the markdown content (no JSON wrapper). The article should follow this structure:

# [Title will be added separately]

**Topic:** [Topic]
**Date:** [Date]
**Duration:** [X minutes]
**Milestones Covered:** [X/Y]

## Introduction

[Brief overview of what was taught and learned, based on the lesson objective]

## [Milestone 1 Title]

[Explanation of the concept with embedded media where relevant]

![Description](MEDIA_PLACEHOLDER_ID)

### Key Points
- [Point 1]
- [Point 2]

### Examples
[Worked examples or demonstrations from the teaching turns]

## [Milestone 2 Title]

[Continue for each milestone...]

## Summary

[What the learner accomplished, key takeaways, and recommended next steps]

Guidelines:
- Use descriptive alt text for images
- Place media assets where they best support the content
- Include formulas using LaTeX: $E = mc^2$ or $$\\int_0^\\infty e^{-x} dx = 1$$
- Keep the tone educational but accessible
- Highlight important concepts and breakthroughs
- Reference specific examples from the teaching turns when relevant`

  // Prepare media asset references
  const mediaReferences = mediaAssets.map((asset, idx) => {
    const metadata = asset.metadata_json || {}
    return `Media ${idx + 1} (ID: ${asset.id}): ${metadata.description || metadata.query || 'Visual aid'} - Path: ${asset.storage_path}`
  }).join('\n')

  // Prepare turn summary with key teaching moments
  const teachingMoments = turns
    .filter(turn => turn.actor === 'teacher' && turn.teacher_response_json?.speech)
    .map(turn => {
      const response = turn.teacher_response_json
      return `Teacher: ${response.speech.substring(0, 200)}${response.speech.length > 200 ? '...' : ''}`
    })
    .slice(0, 10) // Limit to first 10 teaching moments
    .join('\n\n')

  const userPrompt = `Generate a comprehensive lesson article for this completed teaching session:

Topic: ${lessonPlan.topic}
Objective: ${lessonPlan.objective}
Difficulty: ${lessonPlan.difficulty}
Duration: ${summary.duration.totalMinutes} minutes
Completion Date: ${sessionMetadata.completedAt}

Milestones (${lessonPlan.milestones.length} total):
${lessonPlan.milestones.map((m, idx) => {
  const progress = summary.milestonesOverview.milestones.find(mp => mp.id === m.id)
  return `${idx + 1}. ${m.title}: ${m.description} [Status: ${progress?.status || 'not_started'}]`
}).join('\n')}

Key Concepts:
${lessonPlan.concepts.map(c => `- ${c.name}: ${c.description}`).join('\n')}

Available Media Assets:
${mediaReferences || 'No media assets'}

Key Teaching Moments:
${teachingMoments}

Learner Performance:
- Engagement: ${summary.learnerPerformance.overallEngagement}
- Strengths: ${summary.learnerPerformance.strengthAreas.join(', ')}
- Achievements: ${summary.learnerPerformance.notableAchievements.join(', ')}

Key Takeaways:
${summary.keyTakeaways.map(t => `- ${t}`).join('\n')}

Recommended Next Steps:
${summary.recommendedNextSteps.map(s => `- ${s}`).join('\n')}

Generate the article markdown now. Use MEDIA_PLACEHOLDER_ID format for media references (e.g., MEDIA_PLACEHOLDER_${mediaAssets[0]?.id || 'none'}).`

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
        max_tokens: 4000,
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
    content = data.content[0].text
  }

  return content
}

// Replace media placeholders with actual storage URLs
function embedMediaAssets(
  markdown: string,
  mediaAssets: MediaAsset[],
  supabaseUrl: string
): string {
  let result = markdown

  // Replace MEDIA_PLACEHOLDER_ID patterns with actual URLs
  mediaAssets.forEach(asset => {
    const placeholder = `MEDIA_PLACEHOLDER_${asset.id}`
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${asset.storage_path}`
    result = result.replace(new RegExp(placeholder, 'g'), publicUrl)
  })

  return result
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { sessionId }: ArticleGeneratorRequest = await req.json()

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: sessionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Generating article for session ${sessionId}`)

    // Fetch session data
    const { data: session, error: sessionError } = await supabase
      .from('lesson_sessions')
      .select('user_id, lesson_plan_json, summary_json, created_at, completed_at, status')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      throw new Error(`Failed to fetch session: ${sessionError?.message || 'Session not found'}`)
    }

    if (session.status !== 'completed') {
      throw new Error('Session is not completed yet')
    }

    const lessonPlan = session.lesson_plan_json as LessonPlan
    const summary = session.summary_json as LessonSummary

    if (!lessonPlan || !summary) {
      throw new Error('Session missing lesson plan or summary')
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

    // Fetch media assets
    const { data: mediaAssets, error: mediaError } = await supabase
      .from('lesson_media_assets')
      .select('*')
      .eq('session_id', sessionId)

    if (mediaError) {
      throw new Error(`Failed to fetch media assets: ${mediaError.message}`)
    }

    // Generate article title
    const title = generateArticleTitle(lessonPlan, session.completed_at)

    console.log('Generating article markdown with AI...')
    
    // Generate article markdown
    let articleMarkdown = await generateArticleMarkdown(
      lessonPlan,
      turns as TurnData[],
      mediaAssets as MediaAsset[],
      summary,
      { completedAt: session.completed_at }
    )

    // Add title to the beginning if not present
    if (!articleMarkdown.startsWith('#')) {
      articleMarkdown = `# ${title}\n\n${articleMarkdown}`
    } else {
      // Replace first heading with our generated title
      articleMarkdown = articleMarkdown.replace(/^#\s+.*$/m, `# ${title}`)
    }

    // Embed media assets with actual URLs
    articleMarkdown = embedMediaAssets(articleMarkdown, mediaAssets as MediaAsset[], supabaseUrl)

    // Upload article to storage
    const storagePath = `${session.user_id}/${sessionId}/article.md`
    const { error: uploadError } = await supabase.storage
      .from('lesson-articles')
      .upload(storagePath, articleMarkdown, {
        contentType: 'text/markdown',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Failed to upload article: ${uploadError.message}`)
    }

    // Create article metadata
    const metadata = {
      topic: lessonPlan.topic,
      duration: summary.duration.totalMinutes,
      milestonesTotal: lessonPlan.milestones.length,
      milestonesCompleted: summary.milestonesOverview.completed,
      difficulty: lessonPlan.difficulty,
      mediaCount: mediaAssets?.length || 0
    }

    // Insert article record
    const { data: article, error: insertError } = await supabase
      .from('lesson_articles')
      .insert({
        session_id: sessionId,
        user_id: session.user_id,
        title,
        article_markdown: articleMarkdown,
        article_storage_path: storagePath,
        metadata_json: metadata
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to insert article record: ${insertError.message}`)
    }

    // Update session with article path
    const { error: updateError } = await supabase
      .from('lesson_sessions')
      .update({
        article_path: storagePath,
        article_generated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Failed to update session with article path:', updateError)
      // Don't fail the request, just log the error
    }

    console.log(`Article generated successfully: ${title}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        article: {
          id: article.id,
          title,
          storagePath,
          metadata
        },
        message: 'Article generated successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in article-generator function:', error)
    
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
