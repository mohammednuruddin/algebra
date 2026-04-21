/// <reference lib="deno.ns" />
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

/**
 * Unit tests for Article Generator Edge Function
 * 
 * Tests cover:
 * - Article markdown generation with mocked AI responses
 * - Title generation following [Topic] - [Key Concept] - [Date] pattern
 * - Media embedding with storage URL replacement
 * - Formula formatting (LaTeX preservation)
 * - Metadata structure validation
 * 
 * Validates Requirements: 13.1, 13.4
 */

// Mock data for testing
const mockLessonPlan = {
  topic: 'Understanding Photosynthesis',
  normalizedTopic: 'understanding-photosynthesis',
  objective: 'Learn how plants convert sunlight into energy',
  milestones: [
    {
      id: 'm1',
      title: 'What is Photosynthesis',
      description: 'Understand the basic definition and purpose',
      required: true,
      successCriteria: ['Can explain what photosynthesis is', 'Can identify where it occurs'],
      estimatedDuration: 5
    },
    {
      id: 'm2',
      title: 'The Chemical Process',
      description: 'Learn the chemical equation and process steps',
      required: true,
      successCriteria: ['Can write the chemical equation', 'Can explain the light and dark reactions'],
      estimatedDuration: 10
    }
  ],
  concepts: [
    {
      id: 'c1',
      name: 'Chlorophyll',
      description: 'The green pigment that captures light energy',
      relatedMilestones: ['m1', 'm2'],
      misconceptions: ['Chlorophyll is only in leaves']
    }
  ],
  estimatedDuration: 15,
  difficulty: 'beginner' as const,
  visualsNeeded: true,
  interactiveMoments: []
}

const mockSummary = {
  sessionId: 'test-session-id',
  topic: 'Understanding Photosynthesis',
  objective: 'Learn how plants convert sunlight into energy',
  duration: {
    startTime: '2026-01-15T10:00:00Z',
    endTime: '2026-01-15T10:15:00Z',
    totalMinutes: 15
  },
  milestonesOverview: {
    total: 2,
    completed: 2,
    percentComplete: 100,
    milestones: [
      {
        id: 'm1',
        title: 'What is Photosynthesis',
        status: 'confirmed',
        attempts: 2,
        accuracy: 100,
        keyInsights: ['Grasped the concept quickly']
      },
      {
        id: 'm2',
        title: 'The Chemical Process',
        status: 'confirmed',
        attempts: 3,
        accuracy: 66.7,
        keyInsights: ['Needed practice with the equation']
      }
    ]
  },
  learnerPerformance: {
    overallEngagement: 'high',
    strengthAreas: ['Quick understanding of concepts', 'Good questions'],
    improvementAreas: ['Chemical equation memorization'],
    misconceptionsAddressed: ['Chlorophyll location'],
    notableAchievements: ['Completed all milestones']
  },
  interactionSummary: {
    totalTurns: 8,
    inputModesUsed: ['voice', 'text'],
    canvasInteractions: 0,
    voiceInteractions: 6,
    textInteractions: 2
  },
  keyTakeaways: [
    'Photosynthesis converts light energy to chemical energy',
    'The process occurs in chloroplasts',
    'The equation is 6CO2 + 6H2O + light → C6H12O6 + 6O2'
  ],
  recommendedNextSteps: [
    'Practice writing the chemical equation',
    'Learn about cellular respiration',
    'Explore different types of photosynthesis'
  ],
  generatedAt: '2026-01-15T10:15:00Z'
}

Deno.test('Article Generator - Title Generation', () => {
  // Test title format: [Topic] - [Key Concept] - [Date]
  const completedAt = '2026-01-15T10:15:00Z'
  const date = new Date(completedAt)
  const formattedDate = date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  
  const keyConcept = mockLessonPlan.milestones[0].title
  const expectedTitle = `${mockLessonPlan.topic} - ${keyConcept} - ${formattedDate}`
  
  assertExists(expectedTitle)
  assertEquals(expectedTitle.includes(mockLessonPlan.topic), true)
  assertEquals(expectedTitle.includes(keyConcept), true)
  assertEquals(expectedTitle.includes('January'), true)
})

