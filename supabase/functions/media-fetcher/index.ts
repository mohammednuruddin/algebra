import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MediaFetchRequest {
  sessionId: string
  mediaItemId: string
  searchQuery: string
  type: 'image' | 'diagram' | 'chart' | 'formula'
}

interface MediaAssetResult {
  id: string
  url: string
  storagePath: string
  sourceUrl: string
  metadata: {
    width?: number
    height?: number
    format?: string
    source: string
  }
}

// Fetch media from Unsplash
async function fetchFromUnsplash(query: string): Promise<{ url: string; sourceUrl: string; metadata: any }> {
  const accessKey = Deno.env.get('UNSPLASH_ACCESS_KEY')
  
  if (!accessKey) {
    throw new Error('Unsplash API key not configured')
  }

  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
    {
      headers: {
        'Authorization': `Client-ID ${accessKey}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.status}`)
  }

  const data = await response.json()
  
  if (!data.results || data.results.length === 0) {
    throw new Error('No images found for query')
  }

  const photo = data.results[0]
  
  return {
    url: photo.urls.regular,
    sourceUrl: photo.links.html,
    metadata: {
      width: photo.width,
      height: photo.height,
      format: 'jpg',
      source: 'unsplash',
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html
    }
  }
}

// Fetch media from Pexels
async function fetchFromPexels(query: string): Promise<{ url: string; sourceUrl: string; metadata: any }> {
  const apiKey = Deno.env.get('PEXELS_API_KEY')
  
  if (!apiKey) {
    throw new Error('Pexels API key not configured')
  }

  const response = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
    {
      headers: {
        'Authorization': apiKey,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Pexels API error: ${response.status}`)
  }

  const data = await response.json()
  
  if (!data.photos || data.photos.length === 0) {
    throw new Error('No images found for query')
  }

  const photo = data.photos[0]
  
  return {
    url: photo.src.large,
    sourceUrl: photo.url,
    metadata: {
      width: photo.width,
      height: photo.height,
      format: 'jpg',
      source: 'pexels',
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url
    }
  }
}

// Download and upload media to Supabase Storage
async function uploadToStorage(
  supabase: any,
  imageUrl: string,
  sessionId: string,
  mediaItemId: string
): Promise<string> {
  // Download image
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`)
  }

  const imageBlob = await imageResponse.blob()
  const arrayBuffer = await imageBlob.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  // Generate storage path
  const extension = imageUrl.split('.').pop()?.split('?')[0] || 'jpg'
  const storagePath = `${sessionId}/${mediaItemId}.${extension}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('media-assets')
    .upload(storagePath, uint8Array, {
      contentType: imageBlob.type || 'image/jpeg',
      upsert: true
    })

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('media-assets')
    .getPublicUrl(storagePath)

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

    const { sessionId, mediaItemId, searchQuery, type }: MediaFetchRequest = await req.json()

    if (!sessionId || !mediaItemId || !searchQuery) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Fetching media for ${mediaItemId}: ${searchQuery}`)

    // Try Unsplash first, fallback to Pexels
    let mediaData
    try {
      mediaData = await fetchFromUnsplash(searchQuery)
    } catch (unsplashError) {
      console.log('Unsplash failed, trying Pexels:', unsplashError.message)
      try {
        mediaData = await fetchFromPexels(searchQuery)
      } catch (pexelsError) {
        throw new Error(`Both Unsplash and Pexels failed: ${pexelsError.message}`)
      }
    }

    // Upload to storage
    const storagePath = await uploadToStorage(supabase, mediaData.url, sessionId, mediaItemId)

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('media-assets')
      .getPublicUrl(storagePath)

    // Insert media asset record
    const { data: assetRecord, error: insertError } = await supabase
      .from('lesson_media_assets')
      .insert({
        session_id: sessionId,
        kind: 'searched',
        storage_path: storagePath,
        metadata_json: {
          ...mediaData.metadata,
          type,
          searchQuery,
          mediaItemId,
          fetchedAt: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to insert media asset record: ${insertError.message}`)
    }

    const result: MediaAssetResult = {
      id: assetRecord.id,
      url: publicUrl,
      storagePath,
      sourceUrl: mediaData.sourceUrl,
      metadata: mediaData.metadata
    }

    console.log(`Media fetched and stored successfully: ${mediaItemId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        asset: result,
        message: 'Media fetched successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in media-fetcher function:', error)
    
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
