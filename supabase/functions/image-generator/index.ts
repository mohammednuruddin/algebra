import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImageGenerationRequest {
  sessionId: string
  mediaItemId: string
  prompt: string
  type: 'image' | 'diagram' | 'chart' | 'formula'
}

interface GeneratedImageResult {
  id: string
  url: string
  storagePath: string
  metadata: {
    prompt: string
    model: string
    generatedAt: string
  }
}

// Generate image using DALL-E 3
async function generateWithDALLE(prompt: string): Promise<{ url: string; metadata: any }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  // Enhance prompt for educational content
  const enhancedPrompt = `Educational diagram or illustration: ${prompt}. Style: clear, simple, suitable for learning. High quality, well-labeled if applicable.`

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: enhancedPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard', // Faster generation
      style: 'natural'
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`DALL-E API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  
  if (!data.data || data.data.length === 0) {
    throw new Error('No image generated')
  }

  return {
    url: data.data[0].url,
    metadata: {
      model: 'dall-e-3',
      revisedPrompt: data.data[0].revised_prompt,
      size: '1024x1024',
      quality: 'standard'
    }
  }
}

// Generate image using Stable Diffusion (via Replicate or similar)
async function generateWithStableDiffusion(prompt: string): Promise<{ url: string; metadata: any }> {
  const apiKey = Deno.env.get('REPLICATE_API_KEY')
  
  if (!apiKey) {
    throw new Error('Replicate API key not configured')
  }

  // Enhance prompt for educational content
  const enhancedPrompt = `${prompt}, educational illustration, clear and simple, high quality, detailed`

  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
      input: {
        prompt: enhancedPrompt,
        width: 1024,
        height: 1024,
        num_outputs: 1
      }
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Replicate API error: ${response.status} - ${error}`)
  }

  const prediction = await response.json()
  
  // Poll for completion
  let result = prediction
  while (result.status !== 'succeeded' && result.status !== 'failed') {
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
      },
    })
    
    result = await pollResponse.json()
  }

  if (result.status === 'failed') {
    throw new Error('Image generation failed')
  }

  return {
    url: result.output[0],
    metadata: {
      model: 'stable-diffusion-xl',
      prompt: enhancedPrompt,
      size: '1024x1024'
    }
  }
}

// Download and upload image to Supabase Storage
async function uploadToStorage(
  supabase: any,
  imageUrl: string,
  sessionId: string,
  mediaItemId: string
): Promise<string> {
  // Download image
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.status}`)
  }

  const imageBlob = await imageResponse.blob()
  const arrayBuffer = await imageBlob.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  // Generate storage path
  const storagePath = `${sessionId}/${mediaItemId}_generated.png`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('media-assets')
    .upload(storagePath, uint8Array, {
      contentType: 'image/png',
      upsert: true
    })

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  return storagePath
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { sessionId, mediaItemId, prompt, type }: ImageGenerationRequest = await req.json()

    if (!sessionId || !mediaItemId || !prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Generating image for ${mediaItemId}: ${prompt}`)

    // Try DALL-E first, fallback to Stable Diffusion
    let imageData
    try {
      imageData = await generateWithDALLE(prompt)
    } catch (dalleError) {
      console.log('DALL-E failed, trying Stable Diffusion:', dalleError.message)
      try {
        imageData = await generateWithStableDiffusion(prompt)
      } catch (sdError) {
        throw new Error(`Both DALL-E and Stable Diffusion failed: ${sdError.message}`)
      }
    }

    // Upload to storage
    const storagePath = await uploadToStorage(supabase, imageData.url, sessionId, mediaItemId)

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('media-assets')
      .getPublicUrl(storagePath)

    // Insert media asset record
    const { data: assetRecord, error: insertError } = await supabase
      .from('lesson_media_assets')
      .insert({
        session_id: sessionId,
        kind: 'generated',
        storage_path: storagePath,
        metadata_json: {
          ...imageData.metadata,
          type,
          originalPrompt: prompt,
          mediaItemId,
          generatedAt: new Date().toISOString(),
          source: 'generated'
        }
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to insert media asset record: ${insertError.message}`)
    }

    const result: GeneratedImageResult = {
      id: assetRecord.id,
      url: publicUrl,
      storagePath,
      metadata: {
        prompt,
        model: imageData.metadata.model,
        generatedAt: new Date().toISOString()
      }
    }

    console.log(`Image generated and stored successfully: ${mediaItemId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        asset: result,
        message: 'Image generated successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in image-generator function:', error)
    
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
