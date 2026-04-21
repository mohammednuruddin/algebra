# Canvas Analyze Integration Guide

## Overview

This guide explains how to integrate the Canvas Analyze endpoint into your frontend application to capture, upload, and analyze canvas snapshots during teaching sessions.

## Prerequisites

- Active lesson session (created via `/api/lesson/session/create`)
- Authenticated user with valid Supabase token
- Canvas element with learner drawings or image annotations

## Integration Steps

### 1. Capture Canvas Snapshot

Use the HTML Canvas API to capture the canvas as a base64-encoded image:

```typescript
// Capture canvas as base64 data URL
function captureCanvasSnapshot(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png', 0.95) // 95% quality
}

// Or capture with specific format
function captureCanvasSnapshotWebP(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/webp', 0.9)
}
```

### 2. Prepare Snapshot File Object

Create the snapshot file object with the required fields:

```typescript
interface SnapshotFile {
  name: string
  type: string
  base64Data: string
}

function prepareSnapshotFile(canvas: HTMLCanvasElement): SnapshotFile {
  const timestamp = Date.now()
  const base64Data = canvas.toDataURL('image/png', 0.95)
  
  return {
    name: `canvas-snapshot-${timestamp}.png`,
    type: 'image/png',
    base64Data
  }
}
```

### 3. Call Canvas Analyze Endpoint

Send the snapshot to the backend for analysis:

```typescript
interface CanvasAnalyzeRequest {
  sessionId: string
  turnId?: string
  snapshotFile: SnapshotFile
  snapshotType?: string
  context?: {
    currentMilestone?: string
    expectedConcepts?: string[]
    taskDescription?: string
  }
}

async function analyzeCanvasSnapshot(
  sessionId: string,
  canvas: HTMLCanvasElement,
  context?: CanvasAnalyzeRequest['context']
): Promise<any> {
  const snapshotFile = prepareSnapshotFile(canvas)
  
  const response = await fetch('/api/lesson/canvas/analyze', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId,
      snapshotFile,
      snapshotType: 'canvas_drawing',
      context
    })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to analyze canvas snapshot')
  }
  
  return await response.json()
}
```

### 4. Handle Analysis Results

Process the interpreted marking returned by the endpoint:

```typescript
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

function handleAnalysisResult(result: any) {
  const { interpretedMarking, snapshotId, storageUrl } = result
  
  console.log('Snapshot ID:', snapshotId)
  console.log('Storage URL:', storageUrl)
  console.log('Overall interpretation:', interpretedMarking.overallInterpretation)
  
  // Display identified shapes
  interpretedMarking.shapes.forEach(shape => {
    console.log(`Shape: ${shape.type} - ${shape.description} (${shape.confidence})`)
  })
  
  // Display extracted text
  interpretedMarking.text.forEach(text => {
    console.log(`Text: ${text.content} (${text.confidence})`)
  })
  
  // Display identified concepts
  interpretedMarking.concepts.forEach(concept => {
    console.log(`Concept: ${concept.name} - ${concept.description} (${concept.confidence})`)
  })
  
  return interpretedMarking
}
```

## Complete Example

### React Component with Konva Canvas