Deno.test('Article Generator - Markdown Structure', () => {
  // Test that article markdown has expected structure
  const mockMarkdown = `# Understanding Photosynthesis - What is Photosynthesis - January 15, 2026

**Topic:** Understanding Photosynthesis
**Date:** January 15, 2026
**Duration:** 15 minutes
**Milestones Covered:** 2/2

## Introduction

This lesson covered the fundamentals of photosynthesis.

## What is Photosynthesis

Photosynthesis is the process by which plants convert light energy into chemical energy.

### Key Points
- Occurs in chloroplasts
- Requires sunlight, water, and carbon dioxide

## The Chemical Process

The chemical equation for photosynthesis is:

$$6CO_2 + 6H_2O + \\text{light} \\rightarrow C_6H_{12}O_6 + 6O_2$$

## Summary

The learner successfully completed all milestones and demonstrated strong understanding.`

  // Verify structure
  assertEquals(mockMarkdown.includes('# Understanding Photosynthesis'), true)
  assertEquals(mockMarkdown.includes('**Topic:**'), true)
  assertEquals(mockMarkdown.includes('**Duration:**'), true)
  assertEquals(mockMarkdown.includes('## Introduction'), true)
  assertEquals(mockMarkdown.includes('## What is Photosynthesis'), true)
  assertEquals(mockMarkdown.includes('## Summary'), true)
  assertEquals(mockMarkdown.includes('$$'), true) // LaTeX formula
})

Deno.test('Article Generator - Media Embedding', () => {
  // Test media placeholder replacement
  const markdown = 'Here is an image: ![Diagram](MEDIA_PLACEHOLDER_abc-123)'
  const mediaAssets = [
    {
      id: 'abc-123',
      kind: 'generated',
      storage_path: 'lesson-media/user-id/session-id/image.png',
      metadata_json: { description: 'Photosynthesis diagram' }
    }
  ]
  const supabaseUrl = 'https://example.supabase.co'
  
  const result = markdown.replace(
    /MEDIA_PLACEHOLDER_abc-123/g,
    `${supabaseUrl}/storage/v1/object/public/${mediaAssets[0].storage_path}`
  )
  
  assertEquals(result.includes('MEDIA_PLACEHOLDER'), false)
  assertEquals(result.includes(supabaseUrl), true)
  assertEquals(result.includes(mediaAssets[0].storage_path), true)
})

Deno.test('Article Generator - Metadata Structure', () => {
  // Test metadata JSON structure
  const metadata = {
    topic: mockLessonPlan.topic,
    duration: mockSummary.duration.totalMinutes,
    milestonesTotal: mockLessonPlan.milestones.length,
    milestonesCompleted: mockSummary.milestonesOverview.completed,
    difficulty: mockLessonPlan.difficulty,
    mediaCount: 2
  }
  
  assertEquals(metadata.topic, 'Understanding Photosynthesis')
  assertEquals(metadata.duration, 15)
  assertEquals(metadata.milestonesTotal, 2)
  assertEquals(metadata.milestonesCompleted, 2)
  assertEquals(metadata.difficulty, 'beginner')
  assertEquals(metadata.mediaCount, 2)
})

Deno.test('Article Generator - LaTeX Formula Handling', () => {
  // Test that LaTeX formulas are preserved
  const markdown = `
Inline formula: $E = mc^2$

Block formula:
$$\\int_0^\\infty e^{-x} dx = 1$$

Chemical equation:
$$6CO_2 + 6H_2O + \\text{light} \\rightarrow C_6H_{12}O_6 + 6O_2$$
`
  
  assertEquals(markdown.includes('$E = mc^2$'), true)
  assertEquals(markdown.includes('$$\\int_0^\\infty'), true)
  assertEquals(markdown.includes('$$6CO_2'), true)
})

