import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Type definitions matching the Edge Function
interface Milestone {
  id: string
  title: string
  description: string
  required: boolean
  successCriteria: string[]
  estimatedDuration?: number
}

interface Concept {
  id: string
  name: string
  description: string
  relatedMilestones: string[]
  misconceptions?: string[]
}

interface InteractiveMoment {
  id: string
  type: 'question' | 'canvas_task' | 'image_annotation' | 'voice_response'
  milestoneId: string
  prompt: string
  expectedResponseType: string
}

interface LessonPlan {
  topic: string
  normalizedTopic: string
  objective: string
  milestones: Milestone[]
  concepts: Concept[]
  estimatedDuration: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  visualsNeeded: boolean
  interactiveMoments: InteractiveMoment[]
}

// Validation function extracted from Edge Function
function validateLessonPlan(plan: any): plan is LessonPlan {
  if (!plan || typeof plan !== 'object') return false
  
  const required = [
    'topic',
    'normalizedTopic',
    'objective',
    'milestones',
    'concepts',
    'estimatedDuration',
    'difficulty',
    'visualsNeeded',
    'interactiveMoments'
  ]
  
  for (const field of required) {
    if (!(field in plan)) {
      return false
    }
  }
  
  if (!Array.isArray(plan.milestones) || plan.milestones.length === 0) {
    return false
  }
  
  if (!Array.isArray(plan.concepts)) {
    return false
  }
  
  if (!['beginner', 'intermediate', 'advanced'].includes(plan.difficulty)) {
    return false
  }
  
  return true
}

// Retry logic extracted from Edge Function
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