```typescript
import React, { useRef, useState } from 'react'
import { Stage, Layer, Line } from 'react-konva'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface CanvasDrawingProps {
  sessionId: string
  currentMilestone?: string
  expectedConcepts?: string[]
}

export function CanvasDrawing({ sessionId, currentMilestone, expectedConcepts }: CanvasDrawingProps) {
  const stageRef = useRef<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [interpretation, setInterpretation] = useState<any>(null)

  const handleMouseDown = (e: any) => {
    setIsDrawing(true)
    const pos = e.target.getStage().getPointerPosition()
    setLines([...lines, { points: [pos.x, pos.y] }])
  }

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return
    
    const stage = e.target.getStage()
    const point = stage.getPointerPosition()
    const lastLine = lines[lines.length - 1]
    lastLine.points = lastLine.points.concat([point.x, point.y])
    
    setLines([...lines.slice(0, -1), lastLine])
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
  }

  const analyzeDrawing = async () => {
    if (!stageRef.current) return
    
    setAnalyzing(true)
    
    try {
      // Get canvas from Konva stage
      const stage = stageRef.current
      const canvas = stage.toCanvas()
      const base64Data = canvas.toDataURL('image/png', 0.95)
      
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      
      // Call canvas analyze endpoint
      const response = await fetch('/api/lesson/canvas/analyze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          snapshotFile: {
            name: `canvas-snapshot-${Date.now()}.png`,
            type: 'image/png',
            base64Data
          },
          snapshotType: 'canvas_drawing',
          context: {
            currentMilestone,
            expectedConcepts,
            taskDescription: 'Learner drawing on canvas'
          }
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to analyze canvas')
      }
      
      const result = await response.json()
      setInterpretation(result.interpretedMarking)
      
      console.log('Analysis complete:', result)
    } catch (error) {
      console.error('Error analyzing canvas:', error)
      alert('Failed to analyze drawing. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  const clearCanvas = () => {
    setLines([])
    setInterpretation(null)
  }

  return (
    <div className="canvas-drawing">
      <Stage
        ref={stageRef}
        width={800}
        height={600}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ border: '1px solid #ccc', background: 'white' }}
      >
        <Layer>
          {lines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke="black"
              strokeWidth={2}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
          ))}
        </Layer>
      </Stage>
      
      <div className="controls" style={{ marginTop: '1rem' }}>
        <button onClick={analyzeDrawing} disabled={analyzing || lines.length === 0}>
          {analyzing ? 'Analyzing...' : 'Analyze Drawing'}
        </button>
        <button onClick={clearCanvas} disabled={lines.length === 0}>
          Clear Canvas
        </button>
      </div>
      
      {interpretation && (
        <div className="interpretation" style={{ marginTop: '1rem', padding: '1rem', background: '#f5f5f5' }}>
          <h3>Interpretation</h3>
          <p><strong>Overall:</strong> {interpretation.overallInterpretation}</p>
          <p><strong>Confidence:</strong> {(interpretation.confidence * 100).toFixed(0)}%</p>
          
          {interpretation.concepts.length > 0 && (
            <div>
              <h4>Identified Concepts:</h4>
              <ul>
                {interpretation.concepts.map((concept: any, i: number) => (
                  <li key={i}>{concept.name}: {concept.description}</li>
                ))}
              </ul>
            </div>
          )}
          
          {interpretation.shapes.length > 0 && (
            <div>
              <h4>Identified Shapes:</h4>
              <ul>
                {interpretation.shapes.map((shape: any, i: number) => (
                  <li key={i}>{shape.type}: {shape.description}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

## Best Practices

### 1. Optimize Image Quality

Balance image quality with file size:

```typescript
// High quality for detailed drawings
canvas.toDataURL('image/png', 0.95)

// Lower quality for simple sketches
canvas.toDataURL('image/webp', 0.8)
```

### 2. Provide Context

Always provide context to improve interpretation accuracy:

```typescript
const context = {
  currentMilestone: 'Understanding fractions',
  expectedConcepts: ['numerator', 'denominator', 'fraction bar'],
  taskDescription: 'Draw a visual representation of 3/4'
}
```

### 3. Handle Errors Gracefully

Implement proper error handling:

```typescript
try {
  const result = await analyzeCanvasSnapshot(sessionId, canvas, context)
  handleAnalysisResult(result)
} catch (error) {
  console.error('Canvas analysis failed:', error)
  // Show user-friendly error message
  showErrorNotification('Failed to analyze your drawing. Please try again.')
}
```

### 4. Show Loading States

Provide feedback during analysis:

```typescript
const [analyzing, setAnalyzing] = useState(false)

const analyze = async () => {
  setAnalyzing(true)
  try {
    const result = await analyzeCanvasSnapshot(sessionId, canvas)
    // Handle result
  } finally {
    setAnalyzing(false)
  }
}
```

### 5. Cache Results

Store interpretation results to avoid redundant API calls:

```typescript
const [interpretations, setInterpretations] = useState<Map<string, any>>(new Map())

const analyzeWithCache = async (snapshotId: string, canvas: HTMLCanvasElement) => {
  if (interpretations.has(snapshotId)) {
    return interpretations.get(snapshotId)
  }
  
  const result = await analyzeCanvasSnapshot(sessionId, canvas)
  interpretations.set(snapshotId, result.interpretedMarking)
  setInterpretations(new Map(interpretations))
  
  return result.interpretedMarking
}
```

## Troubleshooting

### Issue: "Missing authorization header"

**Solution**: Ensure you're passing the Supabase auth token in the Authorization header:

```typescript
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token

fetch('/api/lesson/canvas/analyze', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

### Issue: "Session not found"

**Solution**: Verify the session exists and belongs to the authenticated user:

```typescript
const { data: session } = await supabase
  .from('lesson_sessions')
  .select('id')
  .eq('id', sessionId)
  .single()

if (!session) {
  console.error('Session not found')
}
```

### Issue: "Failed to upload snapshot"

**Solution**: Check that the base64 data is valid and the file size is under 5 MB:

```typescript
// Validate base64 data
if (!base64Data.startsWith('data:image/')) {
  throw new Error('Invalid base64 image data')
}

// Check file size (approximate)
const sizeInBytes = (base64Data.length * 3) / 4
const sizeInMB = sizeInBytes / (1024 * 1024)

if (sizeInMB > 5) {
  throw new Error('Image size exceeds 5 MB limit')
}
```

## Related Documentation

- [Vision Interpreter README](../vision-interpreter/README.md)
- [Session Create README](../session-create/README.md)
- [Canvas Snapshots Database Schema](../../../migrations/20260419175159_create_core_tables.sql)
- [Storage Buckets Configuration](../../../migrations/20260419175543_create_storage_buckets.sql)