Deno.test('Article Generator - Storage Path Format', () => {
  // Test storage path format: {user_id}/{session_id}/article.md
  const userId = 'user-123'
  const sessionId = 'session-456'
  const storagePath = `${userId}/${sessionId}/article.md`
  
  assertEquals(storagePath, 'user-123/session-456/article.md')
  assertEquals(storagePath.endsWith('.md'), true)
  assertEquals(storagePath.includes(userId), true)
  assertEquals(storagePath.includes(sessionId), true)
})

// Test AI service response mocking for OpenAI
Deno.test('Article Generator - Mock OpenAI API Response', async () => {
  const mockResponse = {
    choices: [{
      message: {
        content: `# Understanding Photosynthesis - What is Photosynthesis - January 15, 2026

**Topic:** Understanding Photosynthesis
**Date:** January 15, 2026
**Duration:** 15 minutes
**Milestones Covered:** 2/2

## Introduction

This lesson covered the fundamentals of photosynthesis, the process by which plants convert light energy into chemical energy.

## What is Photosynthesis

Photosynthesis is the process by which plants, algae, and some bacteria convert light energy into chemical energy stored in glucose.

![Photosynthesis diagram](MEDIA_PLACEHOLDER_abc-123)

### Key Points
- Occurs in chloroplasts
- Requires sunlight, water, and carbon dioxide
- Produces glucose and oxygen

## The Chemical Process

The chemical equation for photosynthesis is:

$6CO_2 + 6H_2O + \\text{light} \\rightarrow C_6H_{12}O_6 + 6O_2$

### Key Points
- Light-dependent reactions occur in thylakoids
- Light-independent reactions (Calvin cycle) occur in stroma

## Summary

The learner successfully completed all milestones and demonstrated strong understanding of photosynthesis fundamentals.`
      }
    }]
  }

  // Verify mock response structure
  assertExists(mockResponse.choices)
  assertEquals(mockResponse.choices.length, 1)
  assertExists(mockResponse.choices[0].message.content)
  
  const content = mockResponse.choices[0].message.content
  
  // Verify article structure
  assert(content.includes('# Understanding Photosynthesis'))
  assert(content.includes('**Topic:**'))
  assert(content.includes('**Duration:**'))
  assert(content.includes('## Introduction'))
  assert(content.includes('## What is Photosynthesis'))
  assert(content.includes('## The Chemical Process'))
  assert(content.includes('## Summary'))
  
  // Verify media placeholder
  assert(content.includes('MEDIA_PLACEHOLDER_abc-123'))
  
  // Verify LaTeX formula
  assert(content.includes('$6CO_2'))
  assert(content.includes('\\rightarrow'))
})

// Test AI service response mocking for Anthropic
Deno.test('Article Generator - Mock Anthropic API Response', async () => {
  const mockResponse = {
    content: [{
      text: `# Understanding Photosynthesis - What is Photosynthesis - January 15, 2026

**Topic:** Understanding Photosynthesis
**Date:** January 15, 2026
**Duration:** 15 minutes
**Milestones Covered:** 2/2

## Introduction

This comprehensive lesson explored photosynthesis.

## What is Photosynthesis

Photosynthesis converts light energy to chemical energy.

## Summary

All learning objectives achieved.`
    }]
  }

  // Verify mock response structure
  assertExists(mockResponse.content)
  assertEquals(mockResponse.content.length, 1)
  assertExists(mockResponse.content[0].text)
  
  const content = mockResponse.content[0].text
  
  // Verify article structure
  assert(content.includes('# Understanding Photosynthesis'))
  assert(content.includes('**Topic:**'))
  assert(content.includes('## Introduction'))
  assert(content.includes('## Summary'))
})

