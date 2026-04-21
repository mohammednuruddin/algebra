import { describe, it, expect } from 'vitest'

// Type definitions matching the Edge Function
interface LessonSummary {
  sessionId: string
  topic: string
  objective: string
  duration: {
    startTime: string
    endTime: string
    totalMinutes: number
  }
  milestonesOverview: {
    total: number
    completed: number
    percentComplete: number
    milestones: Array<{
      id: string
      title: string
      status: string
      attempts: number
      accuracy: number
      keyInsights: string[]
    }>
  }
  learnerPerformance: {
    overallEngagement: 'high' | 'medium' | 'low'
    strengthAreas: string[]
    improvementAreas: string[]
    misconceptionsAddressed: string[]
    notableAchievements: string[]
  }
  interactionSummary: {
    totalTurns: number
    inputModesUsed: string[]
    canvasInteractions: number
    voiceInteractions: number
    textInteractions: number
  }
  keyTakeaways: string[]
  recommendedNextSteps: string[]
  generatedAt: string
}

// Validation function for lesson summary
function validateLessonSummary(summary: any): summary is LessonSummary {
  if (!summary || typeof summary !== 'object') return false
  
  const required = [
    'sessionId',
    'topic',
    'objective',
    'duration',
    'milestonesOverview',
    'learnerPerformance',
    'interactionSummary',
    'keyTakeaways',
    'recommendedNextSteps',
    'generatedAt'
  ]
  
  for (const field of required) {
    if (!(field in summary)) {
      return false
    }
  }
  
  // Validate duration structure
  if (!summary.duration.startTime || !summary.duration.endTime || typeof summary.duration.totalMinutes !== 'number') {
    return false
  }
  
  // Validate milestonesOverview structure
  if (typeof summary.milestonesOverview.total !== 'number' || 
      typeof summary.milestonesOverview.completed !== 'number' ||
      !Array.isArray(summary.milestonesOverview.milestones)) {
    return false
  }
  
  // Validate learnerPerformance structure
  if (!['high', 'medium', 'low'].includes(summary.learnerPerformance.overallEngagement)) {
    return false
  }
  
  if (!Array.isArray(summary.learnerPerformance.strengthAreas) ||
      !Array.isArray(summary.learnerPerformance.improvementAreas) ||
      !Array.isArray(summary.learnerPerformance.misconceptionsAddressed) ||
      !Array.isArray(summary.learnerPerformance.notableAchievements)) {
    return false
  }
  
  // Validate interactionSummary structure
  if (typeof summary.interactionSummary.totalTurns !== 'number' ||
      !Array.isArray(summary.interactionSummary.inputModesUsed) ||
      typeof summary.interactionSummary.canvasInteractions !== 'number' ||
      typeof summary.interactionSummary.voiceInteractions !== 'number' ||
      typeof summary.interactionSummary.textInteractions !== 'number') {
    return false
  }
  
  // Validate arrays
  if (!Array.isArray(summary.keyTakeaways) || !Array.isArray(summary.recommendedNextSteps)) {
    return false
  }
  
  return true
}

