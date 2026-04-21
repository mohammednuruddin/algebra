import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VisionInterpretationRequest {
  sessionId: string
  turnId?: string
  imageUrl: string
  context?: {
    currentMilestone?: string
    expectedConcepts?: string[]
    taskDescription?: string
  }
}

interface InterpretedMarking {
  shapes: Array<{
    type: 'circle' | 'rectangle' | 'line' | 'arrow' | 'freehand' | 'text' | 'other'
    description: string
    position?: { x: number; y: number }
    confidence: number
  }>
  text: Array<{
    content: string
    position?: { x: number; y: number }
    confidence: number
  }>
  concepts: Array<{
    name: string
    description: string
    confidence: number
  }>
  annotations: Array<{
    type: 'highlight' | 'underline' | 'circle' | 'arrow' | 'note'
    description: string
    confidence: number
  }>
  overallInterpretation: string
  confidence: number
}

interface VisionInterpretationResult {
  interpretedMarking: InterpretedMarking
  rawResponse: string
  model: string
  timestamp: string
}

// Interpret image using GPT-4o-mini with vision
async function interpretWithGPT4Vision(
  imageUrl: string,
  context?: VisionInterpretationRequest['context']
): Promise<{ interpretation: InterpretedMarking; rawResponse: string }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  // Build context-aware prompt
  let contextPrompt = ''
  if (context) {
    if (context.currentMilestone) {
      contextPrompt += `Current learning milestone: ${context.currentMilestone}\n`
    }
    if (context.expectedConcepts && context.expectedConcepts.length > 0) {
      contextPrompt += `Expected concepts: ${context.expectedConcepts.join(', ')}\n`
    }
    if (context.taskDescription) {
      contextPrompt += `Task description: ${context.taskDescription}\n`
    }
  }

  const systemPrompt = `You are an expert educational AI that analyzes learner drawings, canvas markings, and image annotations. Your task is to interpret what the learner has drawn or marked, identifying shapes, text, concepts, and annotations.

${contextPrompt}

Analyze the image and provide a structured JSON response with the following format:
{
  "shapes": [
    {
      "type": "circle|rectangle|line|arrow|freehand|text|other",
      "description": "detailed description of the shape",
      "position": { "x": 0, "y": 0 },
      "confidence": 0.0-1.0
    }
  ],
  "text": [
    {
      "content": "extracted text content",
      "position": { "x": 0, "y": 0 },
      "confidence": 0.0-1.0
    }
  ],
  "concepts": [
    {
      "name": "concept name",
      "description": "what concept the learner is demonstrating",
      "confidence": 0.0-1.0
    }
  ],
  "annotations": [
    {
      "type": "highlight|underline|circle|arrow|note",
      "description": "what the annotation indicates",
      "confidence": 0.0-1.0
    }
  ],
  "overallInterpretation": "comprehensive interpretation of what the learner is trying to express",
  "confidence": 0.0-1.0
}

Be thorough but concise. Focus on educational understanding and learning intent.`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze this image and provide the structured interpretation.'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high'
              }
            }
          ]
        }
      ],
      temperature: 0.3, // Deterministic interpretation
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from vision model')
  }

  const rawResponse = data.choices[0].message.content
  const interpretation = JSON.parse(rawResponse)

  return {
    interpretation,
    rawResponse
  }
}

// Interpret image using Claude 3.5 Haiku with vision
async function interpretWithClaudeVision(
  imageUrl: string,
  context?: VisionInterpretationRequest['context']
): Promise<{ interpretation: InterpretedMarking; rawResponse: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  
  if (!apiKey) {
    throw new Error('Anthropic API key not configured')
  }

  // Download image and convert to base64
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`)
  }
  
  const imageBlob = await imageResponse.blob()
  const arrayBuffer = await imageBlob.arrayBuffer()
  const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
  const mediaType = imageBlob.type || 'image/png'

  // Build context-aware prompt
  let contextPrompt = ''
  if (context) {
    if (context.currentMilestone) {
      contextPrompt += `Current learning milestone: ${context.currentMilestone}\n`
    }
    if (context.expectedConcepts && context.expectedConcepts.length > 0) {
      contextPrompt += `Expected concepts: ${context.expectedConcepts.join(', ')}\n`
    }
    if (context.taskDescription) {
      contextPrompt += `Task description: ${context.taskDescription}\n`
    }
  }

  const prompt = `You are an expert educational AI that analyzes learner drawings, canvas markings, and image annotations. Your task is to interpret what the learner has drawn or marked, identifying shapes, text, concepts, and annotations.

${contextPrompt}

Analyze the image and provide a structured JSON response with the following format:
{
  "shapes": [
    {
      "type": "circle|rectangle|line|arrow|freehand|text|other",
      "description": "detailed description of the shape",
      "position": { "x": 0, "y": 0 },
      "confidence": 0.0-1.0
    }
  ],
  "text": [
    {
      "content": "extracted text content",
      "position": { "x": 0, "y": 0 },
      "confidence": 0.0-1.0
    }
  ],
  "concepts": [
    {
      "name": "concept name",
      "description": "what concept the learner is demonstrating",
      "confidence": 0.0-1.0
    }
  ],
  "annotations": [
    {
      "type": "highlight|underline|circle|arrow|note",
      "description": "what the annotation indicates",
      "confidence": 0.0-1.0
    }
  ],
  "overallInterpretation": "comprehensive interpretation of what the learner is trying to express",
  "confidence": 0.0-1.0
}

Be thorough but concise. Focus on educational understanding and learning intent. Respond ONLY with valid JSON.`

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
      temperature: 0.3, // Deterministic interpretation
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  
  if (!data.content || data.content.length === 0) {
    throw new Error('No response from vision model')
  }

  const rawResponse = data.content[0].text
  const interpretation = JSON.parse(rawResponse)

  return {
    interpretation,
    rawResponse
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

    const { sessionId, turnId, imageUrl, context }: VisionInterpretationRequest = await req.json()

    if (!sessionId || !imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId and imageUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Interpreting vision for session ${sessionId}${turnId ? `, turn ${turnId}` : ''}`)

    // Try GPT-4o-mini with vision first, fallback to Claude 3.5 Haiku
    let visionData
    let model = 'gpt-4o-mini'
    
    try {
      visionData = await interpretWithGPT4Vision(imageUrl, context)
    } catch (gptError) {
      const gptErrorMsg = gptError instanceof Error ? gptError.message : String(gptError)
      console.log('GPT-4o-mini vision failed, trying Claude 3.5 Haiku:', gptErrorMsg)
      try {
        visionData = await interpretWithClaudeVision(imageUrl, context)
        model = 'claude-3-5-haiku'
      } catch (claudeError) {
        const claudeErrorMsg = claudeError instanceof Error ? claudeError.message : String(claudeError)
        throw new Error(`Both GPT-4o-mini and Claude vision failed: ${claudeErrorMsg}`)
      }
    }

    const result: VisionInterpretationResult = {
      interpretedMarking: visionData.interpretation,
      rawResponse: visionData.rawResponse,
      model,
      timestamp: new Date().toISOString()
    }

    console.log(`Vision interpretation completed successfully using ${model}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        result,
        message: 'Vision interpretation completed successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in vision-interpreter function:', error)
    
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
