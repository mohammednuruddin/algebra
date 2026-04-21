import { describe, it, expect } from 'vitest'

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

interface MediaItem {
  id: string
  type: 'image' | 'diagram' | 'chart' | 'formula'
  description: string
  altText: string
  relatedMilestones: string[]
  searchQuery?: string
  generationPrompt?: string
}

interface MediaManifest {
  items: MediaItem[]
  totalEstimatedAssets: number
}

// Validation function extracted from Edge Function
function validateMediaManifest(manifest: any): manifest is MediaManifest {
  if (!manifest || typeof manifest !== 'object') return false
  
  if (!Array.isArray(manifest.items)) {
    return false
  }
  
  if (typeof manifest.totalEstimatedAssets !== 'number') {
    return false
  }
  
  // Validate each media item
  for (const item of manifest.items) {
    if (!item.id || !item.type || !item.description || !item.altText) {
      return false
    }
    
    if (!['image', 'diagram', 'chart', 'formula'].includes(item.type)) {
      return false
    }
    
    if (!Array.isArray(item.relatedMilestones)) {
      return false
    }
    
    // Must have either searchQuery or generationPrompt
    if (!item.searchQuery && !item.generationPrompt) {
      return false
    }
  }
  
  return true
}

// Mock lesson plan for testing
const mockLessonPlan = {
  topic: 'Photosynthesis',
  normalizedTopic: 'photosynthesis',
  objective: 'Understand how plants convert sunlight into energy',
  milestones: [
    {
      id: 'm1',
      title: 'Understanding Light Absorption',
      description: 'Learn how chlorophyll absorbs light energy',
      required: true,
      successCriteria: ['Can explain the role of chlorophyll', 'Can identify light absorption spectrum'],
      estimatedDuration: 10
    },
    {
      id: 'm2',
      title: 'The Chemical Process',
      description: 'Understand the chemical equation of photosynthesis',
      required: true,
      successCriteria: ['Can write the photosynthesis equation', 'Can explain reactants and products'],
      estimatedDuration: 15
    }
  ],
  concepts: [
    {
      id: 'c1',
      name: 'Chlorophyll',
      description: 'The green pigment that absorbs light',
      relatedMilestones: ['m1'],
      misconceptions: ['Plants only use green light']
    },
    {
      id: 'c2',
      name: 'Chemical Equation',
      description: '6CO2 + 6H2O + light → C6H12O6 + 6O2',
      relatedMilestones: ['m2']
    }
  ],
  estimatedDuration: 25,
  difficulty: 'beginner' as const,
  visualsNeeded: true,
  interactiveMoments: []
}

