/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TurnRespondRequest {
  sessionId: string
  learnerInput: {
    mode: 'voice' | 'text' | 'canvas_draw' | 'canvas_mark' | 'image_annotation' | 'selection' | 'mixed'
    raw: {
      text?: string
      audioUrl?: string
      canvasSnapshotUrl?: string
      imageAnnotationUrl?: string
      selection?: string | number
    }
    interpreted?: {
      text?: string
      intent?: string
      confidence?: number
      markings?: Array<{
        type: string
        target?: string
        coordinates?: { x: number; y: number; width?: number; height?: number }
        confidence: number
        meaning?: string
      }>
    }
  }
}

interface TurnRespondResponse {
  success: boolean
  turnId: string
  teacherResponse: any
  progressResult: any
  message: string
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

    const { sessionId, learnerInput }: TurnRespondRequest = await req.json()

    if (!sessionId || !learnerInput) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId and learnerInput' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing turn response for session ${sessionId}`)

    // Step 1: Verify session belongs to user
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
        JSON.stringify({ error: 'Unauthorized access to session' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (session.status === 'completed') {
      return new Response(
        JSON.stringify({ error: 'Session is already completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Get next turn index
    const { data: turnCount, error: countError } = await supabase
      .from('lesson_turns')
      .select('turn_index', { count: 'exact', head: false })
      .eq('session_id', sessionId)
      .order('turn_index', { ascending: false })
      .limit(1)

    if (countError) {
      throw new Error(`Failed to get turn count: ${countError.message}`)
    }

    const nextTurnIndex = turnCount && turnCount.length > 0 
      ? turnCount[0].turn_index + 1 
      : 1

    console.log(`Creating turn ${nextTurnIndex}`)

    // Step 3: Insert lesson_turns record with raw input
    const { data: turnRecord, error: turnError } = await supabase
      .from('lesson_turns')
      .insert({
        session_id: sessionId,
        turn_index: nextTurnIndex,
        actor: 'learner',
        input_mode: learnerInput.mode,
        raw_input_json: {
          mode: learnerInput.mode,
          raw: learnerInput.raw,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (turnError) {
      throw new Error(`Failed to insert turn record: ${turnError.message}`)
    }

    console.log(`Turn record created: ${turnRecord.id}`)

    // Step 4: Invoke Teacher Conductor agent
    console.log('Invoking Teacher Conductor...')
    
    const { data: conductorResult, error: conductorError } = await supabase.functions.invoke(
      'teacher-conductor',
      {
        body: {
          sessionId,
          turnId: turnRecord.id,
          learnerInput
        }
      }
    )

    if (conductorError || !conductorResult?.success) {
      console.error('Teacher Conductor failed:', conductorError)
      throw new Error(`Teacher Conductor failed: ${conductorError?.message || 'Unknown error'}`)
    }

    const teacherResponse = conductorResult.teacherResponse
    const progressResult = conductorResult.progressResult

    console.log('Teacher Conductor completed successfully')

    // Note: Teacher Conductor already updates:
    // - lesson_turns record with interpreted_input_json and teacher_response_json
    // - lesson_milestone_progress records
    // - lesson_sessions current_milestone_id if milestone changed
    // So we don't need to do those updates here

    // Step 5: Return teacher response to frontend
    const response: TurnRespondResponse = {
      success: true,
      turnId: turnRecord.id,
      teacherResponse,
      progressResult,
      message: 'Turn processed successfully'
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in turn-respond function:', error)

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