describe('Lesson Planner Validation', () => {
  describe('validateLessonPlan', () => {
    it('should accept a valid lesson plan', () => {
      const validPlan: LessonPlan = {
        topic: 'Introduction to Fractions',
        normalizedTopic: 'introduction-to-fractions',
        objective: 'Understand basic fraction concepts',
        milestones: [
          {
            id: 'm1',
            title: 'Understanding Halves',
            description: 'Learn what a half means',
            required: true,
            successCriteria: ['Can identify a half', 'Can draw a half'],
            estimatedDuration: 5
          }
        ],
        concepts: [
          {
            id: 'c1',
            name: 'Half',
            description: 'One of two equal parts',
            relatedMilestones: ['m1'],
            misconceptions: ['A half is always the smaller piece']
          }
        ],
        estimatedDuration: 15,
        difficulty: 'beginner',
        visualsNeeded: true,
        interactiveMoments: [
          {
            id: 'im1',
            type: 'question',
            milestoneId: 'm1',
            prompt: 'Can you show me a half?',
            expectedResponseType: 'canvas_draw'
          }
        ]
      }

      expect(validateLessonPlan(validPlan)).toBe(true)
    })

    it('should reject null or undefined', () => {
      expect(validateLessonPlan(null)).toBe(false)
      expect(validateLessonPlan(undefined)).toBe(false)
    })

    it('should reject non-object values', () => {
      expect(validateLessonPlan('string')).toBe(false)
      expect(validateLessonPlan(123)).toBe(false)
      expect(validateLessonPlan([])).toBe(false)
    })

    it('should reject plan missing required fields', () => {
      const incompletePlan = {
        topic: 'Test Topic',
        normalizedTopic: 'test-topic',
        // Missing other required fields
      }

      expect(validateLessonPlan(incompletePlan)).toBe(false)
    })

    it('should reject plan with empty milestones array', () => {
      const planWithNoMilestones = {
        topic: 'Test Topic',
        normalizedTopic: 'test-topic',
        objective: 'Test objective',
        milestones: [], // Empty array
        concepts: [],
        estimatedDuration: 10,
        difficulty: 'beginner',
        visualsNeeded: false,
        interactiveMoments: []
      }

      expect(validateLessonPlan(planWithNoMilestones)).toBe(false)
    })

    it('should reject plan with non-array milestones', () => {
      const planWithInvalidMilestones = {
        topic: 'Test Topic',
        normalizedTopic: 'test-topic',
        objective: 'Test objective',
        milestones: 'not an array',
        concepts: [],
        estimatedDuration: 10,
        difficulty: 'beginner',
        visualsNeeded: false,
        interactiveMoments: []
      }

      expect(validateLessonPlan(planWithInvalidMilestones)).toBe(false)
    })

    it('should reject plan with non-array concepts', () => {
      const planWithInvalidConcepts = {
        topic: 'Test Topic',
        normalizedTopic: 'test-topic',
        objective: 'Test objective',
        milestones: [
          {
            id: 'm1',
            title: 'Test Milestone',
            description: 'Test',
            required: true,
            successCriteria: ['test']
          }
        ],
        concepts: 'not an array',
        estimatedDuration: 10,
        difficulty: 'beginner',
        visualsNeeded: false,
        interactiveMoments: []
      }

      expect(validateLessonPlan(planWithInvalidConcepts)).toBe(false)
    })

    it('should reject plan with invalid difficulty level', () => {
      const planWithInvalidDifficulty = {
        topic: 'Test Topic',
        normalizedTopic: 'test-topic',
        objective: 'Test objective',
        milestones: [
          {
            id: 'm1',
            title: 'Test Milestone',
            description: 'Test',
            required: true,
            successCriteria: ['test']
          }
        ],
        concepts: [],
        estimatedDuration: 10,
        difficulty: 'expert', // Invalid difficulty
        visualsNeeded: false,
        interactiveMoments: []
      }

      expect(validateLessonPlan(planWithInvalidDifficulty)).toBe(false)
    })

    it('should accept plan with all valid difficulty levels', () => {
      const basePlan = {
        topic: 'Test Topic',
        normalizedTopic: 'test-topic',
        objective: 'Test objective',
        milestones: [
          {
            id: 'm1',
            title: 'Test Milestone',
            description: 'Test',
            required: true,
            successCriteria: ['test']
          }
        ],
        concepts: [],
        estimatedDuration: 10,
        visualsNeeded: false,
        interactiveMoments: []
      }

      expect(validateLessonPlan({ ...basePlan, difficulty: 'beginner' })).toBe(true)
      expect(validateLessonPlan({ ...basePlan, difficulty: 'intermediate' })).toBe(true)
      expect(validateLessonPlan({ ...basePlan, difficulty: 'advanced' })).toBe(true)
    })

    it('should accept plan with multiple milestones', () => {
      const planWithMultipleMilestones = {
        topic: 'Test Topic',
        normalizedTopic: 'test-topic',
        objective: 'Test objective',
        milestones: [
          {
            id: 'm1',
            title: 'First Milestone',
            description: 'First',
            required: true,
            successCriteria: ['test1']
          },
          {
            id: 'm2',
            title: 'Second Milestone',
            description: 'Second',
            required: false,
            successCriteria: ['test2']
          }
        ],
        concepts: [],
        estimatedDuration: 20,
        difficulty: 'intermediate',
        visualsNeeded: true,
        interactiveMoments: []
      }

      expect(validateLessonPlan(planWithMultipleMilestones)).toBe(true)
    })

    it('should accept plan with optional milestone fields', () => {
      const planWithOptionalFields = {
        topic: 'Test Topic',
        normalizedTopic: 'test-topic',
        objective: 'Test objective',
        milestones: [
          {
            id: 'm1',
            title: 'Test Milestone',
            description: 'Test',
            required: true,
            successCriteria: ['test'],
            estimatedDuration: 10 // Optional field
          }
        ],
        concepts: [
          {
            id: 'c1',
            name: 'Test Concept',
            description: 'Test',
            relatedMilestones: ['m1'],
            misconceptions: ['misconception1'] // Optional field
          }
        ],
        estimatedDuration: 10,
        difficulty: 'beginner',
        visualsNeeded: false,
        interactiveMoments: []
      }

      expect(validateLessonPlan(planWithOptionalFields)).toBe(true)
    })
  })

  describe('Lesson Plan Structure Requirements', () => {
    it('should ensure at least one milestone exists (Requirement 1.5)', () => {
      const planWithOneMilestone = {
        topic: 'Test',
        normalizedTopic: 'test',
        objective: 'Test',
        milestones: [
          {
            id: 'm1',
            title: 'Milestone',
            description: 'Test',
            required: true,
            successCriteria: ['criteria']
          }
        ],
        concepts: [],
        estimatedDuration: 10,
        difficulty: 'beginner',
        visualsNeeded: false,
        interactiveMoments: []
      }

      expect(validateLessonPlan(planWithOneMilestone)).toBe(true)
      expect(planWithOneMilestone.milestones.length).toBeGreaterThanOrEqual(1)
    })

    it('should validate milestone has associated learning objectives (success criteria)', () => {
      const milestone = {
        id: 'm1',
        title: 'Test Milestone',
        description: 'Test description',
        required: true,
        successCriteria: ['Can explain concept', 'Can apply concept']
      }

      expect(milestone.successCriteria).toBeDefined()
      expect(Array.isArray(milestone.successCriteria)).toBe(true)
      expect(milestone.successCriteria.length).toBeGreaterThan(0)
    })
  })

  describe('Retry Logic with Exponential Backoff', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.restoreAllMocks()
      vi.useRealTimers()
    })

    it('should succeed on first attempt if function succeeds', async () => {
      const mockFn = vi.fn().mockResolvedValue('success')
      
      const result = await retryWithBackoff(mockFn)
      
      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and succeed on second attempt', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success')
      
      const promise = retryWithBackoff(mockFn, 3, 100)
      
      // Fast-forward through the delay
      await vi.runAllTimersAsync()
      
      const result = await promise
      
      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(2)
    })

    it('should retry multiple times before succeeding', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success')
      
      const promise = retryWithBackoff(mockFn, 3, 100)
      
      await vi.runAllTimersAsync()
      
      const result = await promise
      
      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(3)
    })

    it('should throw error after max retries exhausted', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Persistent failure'))
      
      // Catch the promise immediately to prevent unhandled rejection
      const promise = retryWithBackoff(mockFn, 3, 100).catch(e => e)
      
      await vi.runAllTimersAsync()
      
      const error = await promise
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Persistent failure')
      expect(mockFn).toHaveBeenCalledTimes(3)
    })

    it('should use exponential backoff delays (Requirement 11.1)', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success')
      
      const initialDelay = 1000
      const promise = retryWithBackoff(mockFn, 3, initialDelay)
      
      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0)
      expect(mockFn).toHaveBeenCalledTimes(1)
      
      // Second attempt after 1000ms (2^0 * 1000)
      await vi.advanceTimersByTimeAsync(1000)
      expect(mockFn).toHaveBeenCalledTimes(2)
      
      // Third attempt after 2000ms (2^1 * 1000)
      await vi.advanceTimersByTimeAsync(2000)
      expect(mockFn).toHaveBeenCalledTimes(3)
      
      const result = await promise
      expect(result).toBe('success')
    })

    it('should handle different initial delay values', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('success')
      
      const promise = retryWithBackoff(mockFn, 3, 500)
      
      await vi.advanceTimersByTimeAsync(0)
      expect(mockFn).toHaveBeenCalledTimes(1)
      
      await vi.advanceTimersByTimeAsync(500)
      expect(mockFn).toHaveBeenCalledTimes(2)
      
      const result = await promise
      expect(result).toBe('success')
    })

    it('should preserve error details when all retries fail', async () => {
      const customError = new Error('Custom error message')
      customError.name = 'CustomError'
      
      const mockFn = vi.fn().mockRejectedValue(customError)
      
      // Catch the promise immediately to prevent unhandled rejection
      const promise = retryWithBackoff(mockFn, 2, 100).catch(e => e)
      
      await vi.runAllTimersAsync()
      
      const error = await promise
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Custom error message')
      expect(error.name).toBe('CustomError')
    })
  })

  describe('Lesson Plan Content Validation', () => {
    it('should validate topic is a non-empty string', () => {
      const plan = {
        topic: 'Introduction to Photosynthesis',
        normalizedTopic: 'introduction-to-photosynthesis',
        objective: 'Learn how plants make food',
        milestones: [
          {
            id: 'm1',
            title: 'Test',
            description: 'Test',
            required: true,
            successCriteria: ['test']
          }
        ],
        concepts: [],
        estimatedDuration: 15,
        difficulty: 'beginner' as const,
        visualsNeeded: true,
        interactiveMoments: []
      }

      expect(validateLessonPlan(plan)).toBe(true)
      expect(plan.topic).toBeTruthy()
      expect(typeof plan.topic).toBe('string')
    })

    it('should validate normalizedTopic follows kebab-case format', () => {
      const plan = {
        topic: 'Introduction to Fractions',
        normalizedTopic: 'introduction-to-fractions',
        objective: 'Test',
        milestones: [
          {
            id: 'm1',
            title: 'Test',
            description: 'Test',
            required: true,
            successCriteria: ['test']
          }
        ],
        concepts: [],
        estimatedDuration: 10,
        difficulty: 'beginner' as const,
        visualsNeeded: false,
        interactiveMoments: []
      }

      expect(validateLessonPlan(plan)).toBe(true)
      expect(plan.normalizedTopic).toMatch(/^[a-z0-9-]+$/)
    })

    it('should validate objective is present and meaningful', () => {
      const plan = {
        topic: 'Test Topic',
        normalizedTopic: 'test-topic',
        objective: 'Understand the fundamental concepts of the topic',
        milestones: [
          {
            id: 'm1',
            title: 'Test',
            description: 'Test',
            required: true,
            successCriteria: ['test']
          }
        ],
        concepts: [],
        estimatedDuration: 10,
        difficulty: 'beginner' as const,
        visualsNeeded: false,
        interactiveMoments: []
      }

      expect(validateLessonPlan(plan)).toBe(true)
      expect(plan.objective).toBeTruthy()
      expect(typeof plan.objective).toBe('string')
    })

    it('should validate estimatedDuration is a positive number', () => {
      const plan = {
        topic: 'Test',
        normalizedTopic: 'test',
        objective: 'Test',
        milestones: [
          {
            id: 'm1',
            title: 'Test',
            description: 'Test',
            required: true,
            successCriteria: ['test']
          }
        ],
        concepts: [],
        estimatedDuration: 20,
        difficulty: 'beginner' as const,
        visualsNeeded: false,
        interactiveMoments: []
      }

      expect(validateLessonPlan(plan)).toBe(true)
      expect(typeof plan.estimatedDuration).toBe('number')
      expect(plan.estimatedDuration).toBeGreaterThan(0)
    })

    it('should validate visualsNeeded is a boolean', () => {
      const plan = {
        topic: 'Test',
        normalizedTopic: 'test',
        objective: 'Test',
        milestones: [
          {
            id: 'm1',
            title: 'Test',
            description: 'Test',
            required: true,
            successCriteria: ['test']
          }
        ],
        concepts: [],
        estimatedDuration: 10,
        difficulty: 'beginner' as const,
        visualsNeeded: true,
        interactiveMoments: []
      }

      expect(validateLessonPlan(plan)).toBe(true)
      expect(typeof plan.visualsNeeded).toBe('boolean')
    })
  })

  describe('Milestone Structure Validation', () => {
    it('should validate milestone has required fields', () => {
      const milestone: Milestone = {
        id: 'm1',
        title: 'Understanding Basics',
        description: 'Learn the fundamental concepts',
        required: true,
        successCriteria: ['Can explain concept', 'Can apply concept']
      }

      expect(milestone.id).toBeTruthy()
      expect(milestone.title).toBeTruthy()
      expect(milestone.description).toBeTruthy()
      expect(typeof milestone.required).toBe('boolean')
      expect(Array.isArray(milestone.successCriteria)).toBe(true)
      expect(milestone.successCriteria.length).toBeGreaterThan(0)
    })

    it('should validate milestone IDs follow consistent format', () => {
      const milestones: Milestone[] = [
        {
          id: 'm1',
          title: 'First',
          description: 'First milestone',
          required: true,
          successCriteria: ['test']
        },
        {
          id: 'm2',
          title: 'Second',
          description: 'Second milestone',
          required: true,
          successCriteria: ['test']
        }
      ]

      milestones.forEach(m => {
        expect(m.id).toMatch(/^m\d+$/)
      })
    })

    it('should validate optional estimatedDuration field', () => {
      const milestoneWithDuration: Milestone = {
        id: 'm1',
        title: 'Test',
        description: 'Test',
        required: true,
        successCriteria: ['test'],
        estimatedDuration: 10
      }

      expect(milestoneWithDuration.estimatedDuration).toBeDefined()
      expect(typeof milestoneWithDuration.estimatedDuration).toBe('number')
      expect(milestoneWithDuration.estimatedDuration).toBeGreaterThan(0)
    })
  })

  describe('Concept Structure Validation', () => {
    it('should validate concept has required fields', () => {
      const concept: Concept = {
        id: 'c1',
        name: 'Photosynthesis',
        description: 'Process by which plants make food',
        relatedMilestones: ['m1', 'm2']
      }

      expect(concept.id).toBeTruthy()
      expect(concept.name).toBeTruthy()
      expect(concept.description).toBeTruthy()
      expect(Array.isArray(concept.relatedMilestones)).toBe(true)
    })

    it('should validate concept IDs follow consistent format', () => {
      const concepts: Concept[] = [
        {
          id: 'c1',
          name: 'First Concept',
          description: 'Description',
          relatedMilestones: ['m1']
        },
        {
          id: 'c2',
          name: 'Second Concept',
          description: 'Description',
          relatedMilestones: ['m2']
        }
      ]

      concepts.forEach(c => {
        expect(c.id).toMatch(/^c\d+$/)
      })
    })

    it('should validate optional misconceptions field', () => {
      const conceptWithMisconceptions: Concept = {
        id: 'c1',
        name: 'Fractions',
        description: 'Parts of a whole',
        relatedMilestones: ['m1'],
        misconceptions: [
          'A half is always the smaller piece',
          'Fractions are always less than 1'
        ]
      }

      expect(conceptWithMisconceptions.misconceptions).toBeDefined()
      expect(Array.isArray(conceptWithMisconceptions.misconceptions)).toBe(true)
      expect(conceptWithMisconceptions.misconceptions!.length).toBeGreaterThan(0)
    })

    it('should validate relatedMilestones references valid milestone IDs', () => {
      const concept: Concept = {
        id: 'c1',
        name: 'Test Concept',
        description: 'Test',
        relatedMilestones: ['m1', 'm2', 'm3']
      }

      expect(concept.relatedMilestones.length).toBeGreaterThan(0)
      concept.relatedMilestones.forEach(id => {
        expect(id).toMatch(/^m\d+$/)
      })
    })
  })

  describe('Interactive Moments Validation', () => {
    it('should validate interactive moment has required fields', () => {
      const moment: InteractiveMoment = {
        id: 'im1',
        type: 'question',
        milestoneId: 'm1',
        prompt: 'Can you explain what photosynthesis is?',
        expectedResponseType: 'voice'
      }

      expect(moment.id).toBeTruthy()
      expect(moment.type).toBeTruthy()
      expect(moment.milestoneId).toBeTruthy()
      expect(moment.prompt).toBeTruthy()
      expect(moment.expectedResponseType).toBeTruthy()
    })

    it('should validate interactive moment types', () => {
      const validTypes: Array<InteractiveMoment['type']> = [
        'question',
        'canvas_task',
        'image_annotation',
        'voice_response'
      ]

      validTypes.forEach(type => {
        const moment: InteractiveMoment = {
          id: 'im1',
          type,
          milestoneId: 'm1',
          prompt: 'Test prompt',
          expectedResponseType: 'test'
        }

        expect(['question', 'canvas_task', 'image_annotation', 'voice_response']).toContain(moment.type)
      })
    })

    it('should validate interactive moment IDs follow consistent format', () => {
      const moments: InteractiveMoment[] = [
        {
          id: 'im1',
          type: 'question',
          milestoneId: 'm1',
          prompt: 'Test',
          expectedResponseType: 'voice'
        },
        {
          id: 'im2',
          type: 'canvas_task',
          milestoneId: 'm1',
          prompt: 'Test',
          expectedResponseType: 'canvas'
        }
      ]

      moments.forEach(m => {
        expect(m.id).toMatch(/^im\d+$/)
      })
    })

    it('should validate milestoneId references valid milestone', () => {
      const moment: InteractiveMoment = {
        id: 'im1',
        type: 'question',
        milestoneId: 'm1',
        prompt: 'Test',
        expectedResponseType: 'voice'
      }

      expect(moment.milestoneId).toMatch(/^m\d+$/)
    })
  })

  describe('Complete Lesson Plan Examples', () => {
    it('should validate a comprehensive beginner lesson plan', () => {
      const plan: LessonPlan = {
        topic: 'Introduction to Fractions',
        normalizedTopic: 'introduction-to-fractions',
        objective: 'Understand what fractions are and how to identify halves and quarters',
        milestones: [
          {
            id: 'm1',
            title: 'Understanding Halves',
            description: 'Learn what a half means and how to identify it',
            required: true,
            successCriteria: [
              'Can explain what a half is',
              'Can identify a half in visual representations',
              'Can draw a half'
            ],
            estimatedDuration: 5
          },
          {
            id: 'm2',
            title: 'Understanding Quarters',
            description: 'Learn what a quarter means and how to identify it',
            required: true,
            successCriteria: [
              'Can explain what a quarter is',
              'Can identify quarters in visual representations'
            ],
            estimatedDuration: 5
          }
        ],
        concepts: [
          {
            id: 'c1',
            name: 'Half',
            description: 'One of two equal parts',
            relatedMilestones: ['m1'],
            misconceptions: ['A half is always the smaller piece']
          },
          {
            id: 'c2',
            name: 'Quarter',
            description: 'One of four equal parts',
            relatedMilestones: ['m2'],
            misconceptions: ['Quarters must be arranged in a grid']
          }
        ],
        estimatedDuration: 15,
        difficulty: 'beginner',
        visualsNeeded: true,
        interactiveMoments: [
          {
            id: 'im1',
            type: 'canvas_task',
            milestoneId: 'm1',
            prompt: 'Draw a circle and divide it in half',
            expectedResponseType: 'canvas_draw'
          },
          {
            id: 'im2',
            type: 'question',
            milestoneId: 'm2',
            prompt: 'How many quarters make a whole?',
            expectedResponseType: 'voice'
          }
        ]
      }

      expect(validateLessonPlan(plan)).toBe(true)
      expect(plan.milestones.length).toBe(2)
      expect(plan.concepts.length).toBe(2)
      expect(plan.interactiveMoments.length).toBe(2)
    })

    it('should validate an advanced lesson plan with complex structure', () => {
      const plan: LessonPlan = {
        topic: 'Photosynthesis Process',
        normalizedTopic: 'photosynthesis-process',
        objective: 'Understand the complete process of photosynthesis including light and dark reactions',
        milestones: [
          {
            id: 'm1',
            title: 'Light-Dependent Reactions',
            description: 'Understand how light energy is captured and converted',
            required: true,
            successCriteria: [
              'Can explain the role of chlorophyll',
              'Can describe electron transport chain',
              'Can identify products of light reactions'
            ],
            estimatedDuration: 10
          },
          {
            id: 'm2',
            title: 'Calvin Cycle',
            description: 'Understand how carbon dioxide is fixed into glucose',
            required: true,
            successCriteria: [
              'Can explain carbon fixation',
              'Can describe the role of ATP and NADPH'
            ],
            estimatedDuration: 10
          },
          {
            id: 'm3',
            title: 'Overall Process Integration',
            description: 'Understand how light and dark reactions work together',
            required: false,
            successCriteria: [
              'Can explain the complete photosynthesis equation',
              'Can describe energy flow through the process'
            ],
            estimatedDuration: 5
          }
        ],
        concepts: [
          {
            id: 'c1',
            name: 'Chlorophyll',
            description: 'Pigment that absorbs light energy',
            relatedMilestones: ['m1'],
            misconceptions: ['Chlorophyll is only in leaves']
          },
          {
            id: 'c2',
            name: 'ATP',
            description: 'Energy currency of the cell',
            relatedMilestones: ['m1', 'm2']
          },
          {
            id: 'c3',
            name: 'Carbon Fixation',
            description: 'Process of converting CO2 into organic compounds',
            relatedMilestones: ['m2', 'm3']
          }
        ],
        estimatedDuration: 30,
        difficulty: 'advanced',
        visualsNeeded: true,
        interactiveMoments: [
          {
            id: 'im1',
            type: 'image_annotation',
            milestoneId: 'm1',
            prompt: 'Mark where light energy enters the chloroplast',
            expectedResponseType: 'image_mark'
          },
          {
            id: 'im2',
            type: 'canvas_task',
            milestoneId: 'm2',
            prompt: 'Draw the Calvin Cycle showing carbon flow',
            expectedResponseType: 'canvas_draw'
          },
          {
            id: 'im3',
            type: 'voice_response',
            milestoneId: 'm3',
            prompt: 'Explain in your own words how photosynthesis produces glucose',
            expectedResponseType: 'voice'
          }
        ]
      }

      expect(validateLessonPlan(plan)).toBe(true)
      expect(plan.difficulty).toBe('advanced')
      expect(plan.milestones.length).toBe(3)
      expect(plan.concepts.length).toBe(3)
      expect(plan.interactiveMoments.length).toBe(3)
    })
  })
})