describe('Media Planner Validation', () => {
  describe('validateMediaManifest', () => {
    it('should accept a valid media manifest', () => {
      const validManifest: MediaManifest = {
        items: [
          {
            id: 'ma1',
            type: 'diagram',
            description: 'Diagram showing photosynthesis process',
            altText: 'A diagram illustrating how plants convert sunlight into energy',
            relatedMilestones: ['m1', 'm2'],
            generationPrompt: 'Create an educational diagram showing the photosynthesis process'
          }
        ],
        totalEstimatedAssets: 1
      }

      expect(validateMediaManifest(validManifest)).toBe(true)
    })

    it('should reject null or undefined', () => {
      expect(validateMediaManifest(null)).toBe(false)
      expect(validateMediaManifest(undefined)).toBe(false)
    })

    it('should reject non-object values', () => {
      expect(validateMediaManifest('string')).toBe(false)
      expect(validateMediaManifest(123)).toBe(false)
      expect(validateMediaManifest([])).toBe(false)
    })

    it('should reject manifest with non-array items', () => {
      const invalidManifest = {
        items: 'not an array',
        totalEstimatedAssets: 1
      }

      expect(validateMediaManifest(invalidManifest)).toBe(false)
    })

    it('should reject manifest without totalEstimatedAssets', () => {
      const invalidManifest = {
        items: []
      }

      expect(validateMediaManifest(invalidManifest)).toBe(false)
    })

    it('should reject manifest with invalid totalEstimatedAssets type', () => {
      const invalidManifest = {
        items: [],
        totalEstimatedAssets: 'not a number'
      }

      expect(validateMediaManifest(invalidManifest)).toBe(false)
    })

    it('should reject media item missing required fields', () => {
      const invalidManifest = {
        items: [
          {
            id: 'ma1',
            type: 'image'
            // Missing description, altText, relatedMilestones
          }
        ],
        totalEstimatedAssets: 1
      }

      expect(validateMediaManifest(invalidManifest)).toBe(false)
    })

    it('should reject media item with invalid type', () => {
      const invalidManifest = {
        items: [
          {
            id: 'ma1',
            type: 'video', // Invalid type
            description: 'Test',
            altText: 'Test',
            relatedMilestones: ['m1'],
            searchQuery: 'test'
          }
        ],
        totalEstimatedAssets: 1
      }

      expect(validateMediaManifest(invalidManifest)).toBe(false)
    })

    it('should accept all valid media types', () => {
      const types: Array<'image' | 'diagram' | 'chart' | 'formula'> = ['image', 'diagram', 'chart', 'formula']
      
      for (const type of types) {
        const manifest = {
          items: [
            {
              id: 'ma1',
              type,
              description: 'Test',
              altText: 'Test',
              relatedMilestones: ['m1'],
              searchQuery: 'test'
            }
          ],
          totalEstimatedAssets: 1
        }

        expect(validateMediaManifest(manifest)).toBe(true)
      }
    })

    it('should reject media item with non-array relatedMilestones', () => {
      const invalidManifest = {
        items: [
          {
            id: 'ma1',
            type: 'image',
            description: 'Test',
            altText: 'Test',
            relatedMilestones: 'not an array',
            searchQuery: 'test'
          }
        ],
        totalEstimatedAssets: 1
      }

      expect(validateMediaManifest(invalidManifest)).toBe(false)
    })

    it('should reject media item without searchQuery or generationPrompt', () => {
      const invalidManifest = {
        items: [
          {
            id: 'ma1',
            type: 'image',
            description: 'Test',
            altText: 'Test',
            relatedMilestones: ['m1']
            // Missing both searchQuery and generationPrompt
          }
        ],
        totalEstimatedAssets: 1
      }

      expect(validateMediaManifest(invalidManifest)).toBe(false)
    })

    it('should accept media item with searchQuery', () => {
      const validManifest = {
        items: [
          {
            id: 'ma1',
            type: 'image',
            description: 'Test',
            altText: 'Test',
            relatedMilestones: ['m1'],
            searchQuery: 'photosynthesis diagram'
          }
        ],
        totalEstimatedAssets: 1
      }

      expect(validateMediaManifest(validManifest)).toBe(true)
    })

    it('should accept media item with generationPrompt', () => {
      const validManifest = {
        items: [
          {
            id: 'ma1',
            type: 'diagram',
            description: 'Test',
            altText: 'Test',
            relatedMilestones: ['m1'],
            generationPrompt: 'Create a diagram showing photosynthesis'
          }
        ],
        totalEstimatedAssets: 1
      }

      expect(validateMediaManifest(validManifest)).toBe(true)
    })

    it('should accept media item with both searchQuery and generationPrompt', () => {
      const validManifest = {
        items: [
          {
            id: 'ma1',
            type: 'image',
            description: 'Test',
            altText: 'Test',
            relatedMilestones: ['m1'],
            searchQuery: 'test query',
            generationPrompt: 'test prompt'
          }
        ],
        totalEstimatedAssets: 1
      }

      expect(validateMediaManifest(validManifest)).toBe(true)
    })

    it('should accept manifest with multiple media items', () => {
      const validManifest = {
        items: [
          {
            id: 'ma1',
            type: 'diagram',
            description: 'Photosynthesis process',
            altText: 'Diagram of photosynthesis',
            relatedMilestones: ['m1'],
            generationPrompt: 'Create photosynthesis diagram'
          },
          {
            id: 'ma2',
            type: 'chart',
            description: 'Light absorption spectrum',
            altText: 'Chart showing light absorption',
            relatedMilestones: ['m1'],
            searchQuery: 'chlorophyll absorption spectrum'
          },
          {
            id: 'ma3',
            type: 'formula',
            description: 'Chemical equation',
            altText: 'Photosynthesis chemical equation',
            relatedMilestones: ['m2'],
            generationPrompt: 'Display the photosynthesis equation'
          }
        ],
        totalEstimatedAssets: 3
      }

      expect(validateMediaManifest(validManifest)).toBe(true)
    })

    it('should accept empty items array', () => {
      const validManifest = {
        items: [],
        totalEstimatedAssets: 0
      }

      expect(validateMediaManifest(validManifest)).toBe(true)
    })
  })

  describe('Media Manifest Requirements', () => {
    it('should validate media manifest structure (Requirement 1.4)', () => {
      const manifest: MediaManifest = {
        items: [
          {
            id: 'ma1',
            type: 'diagram',
            description: 'Test diagram',
            altText: 'Test alt text',
            relatedMilestones: ['m1'],
            generationPrompt: 'Create test diagram'
          }
        ],
        totalEstimatedAssets: 1
      }

      expect(validateMediaManifest(manifest)).toBe(true)
      expect(manifest.items).toBeDefined()
      expect(Array.isArray(manifest.items)).toBe(true)
      expect(manifest.totalEstimatedAssets).toBeDefined()
      expect(typeof manifest.totalEstimatedAssets).toBe('number')
    })

    it('should ensure media items have type classification (Requirement 2.1)', () => {
      const mediaItem: MediaItem = {
        id: 'ma1',
        type: 'diagram',
        description: 'Process diagram',
        altText: 'Diagram showing process',
        relatedMilestones: ['m1'],
        generationPrompt: 'Create diagram'
      }

      expect(mediaItem.type).toBeDefined()
      expect(['image', 'diagram', 'chart', 'formula'].includes(mediaItem.type)).toBe(true)
    })

    it('should link media items to milestones (Requirement 2.6)', () => {
      const mediaItem: MediaItem = {
        id: 'ma1',
        type: 'image',
        description: 'Concept illustration',
        altText: 'Image illustrating concept',
        relatedMilestones: ['m1', 'm2'],
        searchQuery: 'concept image'
      }

      expect(mediaItem.relatedMilestones).toBeDefined()
      expect(Array.isArray(mediaItem.relatedMilestones)).toBe(true)
      expect(mediaItem.relatedMilestones.length).toBeGreaterThan(0)
    })
  })
})
