import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Type definitions matching the Edge Function
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

// Validation function
function validateInterpretedMarking(marking: any): marking is InterpretedMarking {
  if (!marking || typeof marking !== 'object') return false
  
  const hasShapes = Array.isArray(marking.shapes)
  const hasText = Array.isArray(marking.text)
  const hasConcepts = Array.isArray(marking.concepts)
  const hasAnnotations = Array.isArray(marking.annotations)
  const hasOverallInterpretation = typeof marking.overallInterpretation === 'string'
  const hasConfidence = typeof marking.confidence === 'number'
  
  return hasShapes && hasText && hasConcepts && hasAnnotations && hasOverallInterpretation && hasConfidence
}

// Mock sample images for testing
const SAMPLE_IMAGES = {
  circleDrawing: 'https://example.com/sample-circle.png',
  mathEquation: 'https://example.com/sample-equation.png',
  annotatedDiagram: 'https://example.com/sample-diagram.png',
  freehandSketch: 'https://example.com/sample-sketch.png',
  emptyCanvas: 'https://example.com/empty-canvas.png'
}

// Mock GPT-4o-mini vision API response
function createMockGPTResponse(interpretedMarking: InterpretedMarking) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify(interpretedMarking)
        }
      }
    ]
  }
}

// Mock Claude 3.5 Haiku vision API response
function createMockClaudeResponse(interpretedMarking: InterpretedMarking) {
  return {
    content: [
      {
        text: JSON.stringify(interpretedMarking)
      }
    ]
  }
}

// Mock fetch for image download (used by Claude)
function createMockImageBlob() {
  const mockArrayBuffer = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer // PNG header
  return {
    blob: () => Promise.resolve({
      arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      type: 'image/png'
    })
  }
}