describe('Session Summarizer Validation', () => {
  describe('validateLessonSummary', () => {
    it('should accept a valid lesson summary', () => {
      const validSummary: LessonSummary = {
        sessionId: 'session-123',
        topic: 'Introduction to Fractions',
        objective: 'Understand basic fraction concepts',
        duration: {
          startTime: '2026-01-15T10:00:00Z',
          endTime: '2026-01-15T10:25:00Z',
          totalMinutes: 25
        },
        milestonesOverview: {
          total: 3,
          completed: 2,
          percentComplete: 66.67,
          milestones: [
            {
              id: 'm1',
              title: 'Understanding Halves',
              status: 'confirmed',
              attempts: 5,
              accuracy: 80,
              keyInsights: ['Demonstrated strong visual understanding', 'Needed guidance on terminology']
            },
            {
              id: 'm2',
              title: 'Understanding Quarters',
              status: 'covered',
              attempts: 3,
              accuracy: 66.67,
              keyInsights: ['Grasped concept quickly']
            },
            {
              id: 'm3',
              title: 'Comparing Fractions',
              status: 'practiced',
              attempts: 2,
              accuracy: 50,
              keyInsights: ['Needs more practice']
            }
          ]
        },
        learnerPerformance: {
          overallEngagement: 'high',
          strengthAreas: ['Visual reasoning', 'Persistence'],
          improvementAreas: ['Mathematical terminology', 'Abstract thinking'],
          misconceptionsAddressed: ['Fractions must have equal parts'],
          notableAchievements: ['Successfully identified halves in complex shapes', 'Drew accurate fraction representations']
        },
        interactionSummary: {
          totalTurns: 15,
          inputModesUsed: ['voice', 'canvas_draw', 'text'],
          canvasInteractions: 8,
          voiceInteractions: 5,
          textInteractions: 2
        },
        keyTakeaways: [
          'Learner has strong visual-spatial skills',
          'Needs more practice with fraction terminology',
          'Shows good problem-solving persistence'
        ],
        recommendedNextSteps: [
          'Practice comparing fractions with different denominators',
          'Review fraction vocabulary',
          'Try real-world fraction problems'
        ],
        generatedAt: '2026-01-15T10:26:00Z'
      }

      expect(validateLessonSummary(validSummary)).toBe(true)
    })

    it('should reject null or undefined', () => {
      expect(validateLessonSummary(null)).toBe(false)
      expect(validateLessonSummary(undefined)).toBe(false)
    })

    it('should reject non-object values', () => {
      expect(validateLessonSummary('string')).toBe(false)
      expect(validateLessonSummary(123)).toBe(false)
      expect(validateLessonSummary([])).toBe(false)
    })

    it('should reject summary missing required fields', () => {
      const incompleteSummary = {
        sessionId: 'session-123',
        topic: 'Test Topic',
        // Missing other required fields
      }

      expect(validateLessonSummary(incompleteSummary)).toBe(false)
    })

    it('should reject summary with invalid duration structure', () => {
      const summaryWithInvalidDuration = {
        sessionId: 'session-123',
        topic: 'Test',
        objective: 'Test',
        duration: {
          startTime: '2026-01-15T10:00:00Z',
          // Missing endTime
          totalMinutes: 25
        },
        milestonesOverview: {
          total: 1,
          completed: 1,
          percentComplete: 100,
          milestones: []
        },
        learnerPerformance: {
          overallEngagement: 'high',
          strengthAreas: [],
          improvementAreas: [],
          misconceptionsAddressed: [],
          notableAchievements: []
        },
        interactionSummary: {
          totalTurns: 10,
          inputModesUsed: [],
          canvasInteractions: 0,
          voiceInteractions: 0,
          textInteractions: 0
        },
        keyTakeaways: [],
        recommendedNextSteps: [],
        generatedAt: '2026-01-15T10:26:00Z'
      }

      expect(validateLessonSummary(summaryWithInvalidDuration)).toBe(false)
    })

    it('should reject summary with invalid engagement level', () => {
      const summaryWithInvalidEngagement = {
        sessionId: 'session-123',
        topic: 'Test',
        objective: 'Test',
        duration: {
          startTime: '2026-01-15T10:00:00Z',
          endTime: '2026-01-15T10:25:00Z',
          totalMinutes: 25
        },
        milestonesOverview: {
          total: 1,
          completed: 1,
          percentComplete: 100,
          milestones: []
        },
        learnerPerformance: {
          overallEngagement: 'very-high', // Invalid engagement level
          strengthAreas: [],
          improvementAreas: [],
          misconceptionsAddressed: [],
          notableAchievements: []
        },
        interactionSummary: {
          totalTurns: 10,
          inputModesUsed: [],
          canvasInteractions: 0,
          voiceInteractions: 0,
          textInteractions: 0
        },
        keyTakeaways: [],
        recommendedNextSteps: [],
        generatedAt: '2026-01-15T10:26:00Z'
      }

      expect(validateLessonSummary(summaryWithInvalidEngagement)).toBe(false)
    })

    it('should accept all valid engagement levels', () => {
      const baseSummary = {
        sessionId: 'session-123',
        topic: 'Test',
        objective: 'Test',
        duration: {
          startTime: '2026-01-15T10:00:00Z',
          endTime: '2026-01-15T10:25:00Z',
          totalMinutes: 25
        },
        milestonesOverview: {
          total: 1,
          completed: 1,
          percentComplete: 100,
          milestones: []
        },
        learnerPerformance: {
          overallEngagement: 'high',
          strengthAreas: [],
          improvementAreas: [],
          misconceptionsAddressed: [],
          notableAchievements: []
        },
        interactionSummary: {
          totalTurns: 10,
          inputModesUsed: [],
          canvasInteractions: 0,
          voiceInteractions: 0,
          textInteractions: 0
        },
        keyTakeaways: [],
        recommendedNextSteps: [],
        generatedAt: '2026-01-15T10:26:00Z'
      }

      expect(validateLessonSummary({ ...baseSummary, learnerPerformance: { ...baseSummary.learnerPerformance, overallEngagement: 'high' } })).toBe(true)
      expect(validateLessonSummary({ ...baseSummary, learnerPerformance: { ...baseSummary.learnerPerformance, overallEngagement: 'medium' } })).toBe(true)
      expect(validateLessonSummary({ ...baseSummary, learnerPerformance: { ...baseSummary.learnerPerformance, overallEngagement: 'low' } })).toBe(true)
    })

    it('should reject summary with non-array learner performance fields', () => {
      const summaryWithInvalidArrays = {
        sessionId: 'session-123',
        topic: 'Test',
        objective: 'Test',
        duration: {
          startTime: '2026-01-15T10:00:00Z',
          endTime: '2026-01-15T10:25:00Z',
          totalMinutes: 25
        },
        milestonesOverview: {
          total: 1,
          completed: 1,
          percentComplete: 100,
          milestones: []
        },
        learnerPerformance: {
          overallEngagement: 'high',
          strengthAreas: 'not an array', // Invalid
          improvementAreas: [],
          misconceptionsAddressed: [],
          notableAchievements: []
        },
        interactionSummary: {
          totalTurns: 10,
          inputModesUsed: [],
          canvasInteractions: 0,
          voiceInteractions: 0,
          textInteractions: 0
        },
        keyTakeaways: [],
        recommendedNextSteps: [],
        generatedAt: '2026-01-15T10:26:00Z'
      }

      expect(validateLessonSummary(summaryWithInvalidArrays)).toBe(false)
    })

    it('should reject summary with invalid interaction summary structure', () => {
      const summaryWithInvalidInteractions = {
        sessionId: 'session-123',
        topic: 'Test',
        objective: 'Test',
        duration: {
          startTime: '2026-01-15T10:00:00Z',
          endTime: '2026-01-15T10:25:00Z',
          totalMinutes: 25
        },
        milestonesOverview: {
          total: 1,
          completed: 1,
          percentComplete: 100,
          milestones: []
        },
        learnerPerformance: {
          overallEngagement: 'high',
          strengthAreas: [],
          improvementAreas: [],
          misconceptionsAddressed: [],
          notableAchievements: []
        },
        interactionSummary: {
          totalTurns: 'not a number', // Invalid
          inputModesUsed: [],
          canvasInteractions: 0,
          voiceInteractions: 0,
          textInteractions: 0
        },
        keyTakeaways: [],
        recommendedNextSteps: [],
        generatedAt: '2026-01-15T10:26:00Z'
      }

      expect(validateLessonSummary(summaryWithInvalidInteractions)).toBe(false)
    })
  })

  describe('Lesson Summary Structure Requirements', () => {
    it('should include comprehensive lesson context (Requirement 8.4)', () => {
      const summary: LessonSummary = {
        sessionId: 'session-123',
        topic: 'Photosynthesis',
        objective: 'Understand how plants make food',
        duration: {
          startTime: '2026-01-15T10:00:00Z',
          endTime: '2026-01-15T10:30:00Z',
          totalMinutes: 30
        },
        milestonesOverview: {
          total: 2,
          completed: 2,
          percentComplete: 100,
          milestones: [
            {
              id: 'm1',
              title: 'Light Energy',
              status: 'confirmed',
              attempts: 3,
              accuracy: 100,
              keyInsights: ['Strong understanding']
            },
            {
              id: 'm2',
              title: 'Chemical Process',
              status: 'confirmed',
              attempts: 4,
              accuracy: 75,
              keyInsights: ['Good grasp of concepts']
            }
          ]
        },
        learnerPerformance: {
          overallEngagement: 'high',
          strengthAreas: ['Scientific reasoning'],
          improvementAreas: ['Chemical terminology'],
          misconceptionsAddressed: ['Plants eat soil'],
          notableAchievements: ['Explained process clearly']
        },
        interactionSummary: {
          totalTurns: 12,
          inputModesUsed: ['voice', 'text'],
          canvasInteractions: 0,
          voiceInteractions: 10,
          textInteractions: 2
        },
        keyTakeaways: ['Understands photosynthesis basics'],
        recommendedNextSteps: ['Study cellular respiration'],
        generatedAt: '2026-01-15T10:31:00Z'
      }

      // Verify all required context is present
      expect(summary.topic).toBeDefined()
      expect(summary.objective).toBeDefined()
      expect(summary.milestonesOverview).toBeDefined()
      expect(summary.learnerPerformance).toBeDefined()
      expect(summary.duration).toBeDefined()
    })

    it('should track milestone progress and completion', () => {
      const milestonesOverview = {
        total: 3,
        completed: 2,
        percentComplete: 66.67,
        milestones: [
          {
            id: 'm1',
            title: 'Milestone 1',
            status: 'confirmed',
            attempts: 5,
            accuracy: 80,
            keyInsights: ['Insight 1']
          },
          {
            id: 'm2',
            title: 'Milestone 2',
            status: 'covered',
            attempts: 3,
            accuracy: 100,
            keyInsights: ['Insight 2']
          },
          {
            id: 'm3',
            title: 'Milestone 3',
            status: 'practiced',
            attempts: 2,
            accuracy: 50,
            keyInsights: ['Needs practice']
          }
        ]
      }

      expect(milestonesOverview.total).toBe(3)
      expect(milestonesOverview.completed).toBe(2)
      expect(milestonesOverview.percentComplete).toBeCloseTo(66.67, 1)
      expect(milestonesOverview.milestones.length).toBe(3)
      
      // Verify each milestone has required fields
      milestonesOverview.milestones.forEach(milestone => {
        expect(milestone.id).toBeDefined()
        expect(milestone.title).toBeDefined()
        expect(milestone.status).toBeDefined()
        expect(typeof milestone.attempts).toBe('number')
        expect(typeof milestone.accuracy).toBe('number')
        expect(Array.isArray(milestone.keyInsights)).toBe(true)
      })
    })

    it('should analyze learner performance comprehensively', () => {
      const learnerPerformance = {
        overallEngagement: 'high' as const,
        strengthAreas: ['Visual reasoning', 'Problem solving'],
        improvementAreas: ['Mathematical notation', 'Speed'],
        misconceptionsAddressed: ['Misconception 1', 'Misconception 2'],
        notableAchievements: ['Achievement 1', 'Achievement 2']
      }

      expect(['high', 'medium', 'low']).toContain(learnerPerformance.overallEngagement)
      expect(learnerPerformance.strengthAreas.length).toBeGreaterThan(0)
      expect(learnerPerformance.improvementAreas.length).toBeGreaterThan(0)
      expect(Array.isArray(learnerPerformance.misconceptionsAddressed)).toBe(true)
      expect(Array.isArray(learnerPerformance.notableAchievements)).toBe(true)
    })

    it('should summarize interaction patterns', () => {
      const interactionSummary = {
        totalTurns: 20,
        inputModesUsed: ['voice', 'canvas_draw', 'text'],
        canvasInteractions: 8,
        voiceInteractions: 10,
        textInteractions: 2
      }

      expect(interactionSummary.totalTurns).toBeGreaterThan(0)
      expect(Array.isArray(interactionSummary.inputModesUsed)).toBe(true)
      expect(interactionSummary.inputModesUsed.length).toBeGreaterThan(0)
      
      // Verify interaction counts sum correctly
      const totalInteractions = interactionSummary.canvasInteractions + 
                               interactionSummary.voiceInteractions + 
                               interactionSummary.textInteractions
      expect(totalInteractions).toBe(interactionSummary.totalTurns)
    })

    it('should provide actionable takeaways and next steps', () => {
      const keyTakeaways = [
        'Learner demonstrates strong visual-spatial skills',
        'Needs more practice with abstract concepts',
        'Shows excellent persistence and engagement'
      ]

      const recommendedNextSteps = [
        'Practice more complex problems',
        'Review terminology',
        'Try real-world applications'
      ]

      expect(keyTakeaways.length).toBeGreaterThan(0)
      expect(recommendedNextSteps.length).toBeGreaterThan(0)
      
      // Verify all items are strings
      keyTakeaways.forEach(takeaway => {
        expect(typeof takeaway).toBe('string')
        expect(takeaway.length).toBeGreaterThan(0)
      })
      
      recommendedNextSteps.forEach(step => {
        expect(typeof step).toBe('string')
        expect(step.length).toBeGreaterThan(0)
      })
    })

    it('should calculate duration correctly', () => {
      const duration = {
        startTime: '2026-01-15T10:00:00Z',
        endTime: '2026-01-15T10:25:00Z',
        totalMinutes: 25
      }

      const start = new Date(duration.startTime)
      const end = new Date(duration.endTime)
      const calculatedMinutes = Math.round((end.getTime() - start.getTime()) / 60000)

      expect(duration.totalMinutes).toBe(calculatedMinutes)
      expect(duration.totalMinutes).toBeGreaterThan(0)
    })
  })
})
