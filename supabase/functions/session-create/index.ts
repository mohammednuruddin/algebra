import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SessionCreateRequest {
  topicPrompt: string
}

interface MediaItem {
  id: string
  type: 'image' | 'diagram' | 'chart' | 'formula'
  searchQuery: string
  source: 'fetch' | 'generate'
}

// Process media items (fetch or generate)
async function processMediaItems(
  supabase: any,
  sessionId: string,
  mediaItems: MediaItem[]
): Promise<void> {
  const promises = mediaItems.map(async (item) => {
    try {
      if (item.source === 'fetch') {
        // Call media-fetcher function
        const { error } = await supabase.functions.invoke('media-fetcher', {
          body: {
            sessionId,
            mediaItemId: item.id,
            searchQuery: item.searchQuery,
            type: item.type
          }
        })
        
        if (error) {
          console.error(`Failed to fetch media ${item.id}:`, error)
        }
      } else {
        // Call image-generator function
        const { error } = await supabase.functions.invoke('image-generator', {
          body: {
            sessionId,
            mediaItemId: item.id,
            prompt: item.searchQuery,
            type: item.type
          }
        })
        
        if (error) {
          console.error(`Failed to generate image ${item.id}:`, error)
        }
      }
    } catch (error) {
      console.error(`Error processing media item ${item.id}:`, error)
      // Continue with other items even if one fails
    }
  })

  // Wait for all media processing to complete
  await Promise.allSettled(promises)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { topicPrompt }: SessionCreateRequest = await req.json()

    if (!topicPrompt || topicPrompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Topic prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Creating session for user ${user.id}: ${topicPrompt}`)

    // Step 1: Create session record with status "planning"
    const { data: session, error: sessionError } = await supabase
      .from('lesson_sessions')
      .insert({
        user_id: user.id,
        topic_prompt: topicPrompt,
        status: 'planning'
      })
      .select()
      .single()

    if (sessionError) {
      throw new Error(`Failed to create session: ${sessionError.message}`)
    }

    console.log(`Session created: ${session.id}`)

    // Step 2: Invoke Lesson Planner
    const { data: plannerResult, error: plannerError } = await supabase.functions.invoke(
      'lesson-planner',
      {
        body: {
          sessionId: session.id,
          topicPrompt
        }
      }
    )

    if (plannerError || !plannerResult?.success) {
      throw new Error(`Lesson planning failed: ${plannerError?.message || 'Unknown error'}`)
    }

    const lessonPlan = plannerResult.lessonPlan
    console.log(`Lesson plan generated with ${lessonPlan.milestones.length} milestones`)

    // Step 3: Invoke Media Planner
    const { data: mediaPlannerResult, error: mediaPlannerError } = await supabase.functions.invoke(
      'media-planner',
      {
        body: {
          sessionId: session.id,
          lessonPlan
        }
      }
    )

    if (mediaPlannerError || !mediaPlannerResult?.success) {
      console.error('Media planning failed:', mediaPlannerError)
      // Continue without media - not critical
    }

    const mediaManifest = mediaPlannerResult?.manifest
    console.log(`Media manifest generated with ${mediaManifest?.totalItems || 0} items`)

    // Step 4: Process media assets (fetch or generate)
    if (mediaManifest && mediaManifest.items && mediaManifest.items.length > 0) {
      console.log('Processing media assets...')
      await processMediaItems(supabase, session.id, mediaManifest.items)
      console.log('Media processing completed')
    }

    // Step 5: Update session status to "ready"
    const { error: updateError } = await supabase
      .from('lesson_sessions')
      .update({
        status: 'ready',
        current_milestone_id: lessonPlan.milestones[0]?.id || null
      })
      .eq('id', session.id)

    if (updateError) {
      throw new Error(`Failed to update session status: ${updateError.message}`)
    }

    console.log(`Session ${session.id} is ready`)

    // Fetch complete session data
    const { data: completeSession, error: fetchError } = await supabase
      .from('lesson_sessions')
      .select('*')
      .eq('id', session.id)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch session: ${fetchError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: completeSession,
        lessonPlan,
        mediaManifest,
        message: 'Session created and ready for teaching'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in session-create function:', error)

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
