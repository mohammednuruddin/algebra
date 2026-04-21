/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CanvasAnalyzeRequest {
  sessionId: string
  turnId?: string
  snapshotFile: {
    name: string
    type: string
    base64Data: string
  }
  snapshotType?: string
  context?: {
    currentMilestone?: string
    expectedConcepts?: string[]
    taskDescription?: string
  }
}

interface CanvasAnalyzeResponse {
  success: boolean
  snapshotId: string
  storagePath: string
  storageUrl: string
  interpretedMarking: any
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

    const { 
      sessionId, 
      turnId, 
      snapshotFile, 
      snapshotType,
      context 
    }: CanvasAnalyzeRequest = await req.json()

    if (!sessionId || !snapshotFile) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId and snapshotFile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Analyzing canvas snapshot for session ${sessionId}${turnId ? `, turn ${turnId}` : ''}`)

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('lesson_sessions')
      .select('id, user_id')
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

    // Step 1: Store snapshot in Supabase Storage
    const timestamp = Date.now()
    const fileExtension = snapshotFile.type.split('/')[1] || 'png'
    const fileName = `${sessionId}_${timestamp}.${fileExtension}`
    const storagePath = `${user.id}/${fileName}`

    console.log(`Uploading snapshot to storage: ${storagePath}`)

    // Convert base64 to binary
    const base64Data = snapshotFile.base64Data.includes(',') 
      ? snapshotFile.base64Data.split(',')[1] 
      : snapshotFile.base64Data
    
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('canvas-snapshots')
      .upload(storagePath, binaryData, {
        contentType: snapshotFile.type,
        upsert: false
      })

    if (uploadError) {
      throw new Error(`Failed to upload snapshot: ${uploadError.message}`)
    }

    console.log(`Snapshot uploaded successfully: ${uploadData.path}`)

    // Get public URL for the snapshot
    const { data: urlData } = supabase.storage
      .from('canvas-snapshots')
      .getPublicUrl(storagePath)

    const imageUrl = urlData.publicUrl

    // Step 2: Invoke Vision Interpreter agent
    console.log('Invoking vision interpreter...')
    
    const { data: visionResult, error: visionError } = await supabase.functions.invoke(
      'vision-interpreter',
      {
        body: {
          sessionId,
          turnId,
          imageUrl,
          context
        }
      }
    )

    if (visionError || !visionResult?.success) {
      console.error('Vision interpretation failed:', visionError)
      throw new Error(`Vision interpretation failed: ${visionError?.message || 'Unknown error'}`)
    }

    const interpretedMarking = visionResult.result.interpretedMarking
    console.log('Vision interpretation completed successfully')

    // Step 3: Insert canvas_snapshots record
    const { data: snapshotRecord, error: snapshotError } = await supabase
      .from('canvas_snapshots')
      .insert({
        session_id: sessionId,
        turn_id: turnId || null,
        storage_path: storagePath,
        snapshot_type: snapshotType || 'canvas_drawing',
        interpreter_result_json: {
          interpretedMarking,
          model: visionResult.result.model,
          timestamp: visionResult.result.timestamp,
          rawResponse: visionResult.result.rawResponse
        }
      })
      .select()
      .single()

    if (snapshotError) {
      throw new Error(`Failed to insert canvas snapshot record: ${snapshotError.message}`)
    }

    console.log(`Canvas snapshot record created: ${snapshotRecord.id}`)

    // Step 4: Return interpreted marking to frontend
    const response: CanvasAnalyzeResponse = {
      success: true,
      snapshotId: snapshotRecord.id,
      storagePath,
      storageUrl: imageUrl,
      interpretedMarking,
      message: 'Canvas snapshot analyzed successfully'
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in canvas-analyze function:', error)

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
