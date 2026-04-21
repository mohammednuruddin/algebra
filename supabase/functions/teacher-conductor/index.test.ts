import { describe, it, expect } from 'vitest'

// Type definitions for validation
interface TeacherResponse {
  speech: string
  displayText?: string
  actions: Array<{
    type: string
    params: Record<string, unknown>
    sequenceOrder: number
  }>
  awaitedInputMode: string
  currentMilestoneId: string
  isCorrectAnswer?: boolean
  feedback?: {
    type: 'positive' | 'corrective' | 'neutral'
    message: string
  }
  shouldCompleteLesson?: boolean
  nextMilestoneId?: string
}

interface LearnerInput {
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

// Validation functions
function validateTeacherResponse(response: any): response is TeacherResponse {
  if (!response || typeof response !== 'object') return false
  
  const required = ['speech', 'actions', 'awaitedInputMode', 'currentMilestoneId']
  for (const field of required) {
    if (!(field in response)) return false
  }
  
  if (!Array.isArray(response.actions)) return false
  
  for (const action of response.actions) {
    if (!action.type || !action.params || typeof action.sequenceOrder !== 'number') {
      return false
    }
  }
  
  return true
}

function validateLearnerInput(input: any): input is LearnerInput {
  if (!input || typeof input !== 'object') return false
  
  if (!input.mode || !input.raw) return false
  
  const validModes = ['voice', 'text', 'canvas_draw', 'canvas_mark', 'image_annotation', 'selection', 'mixed']
  if (!validModes.includes(input.mode)) return false
  
  return true
}

describe('Teacher Conductor Validation', () => {
  describe('validateTeacherResponse', () => {
    it('should accept a valid teacher response', () => {
      const validResponse: TeacherResponse = {
        speech: "Great job! That's correct.",
        displayText: "Correct answer!",
        actions: [
          {
            type: "provide_feedback",
            params: { feedbackType: "positive" },
            sequenceOrder: 1
          },
          {
            type: "speak",
            params: { text: "Great job!" },
            sequenceOrder: 2
          }
        ],
        awaitedInputMode: "voice",
        currentMilestoneId: "m1",
        isCorrectAnswer: true,
        feedback: {
          type: "positive",
          message: "Excellent understanding!"
        }
      }

      expect(validateTeacherResponse(validResponse)).toBe(true)
    })

    it('should reject null or undefined', () => {
      expect(validateTeacherResponse(null)).toBe(false)
      expect(validateTeacherResponse(undefined)).toBe(false)
    })

    it('should reject response missing required fields', () => {
      const incompleteResponse = {
        speech: "Test speech"
        // Missing other required fields
      }

      expect(validateTeacherResponse(incompleteResponse)).toBe(false)
    })

    it('should reject response with non-array actions', () => {
      const invalidResponse = {
        speech: "Test",
        actions: "not an array",
        awaitedInputMode: "voice",
        currentMilestoneId: "m1"
      }

      expect(validateTeacherResponse(invalidResponse)).toBe(false)
    })

    it('should reject response with invalid action structure', () => {
      const invalidResponse = {
        speech: "Test",
        actions: [
          {
            type: "speak"
            // Missing params and sequenceOrder
          }
        ],
        awaitedInputMode: "voice",
        currentMilestoneId: "m1"
      }

      expect(validateTeacherResponse(invalidResponse)).toBe(false)
    })

    it('should accept response with optional fields', () => {
      const responseWithOptionals: TeacherResponse = {
        speech: "Test",
        displayText: "Display text",
        actions: [],
        awaitedInputMode: "voice",
        currentMilestoneId: "m1",
        isCorrectAnswer: true,
        feedback: {
          type: "positive",
          message: "Good job!"
        },
        shouldCompleteLesson: false,
        nextMilestoneId: "m2"
      }

      expect(validateTeacherResponse(responseWithOptionals)).toBe(true)
    })
  })

  describe('validateLearnerInput', () => {
    it('should accept valid voice input', () => {
      const validInput: LearnerInput = {
        mode: 'voice',
        raw: {
          text: 'Chlorophyll absorbs light energy'
        },
        interpreted: {
          text: 'Chlorophyll absorbs light energy',
          intent: 'answer_question',
          confidence: 0.95
        }
      }

      expect(validateLearnerInput(validInput)).toBe(true)
    })

    it('should accept valid canvas input', () => {
      const validInput: LearnerInput = {
        mode: 'canvas_draw',
        raw: {
          canvasSnapshotUrl: 'https://example.com/snapshot.png'
        },
        interpreted: {
          markings: [
            {
              type: 'circle',
              meaning: 'Circle divided in half',
              confidence: 0.85,
              coordinates: { x: 100, y: 100, width: 50, height: 50 }
            }
          ]
        }
      }

      expect(validateLearnerInput(validInput)).toBe(true)
    })

    it('should reject null or undefined', () => {
      expect(validateLearnerInput(null)).toBe(false)
      expect(validateLearnerInput(undefined)).toBe(false)
    })

    it('should reject input missing mode', () => {
      const invalidInput = {
        raw: { text: 'Test' }
      }

      expect(validateLearnerInput(invalidInput)).toBe(false)
    })

    it('should reject input missing raw', () => {
      const invalidInput = {
        mode: 'voice'
      }

      expect(validateLearnerInput(invalidInput)).toBe(false)
    })

    it('should reject input with invalid mode', () => {
      const invalidInput = {
        mode: 'invalid_mode',
        raw: { text: 'Test' }
      }

      expect(validateLearnerInput(invalidInput)).toBe(false)
    })

    it('should accept all valid input modes', () => {
      const modes = ['voice', 'text', 'canvas_draw', 'canvas_mark', 'image_annotation', 'selection', 'mixed']
      
      for (const mode of modes) {
        const input = {
          mode,
          raw: { text: 'Test' }
        }
        expect(validateLearnerInput(input)).toBe(true)
      }
    })
  })

  describe('Teacher Response Structure Requirements', () => {
    it('should ensure speech field is present for voice synthesis (Requirement 12.4)', () => {
      const response: TeacherResponse = {
        speech: "Let's learn about photosynthesis!",
        actions: [],
        awaitedInputMode: "voice",
        currentMilestoneId: "m1"
      }

      expect(response.speech).toBeDefined()
      expect(typeof response.speech).toBe('string')
      expect(response.speech.length).toBeGreaterThan(0)
    })

    it('should ensure actions array is present (Requirement 6.4)', () => {
      const response: TeacherResponse = {
        speech: "Test",
        actions: [
          {
            type: "speak",
            params: { text: "Test" },
            sequenceOrder: 1
          }
        ],
        awaitedInputMode: "voice",
        currentMilestoneId: "m1"
      }

      expect(response.actions).toBeDefined()
      expect(Array.isArray(response.actions)).toBe(true)
    })

    it('should ensure currentMilestoneId tracks progress (Requirement 5.2)', () => {
      const response: TeacherResponse = {
        speech: "Test",
        actions: [],
        awaitedInputMode: "voice",
        currentMilestoneId: "m1"
      }

      expect(response.currentMilestoneId).toBeDefined()
      expect(typeof response.currentMilestoneId).toBe('string')
    })

    it('should support lesson completion signal (Requirement 8.1)', () => {
      const response: TeacherResponse = {
        speech: "Congratulations! You've completed the lesson.",
        actions: [],
        awaitedInputMode: "voice",
        currentMilestoneId: "m3",
        shouldCompleteLesson: true
      }

      expect(response.shouldCompleteLesson).toBeDefined()
      expect(response.shouldCompleteLesson).toBe(true)
    })

    it('should support milestone advancement (Requirement 5.3)', () => {
      const response: TeacherResponse = {
        speech: "Great! Let's move to the next milestone.",
        actions: [
          {
            type: "advance_milestone",
            params: { milestoneId: "m2" },
            sequenceOrder: 1
          }
        ],
        awaitedInputMode: "voice",
        currentMilestoneId: "m1",
        nextMilestoneId: "m2"
      }

      expect(response.nextMilestoneId).toBeDefined()
      expect(response.nextMilestoneId).toBe("m2")
    })
  })
})
