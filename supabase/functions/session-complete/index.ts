/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SessionCompleteRequest {
  sessionId: string
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

    const { sessionId }: SessionCompleteRequest = await req.json()

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: sessionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Completing session ${sessionId} for user ${user.id}`)

    // Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from('lesson_sessions')
      .select('id, user_id, status')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (session.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Session does not belong to user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (session.status === 'completed') {
      return new Response(
        JSON.stringify({ error: 'Session is already completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Invoke Session Summarizer agent
    console.log('Invoking Session Summarizer...')
    const { data: summarizerResult, error: summarizerError } = await supabase.functions.invoke(
      'session-summarizer',
      {
        body: { sessionId }
      }
    )

    if (summarizerError || !summarizerResult?.success) {
      throw new Error(`Session summarization failed: ${summarizerError?.message || 'Unknown error'}`)
    }

    const summary = summarizerResult.summary
    console.log(`Summary generated: ${summary.milestonesOverview.completed}/${summary.milestonesOverview.total} milestones completed`)

    // Update session status to "completed" and store summary
    const { data: updatedSession, error: updateError } = await supabase
      .from('lesson_sessions')
      .update({
        status: 'completed',
        summary_json: summary,
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update session: ${updateError.message}`)
    }

    console.log(`Session ${sessionId} completed successfully`)

    // Invoke Article Generator agent
    console.log('Invoking Article Generator...')
    const { data: articleResult, error: articleError } = await supabase.functions.invoke(
      'article-generator',
      {
        body: { sessionId }
      }
    )

    if (articleError || !articleResult?.success) {
      console.error(`Article generation failed: ${articleError?.message || 'Unknown error'}`)
      // Don't fail the entire completion if article generation fails
      // Return success with summary but without article data
      return new Response(
        JSON.stringify({
          success: true,
          session: updatedSession,
          summary,
          article: null,
          message: 'Lesson completed successfully (article generation failed)',
          warning: 'Article generation failed but lesson was completed'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const article = articleResult.article
    console.log(`Article generated: ${article.title}`)

    return new Response(
      JSON.stringify({
        success: true,
        session: updatedSession,
        summary,
        article,
        message: 'Lesson completed successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in session-complete function:', error)

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