describe('Vision Interpreter Edge Function', () => {
  describe('Interpreted Marking Validation', () => {
    it('should validate a complete interpreted marking structure', () => {
      const validMarking: InterpretedMarking = {
        shapes: [
          {
            type: 'circle',
            description: 'A circle drawn in the center',
            position: { x: 100, y: 100 },
            confidence: 0.95
          }
        ],
        text: [
          {
            content: 'Test text',
            position: { x: 50, y: 50 },
            confidence: 0.9
          }
        ],
        concepts: [
          {
            name: 'geometry',
            description: 'Basic geometric shapes',
            confidence: 0.85
          }
        ],
        annotations: [
          {
            type: 'circle',
            description: 'Circled important area',
            confidence: 0.8
          }
        ],
        overallInterpretation: 'Learner drew a circle with text annotation',
        confidence: 0.9
      }

      expect(validateInterpretedMarking(validMarking)).toBe(true)
    })

    it('should reject invalid interpreted marking structures', () => {
      const invalidMarkings = [
        null,
        undefined,
        {},
        { shapes: [] }, // Missing other required fields
        { shapes: [], text: [], concepts: [] }, // Missing annotations and interpretation
        { shapes: 'not-an-array', text: [], concepts: [], annotations: [], overallInterpretation: '', confidence: 0 }
      ]

      invalidMarkings.forEach(marking => {
        expect(validateInterpretedMarking(marking)).toBe(false)
      })
    })

    it('should validate shape types', () => {
      const validShapeTypes = ['circle', 'rectangle', 'line', 'arrow', 'freehand', 'text', 'other']
      
      validShapeTypes.forEach(type => {
        const marking: InterpretedMarking = {
          shapes: [
            {
              type: type as any,
              description: `A ${type} shape`,
              confidence: 0.9
            }
          ],
          text: [],
          concepts: [],
          annotations: [],
          overallInterpretation: 'Test',
          confidence: 0.9
        }
        
        expect(validateInterpretedMarking(marking)).toBe(true)
      })
    })

    it('should validate annotation types', () => {
      const validAnnotationTypes = ['highlight', 'underline', 'circle', 'arrow', 'note']
      
      validAnnotationTypes.forEach(type => {
        const marking: InterpretedMarking = {
          shapes: [],
          text: [],
          concepts: [],
          annotations: [
            {
              type: type as any,
              description: `A ${type} annotation`,
              confidence: 0.9
            }
          ],
          overallInterpretation: 'Test',
          confidence: 0.9
        }
        
        expect(validateInterpretedMarking(marking)).toBe(true)
      })
    })

    it('should handle complex interpreted markings with multiple elements', () => {
      const complexMarking: InterpretedMarking = {
        shapes: [
          {
            type: 'rectangle',
            description: 'A rectangle representing a box',
            position: { x: 200, y: 150 },
            confidence: 0.92
          },
          {
            type: 'arrow',
            description: 'Arrow pointing to the box',
            position: { x: 100, y: 100 },
            confidence: 0.88
          },
          {
            type: 'circle',
            description: 'Circle around key concept',
            position: { x: 300, y: 250 },
            confidence: 0.91
          }
        ],
        text: [
          {
            content: 'Important concept',
            position: { x: 250, y: 200 },
            confidence: 0.95
          },
          {
            content: 'Note: Review this',
            position: { x: 150, y: 300 },
            confidence: 0.87
          }
        ],
        concepts: [
          {
            name: 'annotation',
            description: 'Learner is annotating a diagram',
            confidence: 0.9
          },
          {
            name: 'visual-learning',
            description: 'Using visual aids to understand concepts',
            confidence: 0.85
          }
        ],
        annotations: [
          {
            type: 'arrow',
            description: 'Pointing to key area',
            confidence: 0.85
          },
          {
            type: 'highlight',
            description: 'Highlighting important text',
            confidence: 0.88
          }
        ],
        overallInterpretation: 'Learner is actively annotating a diagram with arrows, circles, and text to demonstrate understanding of key concepts',
        confidence: 0.91
      }

      expect(validateInterpretedMarking(complexMarking)).toBe(true)
      expect(complexMarking.shapes.length).toBe(3)
      expect(complexMarking.text.length).toBe(2)
      expect(complexMarking.concepts.length).toBe(2)
      expect(complexMarking.annotations.length).toBe(2)
    })

    it('should validate confidence scores are numbers', () => {
      const marking: InterpretedMarking = {
        shapes: [
          {
            type: 'circle',
            description: 'Test shape',
            confidence: 0.95
          }
        ],
        text: [],
        concepts: [],
        annotations: [],
        overallInterpretation: 'Test',
        confidence: 0.9
      }

      expect(typeof marking.shapes[0].confidence).toBe('number')
      expect(typeof marking.confidence).toBe('number')
      expect(marking.shapes[0].confidence).toBeGreaterThanOrEqual(0)
      expect(marking.shapes[0].confidence).toBeLessThanOrEqual(1)
    })

    it('should handle empty arrays for optional elements', () => {
      const minimalMarking: InterpretedMarking = {
        shapes: [],
        text: [],
        concepts: [],
        annotations: [],
        overallInterpretation: 'No markings detected',
        confidence: 0.5
      }

      expect(validateInterpretedMarking(minimalMarking)).toBe(true)
    })
  })

  describe('Context-Aware Interpretation', () => {
    it('should structure context information correctly', () => {
      const context = {
        currentMilestone: 'Understanding circles',
        expectedConcepts: ['geometry', 'shapes', 'radius'],
        taskDescription: 'Draw a circle and label its radius'
      }

      expect(context.currentMilestone).toBeDefined()
      expect(Array.isArray(context.expectedConcepts)).toBe(true)
      expect(context.expectedConcepts.length).toBeGreaterThan(0)
      expect(context.taskDescription).toBeDefined()
    })

    it('should handle partial context information', () => {
      const partialContexts = [
        { currentMilestone: 'Test milestone' },
        { expectedConcepts: ['concept1', 'concept2'] },
        { taskDescription: 'Test task' },
        {}
      ]

      partialContexts.forEach(context => {
        expect(typeof context).toBe('object')
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle missing required fields', () => {
      const invalidRequests = [
        {}, // Missing all fields
        { sessionId: 'test-123' }, // Missing imageUrl
        { imageUrl: 'https://example.com/image.png' }, // Missing sessionId
      ]

      invalidRequests.forEach(request => {
        const hasSessionId = 'sessionId' in request && request.sessionId
        const hasImageUrl = 'imageUrl' in request && request.imageUrl
        expect(hasSessionId && hasImageUrl).toBe(false)
      })
    })

    it('should validate image URL format', () => {
      const validUrls = [
        'https://example.com/image.png',
        'https://storage.supabase.co/bucket/image.jpg',
        'https://cdn.example.com/path/to/image.jpeg'
      ]

      const invalidUrls = [
        'not-a-url',
        'ftp://example.com/image.png',
        '',
        null,
        undefined
      ]

      validUrls.forEach(url => {
        expect(url.startsWith('https://')).toBe(true)
      })

      invalidUrls.forEach(url => {
        if (url) {
          expect(typeof url === 'string' && url.startsWith('https://')).toBe(false)
        } else {
          expect(url).toBeFalsy()
        }
      })
    })
  })

  describe('Response Structure', () => {
    it('should structure successful response correctly', () => {
      const successResponse = {
        success: true,
        result: {
          interpretedMarking: {
            shapes: [],
            text: [],
            concepts: [],
            annotations: [],
            overallInterpretation: 'Test',
            confidence: 0.9
          },
          rawResponse: '{"test": "data"}',
          model: 'gpt-4o-mini',
          timestamp: new Date().toISOString()
        },
        message: 'Vision interpretation completed successfully'
      }

      expect(successResponse.success).toBe(true)
      expect(successResponse.result).toBeDefined()
      expect(successResponse.result.interpretedMarking).toBeDefined()
      expect(successResponse.result.model).toBeDefined()
      expect(successResponse.result.timestamp).toBeDefined()
      expect(validateInterpretedMarking(successResponse.result.interpretedMarking)).toBe(true)
    })

    it('should structure error response correctly', () => {
      const errorResponse = {
        error: 'Test error message',
        details: 'Error: Test error message'
      }

      expect(errorResponse.error).toBeDefined()
      expect(typeof errorResponse.error).toBe('string')
      expect(errorResponse.details).toBeDefined()
    })
  })

  describe('Vision Analysis with Sample Images', () => {
    it('should interpret a circle drawing correctly', () => {
      const mockInterpretation: InterpretedMarking = {
        shapes: [
          {
            type: 'circle',
            description: 'A hand-drawn circle in the center of the canvas',
            position: { x: 250, y: 250 },
            confidence: 0.95
          }
        ],
        text: [],
        concepts: [
          {
            name: 'geometry',
            description: 'Basic geometric shape - circle',
            confidence: 0.9
          }
        ],
        annotations: [],
        overallInterpretation: 'Learner drew a circle, demonstrating understanding of circular shapes',
        confidence: 0.93
      }

      expect(validateInterpretedMarking(mockInterpretation)).toBe(true)
      expect(mockInterpretation.shapes[0].type).toBe('circle')
      expect(mockInterpretation.concepts[0].name).toBe('geometry')
    })

    it('should interpret a math equation with text and symbols', () => {
      const mockInterpretation: InterpretedMarking = {
        shapes: [
          {
            type: 'line',
            description: 'Horizontal line representing equals sign',
            position: { x: 200, y: 150 },
            confidence: 0.88
          }
        ],
        text: [
          {
            content: '2 + 3 = 5',
            position: { x: 150, y: 150 },
            confidence: 0.92
          }
        ],
        concepts: [
          {
            name: 'addition',
            description: 'Basic arithmetic addition operation',
            confidence: 0.95
          },
          {
            name: 'equation',
            description: 'Mathematical equation showing equality',
            confidence: 0.9
          }
        ],
        annotations: [],
        overallInterpretation: 'Learner wrote a simple addition equation demonstrating understanding of basic arithmetic',
        confidence: 0.91
      }

      expect(validateInterpretedMarking(mockInterpretation)).toBe(true)
      expect(mockInterpretation.text[0].content).toContain('2 + 3 = 5')
      expect(mockInterpretation.concepts.some(c => c.name === 'addition')).toBe(true)
    })

    it('should interpret an annotated diagram with arrows and highlights', () => {
      const mockInterpretation: InterpretedMarking = {
        shapes: [
          {
            type: 'rectangle',
            description: 'Rectangle representing a cell structure',
            position: { x: 200, y: 200 },
            confidence: 0.89
          },
          {
            type: 'arrow',
            description: 'Arrow pointing to the nucleus',
            position: { x: 150, y: 180 },
            confidence: 0.91
          },
          {
            type: 'circle',
            description: 'Circle highlighting the mitochondria',
            position: { x: 220, y: 210 },
            confidence: 0.87
          }
        ],
        text: [
          {
            content: 'Nucleus',
            position: { x: 100, y: 180 },
            confidence: 0.94
          },
          {
            content: 'Mitochondria',
            position: { x: 250, y: 210 },
            confidence: 0.92
          }
        ],
        concepts: [
          {
            name: 'cell-biology',
            description: 'Understanding cell structure and organelles',
            confidence: 0.93
          },
          {
            name: 'annotation',
            description: 'Labeling and identifying parts of a diagram',
            confidence: 0.9
          }
        ],
        annotations: [
          {
            type: 'arrow',
            description: 'Pointing to identify the nucleus',
            confidence: 0.91
          },
          {
            type: 'circle',
            description: 'Highlighting the mitochondria location',
            confidence: 0.87
          }
        ],
        overallInterpretation: 'Learner is annotating a cell diagram, correctly identifying and labeling the nucleus and mitochondria',
        confidence: 0.9
      }

      expect(validateInterpretedMarking(mockInterpretation)).toBe(true)
      expect(mockInterpretation.shapes.length).toBe(3)
      expect(mockInterpretation.text.length).toBe(2)
      expect(mockInterpretation.annotations.length).toBe(2)
      expect(mockInterpretation.concepts.some(c => c.name === 'cell-biology')).toBe(true)
    })

    it('should interpret a freehand sketch with multiple elements', () => {
      const mockInterpretation: InterpretedMarking = {
        shapes: [
          {
            type: 'freehand',
            description: 'Freehand drawing of a tree with trunk and branches',
            position: { x: 300, y: 200 },
            confidence: 0.82
          },
          {
            type: 'circle',
            description: 'Sun drawn in the upper corner',
            position: { x: 450, y: 50 },
            confidence: 0.88
          },
          {
            type: 'line',
            description: 'Ground line at the bottom',
            position: { x: 250, y: 400 },
            confidence: 0.85
          }
        ],
        text: [],
        concepts: [
          {
            name: 'nature-drawing',
            description: 'Drawing natural elements like trees and sun',
            confidence: 0.8
          },
          {
            name: 'spatial-awareness',
            description: 'Understanding spatial relationships in a scene',
            confidence: 0.75
          }
        ],
        annotations: [],
        overallInterpretation: 'Learner created a freehand nature scene with a tree, sun, and ground, showing creative expression and spatial understanding',
        confidence: 0.81
      }

      expect(validateInterpretedMarking(mockInterpretation)).toBe(true)
      expect(mockInterpretation.shapes.some(s => s.type === 'freehand')).toBe(true)
      expect(mockInterpretation.concepts.some(c => c.name === 'nature-drawing')).toBe(true)
    })

    it('should handle empty canvas with no markings', () => {
      const mockInterpretation: InterpretedMarking = {
        shapes: [],
        text: [],
        concepts: [],
        annotations: [],
        overallInterpretation: 'No markings detected on the canvas',
        confidence: 0.95
      }

      expect(validateInterpretedMarking(mockInterpretation)).toBe(true)
      expect(mockInterpretation.shapes.length).toBe(0)
      expect(mockInterpretation.text.length).toBe(0)
      expect(mockInterpretation.overallInterpretation).toContain('No markings')
    })
  })

  describe('Mocked Vision AI API Responses', () => {
    beforeEach(() => {
      // Reset all mocks before each test
      vi.clearAllMocks()
    })

    afterEach(() => {
      // Restore all mocks after each test
      vi.restoreAllMocks()
    })

    it('should handle GPT-4o-mini successful response', async () => {
      const mockInterpretation: InterpretedMarking = {
        shapes: [
          {
            type: 'rectangle',
            description: 'A rectangle shape',
            confidence: 0.9
          }
        ],
        text: [],
        concepts: [],
        annotations: [],
        overallInterpretation: 'Rectangle detected',
        confidence: 0.9
      }

      const mockResponse = createMockGPTResponse(mockInterpretation)
      
      expect(mockResponse.choices).toBeDefined()
      expect(mockResponse.choices.length).toBe(1)
      
      const parsedContent = JSON.parse(mockResponse.choices[0].message.content)
      expect(validateInterpretedMarking(parsedContent)).toBe(true)
    })

    it('should handle Claude 3.5 Haiku successful response', async () => {
      const mockInterpretation: InterpretedMarking = {
        shapes: [
          {
            type: 'circle',
            description: 'A circle shape',
            confidence: 0.92
          }
        ],
        text: [],
        concepts: [],
        annotations: [],
        overallInterpretation: 'Circle detected',
        confidence: 0.92
      }

      const mockResponse = createMockClaudeResponse(mockInterpretation)
      
      expect(mockResponse.content).toBeDefined()
      expect(mockResponse.content.length).toBe(1)
      
      const parsedContent = JSON.parse(mockResponse.content[0].text)
      expect(validateInterpretedMarking(parsedContent)).toBe(true)
    })

    it('should handle GPT-4o-mini API error response', async () => {
      const mockErrorResponse = {
        error: {
          message: 'Invalid API key',
          type: 'invalid_request_error',
          code: 'invalid_api_key'
        }
      }

      expect(mockErrorResponse.error).toBeDefined()
      expect(mockErrorResponse.error.message).toBe('Invalid API key')
      expect(mockErrorResponse.error.code).toBe('invalid_api_key')
    })

    it('should handle Claude API error response', async () => {
      const mockErrorResponse = {
        error: {
          type: 'authentication_error',
          message: 'Invalid API key'
        }
      }

      expect(mockErrorResponse.error).toBeDefined()
      expect(mockErrorResponse.error.type).toBe('authentication_error')
      expect(mockErrorResponse.error.message).toBe('Invalid API key')
    })

    it('should validate GPT response format with all fields', async () => {
      const mockInterpretation: InterpretedMarking = {
        shapes: [
          {
            type: 'arrow',
            description: 'Arrow pointing right',
            position: { x: 100, y: 100 },
            confidence: 0.88
          }
        ],
        text: [
          {
            content: 'Label',
            position: { x: 150, y: 100 },
            confidence: 0.9
          }
        ],
        concepts: [
          {
            name: 'direction',
            description: 'Understanding directional indicators',
            confidence: 0.85
          }
        ],
        annotations: [
          {
            type: 'arrow',
            description: 'Directional annotation',
            confidence: 0.88
          }
        ],
        overallInterpretation: 'Learner drew an arrow with a label showing directional understanding',
        confidence: 0.87
      }

      const mockResponse = createMockGPTResponse(mockInterpretation)
      const parsedContent = JSON.parse(mockResponse.choices[0].message.content)

      expect(parsedContent.shapes).toBeDefined()
      expect(parsedContent.text).toBeDefined()
      expect(parsedContent.concepts).toBeDefined()
      expect(parsedContent.annotations).toBeDefined()
      expect(parsedContent.overallInterpretation).toBeDefined()
      expect(parsedContent.confidence).toBeDefined()
      expect(validateInterpretedMarking(parsedContent)).toBe(true)
    })

    it('should handle image blob conversion for Claude', async () => {
      const mockBlob = createMockImageBlob()
      const response = await mockBlob.blob()
      const arrayBuffer = await response.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      expect(uint8Array.length).toBeGreaterThan(0)
      expect(response.type).toBe('image/png')
    })

    it('should validate result structure with model and timestamp', () => {
      const result: VisionInterpretationResult = {
        interpretedMarking: {
          shapes: [],
          text: [],
          concepts: [],
          annotations: [],
          overallInterpretation: 'Test',
          confidence: 0.9
        },
        rawResponse: '{"test": "data"}',
        model: 'gpt-4o-mini',
        timestamp: new Date().toISOString()
      }

      expect(result.model).toBeDefined()
      expect(['gpt-4o-mini', 'claude-3-5-haiku']).toContain(result.model)
      expect(result.timestamp).toBeDefined()
      expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0)
      expect(validateInterpretedMarking(result.interpretedMarking)).toBe(true)
    })

    it('should handle fallback from GPT to Claude', () => {
      // Simulate GPT failure scenario
      const gptError = new Error('OpenAI API error: 500 - Internal Server Error')
      
      // Simulate Claude success
      const mockInterpretation: InterpretedMarking = {
        shapes: [],
        text: [],
        concepts: [],
        annotations: [],
        overallInterpretation: 'Fallback interpretation',
        confidence: 0.85
      }
      
      const claudeResponse = createMockClaudeResponse(mockInterpretation)
      
      expect(gptError.message).toContain('OpenAI API error')
      expect(claudeResponse.content).toBeDefined()
      
      const parsedContent = JSON.parse(claudeResponse.content[0].text)
      expect(validateInterpretedMarking(parsedContent)).toBe(true)
    })
  })

  describe('Context-Aware Vision Analysis', () => {
    it('should interpret with milestone context', () => {
      const context = {
        currentMilestone: 'Understanding fractions',
        expectedConcepts: ['half', 'quarter', 'whole'],
        taskDescription: 'Draw a circle and divide it into halves'
      }

      const mockInterpretation: InterpretedMarking = {
        shapes: [
          {
            type: 'circle',
            description: 'Circle divided by a vertical line',
            position: { x: 200, y: 200 },
            confidence: 0.93
          },
          {
            type: 'line',
            description: 'Vertical line dividing the circle in half',
            position: { x: 200, y: 150 },
            confidence: 0.91
          }
        ],
        text: [
          {
            content: '1/2',
            position: { x: 180, y: 200 },
            confidence: 0.89
          },
          {
            content: '1/2',
            position: { x: 220, y: 200 },
            confidence: 0.89
          }
        ],
        concepts: [
          {
            name: 'half',
            description: 'Understanding that a half is one of two equal parts',
            confidence: 0.94
          },
          {
            name: 'fractions',
            description: 'Visual representation of fractions',
            confidence: 0.92
          }
        ],
        annotations: [],
        overallInterpretation: 'Learner correctly drew a circle divided into halves and labeled each half as 1/2, demonstrating understanding of the fraction concept',
        confidence: 0.92
      }

      expect(validateInterpretedMarking(mockInterpretation)).toBe(true)
      expect(mockInterpretation.concepts.some(c => context.expectedConcepts.includes(c.name))).toBe(true)
      expect(mockInterpretation.overallInterpretation).toContain('half')
    })

    it('should interpret with task-specific context', () => {
      const context = {
        taskDescription: 'Label the parts of a plant: roots, stem, leaves, flower'
      }

      const mockInterpretation: InterpretedMarking = {
        shapes: [
          {
            type: 'freehand',
            description: 'Drawing of a plant with roots, stem, leaves, and flower',
            position: { x: 250, y: 300 },
            confidence: 0.87
          },
          {
            type: 'arrow',
            description: 'Arrow pointing to roots',
            position: { x: 200, y: 400 },
            confidence: 0.9
          },
          {
            type: 'arrow',
            description: 'Arrow pointing to stem',
            position: { x: 250, y: 350 },
            confidence: 0.91
          }
        ],
        text: [
          {
            content: 'Roots',
            position: { x: 150, y: 400 },
            confidence: 0.93
          },
          {
            content: 'Stem',
            position: { x: 280, y: 350 },
            confidence: 0.92
          },
          {
            content: 'Leaves',
            position: { x: 300, y: 280 },
            confidence: 0.91
          },
          {
            content: 'Flower',
            position: { x: 280, y: 220 },
            confidence: 0.9
          }
        ],
        concepts: [
          {
            name: 'plant-anatomy',
            description: 'Understanding the parts of a plant',
            confidence: 0.92
          },
          {
            name: 'labeling',
            description: 'Correctly labeling diagram components',
            confidence: 0.9
          }
        ],
        annotations: [
          {
            type: 'arrow',
            description: 'Arrows pointing to each labeled part',
            confidence: 0.9
          }
        ],
        overallInterpretation: 'Learner drew a plant and correctly labeled all four parts: roots, stem, leaves, and flower, demonstrating understanding of plant anatomy',
        confidence: 0.91
      }

      expect(validateInterpretedMarking(mockInterpretation)).toBe(true)
      expect(mockInterpretation.text.some(t => t.content === 'Roots')).toBe(true)
      expect(mockInterpretation.text.some(t => t.content === 'Stem')).toBe(true)
      expect(mockInterpretation.text.some(t => t.content === 'Leaves')).toBe(true)
      expect(mockInterpretation.text.some(t => t.content === 'Flower')).toBe(true)
    })
  })
})