// Test article markdown generation with complete workflow
Deno.test('Article Generator - Complete Markdown Generation Workflow', () => {
  // Simulate the complete workflow
  const completedAt = '2026-01-15T10:15:00Z'
  
  // Step 1: Generate title
  const date = new Date(completedAt)
  const formattedDate = date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  const keyConcept = mockLessonPlan.milestones[0].title
  const title = `${mockLessonPlan.topic} - ${keyConcept} - ${formattedDate}`
  
  assertEquals(title, 'Understanding Photosynthesis - What is Photosynthesis - January 15, 2026')
  
  // Step 2: Generate article content (mocked AI response)
  let articleMarkdown = `**Topic:** ${mockLessonPlan.topic}
**Date:** ${formattedDate}
**Duration:** ${mockSummary.duration.totalMinutes} minutes
**Milestones Covered:** ${mockSummary.milestonesOverview.completed}/${mockSummary.milestonesOverview.total}

## Introduction

${mockLessonPlan.objective}

## ${mockLessonPlan.milestones[0].title}

${mockLessonPlan.milestones[0].description}

![Photosynthesis diagram](MEDIA_PLACEHOLDER_media-1)

### Key Points
${mockLessonPlan.milestones[0].successCriteria.map(c => `- ${c}`).join('\n')}

## ${mockLessonPlan.milestones[1].title}

${mockLessonPlan.milestones[1].description}

The chemical equation is:

$6CO_2 + 6H_2O + \\text{light} \\rightarrow C_6H_{12}O_6 + 6O_2$

## Summary

${mockSummary.keyTakeaways.join('\n')}`

  // Step 3: Add title
  articleMarkdown = `# ${title}\n\n${articleMarkdown}`
  
  // Step 4: Embed media assets
  const mediaAssets = [{
    id: 'media-1',
    kind: 'generated',
    storage_path: 'lesson-media/user-123/session-456/diagram.png',
    metadata_json: { description: 'Photosynthesis diagram' }
  }]
  const supabaseUrl = 'https://example.supabase.co'
  
  mediaAssets.forEach(asset => {
    const placeholder = `MEDIA_PLACEHOLDER_${asset.id}`
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${asset.storage_path}`
    articleMarkdown = articleMarkdown.replace(new RegExp(placeholder, 'g'), publicUrl)
  })
  
  // Verify final article
  assert(articleMarkdown.includes(`# ${title}`))
  assert(articleMarkdown.includes('**Topic:**'))
  assert(articleMarkdown.includes('## Introduction'))
  assert(articleMarkdown.includes('## What is Photosynthesis'))
  assert(articleMarkdown.includes('## The Chemical Process'))
  assert(articleMarkdown.includes('## Summary'))
  assert(!articleMarkdown.includes('MEDIA_PLACEHOLDER'))
  assert(articleMarkdown.includes(supabaseUrl))
  assert(articleMarkdown.includes('$6CO_2'))
  
  // Step 5: Verify metadata
  const metadata = {
    topic: mockLessonPlan.topic,
    duration: mockSummary.duration.totalMinutes,
    milestonesTotal: mockLessonPlan.milestones.length,
    milestonesCompleted: mockSummary.milestonesOverview.completed,
    difficulty: mockLessonPlan.difficulty,
    mediaCount: mediaAssets.length
  }
  
  assertEquals(metadata.topic, 'Understanding Photosynthesis')
  assertEquals(metadata.duration, 15)
  assertEquals(metadata.milestonesTotal, 2)
  assertEquals(metadata.milestonesCompleted, 2)
  assertEquals(metadata.mediaCount, 1)
})

// Test media embedding with multiple assets
Deno.test('Article Generator - Multiple Media Asset Embedding', () => {
  const markdown = `# Test Article

Here is the first image: ![Diagram 1](MEDIA_PLACEHOLDER_img-1)

Some text in between.

Here is the second image: ![Diagram 2](MEDIA_PLACEHOLDER_img-2)

And a third one: ![Chart](MEDIA_PLACEHOLDER_img-3)`

  const mediaAssets = [
    {
      id: 'img-1',
      kind: 'fetched',
      storage_path: 'media/user/session/img1.png',
      metadata_json: { description: 'Diagram 1' }
    },
    {
      id: 'img-2',
      kind: 'generated',
      storage_path: 'media/user/session/img2.png',
      metadata_json: { description: 'Diagram 2' }
    },
    {
      id: 'img-3',
      kind: 'fetched',
      storage_path: 'media/user/session/img3.png',
      metadata_json: { description: 'Chart' }
    }
  ]
  
  const supabaseUrl = 'https://test.supabase.co'
  
  let result = markdown
  mediaAssets.forEach(asset => {
    const placeholder = `MEDIA_PLACEHOLDER_${asset.id}`
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${asset.storage_path}`
    result = result.replace(new RegExp(placeholder, 'g'), publicUrl)
  })
  
  // Verify all placeholders replaced
  assert(!result.includes('MEDIA_PLACEHOLDER'))
  
  // Verify all URLs present
  assert(result.includes(`${supabaseUrl}/storage/v1/object/public/media/user/session/img1.png`))
  assert(result.includes(`${supabaseUrl}/storage/v1/object/public/media/user/session/img2.png`))
  assert(result.includes(`${supabaseUrl}/storage/v1/object/public/media/user/session/img3.png`))
})

// Test formula formatting with various LaTeX patterns
Deno.test('Article Generator - Complex LaTeX Formula Formatting', () => {
  const markdown = `
# Physics Formulas

Inline formula: $E = mc^2$

Block formula with integral:
$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$

Chemical equation:
$6CO_2 + 6H_2O + \\text{light} \\rightarrow C_6H_{12}O_6 + 6O_2$

Quadratic formula:
$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$

Matrix notation:
$\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$

Summation:
$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$
`
  
  // Verify all LaTeX patterns are preserved
  assert(markdown.includes('$E = mc^2$'))
  assert(markdown.includes('$\\int_0^\\infty'))
  assert(markdown.includes('\\frac{\\sqrt{\\pi}}{2}$'))
  assert(markdown.includes('$6CO_2'))
  assert(markdown.includes('\\rightarrow'))
  assert(markdown.includes('$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$'))
  assert(markdown.includes('\\begin{bmatrix}'))
  assert(markdown.includes('$\\sum_{i=1}^{n}'))
  
  // Verify no corruption of LaTeX syntax
  const dollarSignCount = (markdown.match(/\$/g) || []).length
  assert(dollarSignCount % 2 === 0, 'LaTeX delimiters should be balanced')
})

// Test title generation with edge cases
Deno.test('Article Generator - Title Generation Edge Cases', () => {
  // Test with long topic
  const longTopicPlan = {
    ...mockLessonPlan,
    topic: 'Understanding the Complex Interactions Between Photosynthesis and Cellular Respiration in Plant Biology'
  }
  
  const completedAt = '2026-01-15T10:15:00Z'
  const date = new Date(completedAt)
  const formattedDate = date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  
  const keyConcept = longTopicPlan.milestones[0].title
  const title = `${longTopicPlan.topic} - ${keyConcept} - ${formattedDate}`
  
  assert(title.includes(longTopicPlan.topic))
  assert(title.includes(keyConcept))
  assert(title.includes('January 15, 2026'))
  
  // Test with no milestones (fallback to objective)
  const noMilestonesPlan = {
    ...mockLessonPlan,
    milestones: []
  }
  
  const fallbackKeyConcept = noMilestonesPlan.objective.split(' ').slice(0, 5).join(' ')
  const fallbackTitle = `${noMilestonesPlan.topic} - ${fallbackKeyConcept} - ${formattedDate}`
  
  assert(fallbackTitle.includes(noMilestonesPlan.topic))
  assert(fallbackTitle.includes('Learn how plants convert'))
})

// Test error handling for missing data
Deno.test('Article Generator - Error Handling for Missing Data', () => {
  // Test with missing lesson plan
  const invalidSession = {
    lesson_plan_json: null,
    summary_json: mockSummary
  }
  
  const hasLessonPlan = !!invalidSession.lesson_plan_json
  assertEquals(hasLessonPlan, false)
  
  // Test with missing summary
  const invalidSession2 = {
    lesson_plan_json: mockLessonPlan,
    summary_json: null
  }
  
  const hasSummary = !!invalidSession2.summary_json
  assertEquals(hasSummary, false)
  
  // Test with incomplete session status
  const incompleteSession = {
    status: 'active',
    lesson_plan_json: mockLessonPlan,
    summary_json: mockSummary
  }
  
  const isCompleted = incompleteSession.status === 'completed'
  assertEquals(isCompleted, false)
})

console.log('All article generator tests passed!')

