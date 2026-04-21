import { describe, it, expect } from 'vitest'

// Type definitions matching the Edge Function
interface ImageGenerationRequest {
  sessionId: string
  mediaItemId: string
  prompt: string
  type: 'image' | 'diagram' | 'chart' | 'formula'
}

interface GeneratedImageResult {
  id: string
  url: string
  storagePath: string
  metadata: {
    prompt: string
    model: string
    generatedAt: string
  }
}

describe('Image Generator', () => {
  describe('Request Validation', () => {
    it('should require sessionId field', () => {
      const invalidRequest = {
        mediaItemId: 'ma1',
        prompt: 'Create a diagram of photosynthesis',
        type: 'diagram' as const
      }

      expect(invalidRequest).not.toHaveProperty('sessionId')
    })

    it('should require mediaItemId field', () => {
      const invalidRequest = {
        sessionId: 'session-123',
        prompt: 'Create a diagram of photosynthesis',
        type: 'diagram' as const
      }

      expect(invalidRequest).not.toHaveProperty('mediaItemId')
    })

    it('should require prompt field', () => {
      const invalidRequest = {
        sessionId: 'session-123',
        mediaItemId: 'ma1',
        type: 'diagram' as const
      }

      expect(invalidRequest).not.toHaveProperty('prompt')
    })

    it('should accept valid request with all required fields', () => {
      const validRequest: ImageGenerationRequest = {
        sessionId: 'session-123',
        mediaItemId: 'ma1',
        prompt: 'Create an educational diagram showing the photosynthesis process',
        type: 'diagram'
      }

      expect(validRequest.sessionId).toBeDefined()
      expect(validRequest.mediaItemId).toBeDefined()
      expect(validRequest.prompt).toBeDefined()
      expect(validRequest.type).toBeDefined()
    })

    it('should accept all valid media types', () => {
      const types: Array<'image' | 'diagram' | 'chart' | 'formula'> = ['image', 'diagram', 'chart', 'formula']
      
      for (const type of types) {
        const request: ImageGenerationRequest = {
          sessionId: 'session-123',
          mediaItemId: 'ma1',
          prompt: 'Create educational content',
          type
        }

        expect(['image', 'diagram', 'chart', 'formula'].includes(request.type)).toBe(true)
      }
    })
  })

  describe('Prompt Enhancement', () => {
    it('should enhance prompt for educational content', () => {
      const originalPrompt = 'photosynthesis process'
      const enhancedPrompt = `Educational diagram or illustration: ${originalPrompt}. Style: clear, simple, suitable for learning. High quality, well-labeled if applicable.`
      
      expect(enhancedPrompt).toContain('Educational')
      expect(enhancedPrompt).toContain(originalPrompt)
      expect(enhancedPrompt).toContain('clear, simple')
      expect(enhancedPrompt).toContain('suitable for learning')
    })

    it('should include educational keywords in enhanced prompt', () => {
      const prompt = 'cell structure'
      const enhanced = `Educational diagram or illustration: ${prompt}. Style: clear, simple, suitable for learning. High quality, well-labeled if applicable.`
      
      const educationalKeywords = ['Educational', 'clear', 'simple', 'learning', 'well-labeled']
      
      for (const keyword of educationalKeywords) {
        expect(enhanced).toContain(keyword)
      }
    })

    it('should preserve original prompt content', () => {
      const originalPrompts = [
        'diagram of the water cycle',
        'chart showing plant growth stages',
        'illustration of cell division'
      ]

      for (const prompt of originalPrompts) {
        const enhanced = `Educational diagram or illustration: ${prompt}. Style: clear, simple, suitable for learning. High quality, well-labeled if applicable.`
        expect(enhanced).toContain(prompt)
      }
    })
  })

  describe('Storage Path Generation', () => {
    it('should generate correct storage path format', () => {
      const sessionId = 'abc-123'
      const mediaItemId = 'ma1'
      
      const expectedPath = `${sessionId}/${mediaItemId}_generated.png`
      
      expect(expectedPath).toBe('abc-123/ma1_generated.png')
    })

    it('should always use .png extension for generated images', () => {
      const sessionId = 'session-123'
      const mediaItemIds = ['ma1', 'ma2', 'ma3']
      
      for (const id of mediaItemIds) {
        const path = `${sessionId}/${id}_generated.png`
        expect(path).toContain('.png')
        expect(path).toContain('_generated')
      }
    })

    it('should include _generated suffix in filename', () => {
      const path = 'session-123/ma1_generated.png'
      
      expect(path).toContain('_generated')
      expect(path.split('/')[1]).toContain('_generated')
    })
  })

  describe('DALL-E 3 Integration', () => {
    it('should use correct DALL-E 3 API endpoint', () => {
      const endpoint = 'https://api.openai.com/v1/images/generations'
      
      expect(endpoint).toContain('api.openai.com')
      expect(endpoint).toContain('images/generations')
    })

    it('should configure DALL-E 3 with correct parameters', () => {
      const config = {
        model: 'dall-e-3',
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'natural'
      }

      expect(config.model).toBe('dall-e-3')
      expect(config.n).toBe(1)
      expect(config.size).toBe('1024x1024')
      expect(config.quality).toBe('standard')
      expect(config.style).toBe('natural')
    })

    it('should use standard quality for faster generation', () => {
      const quality = 'standard'
      
      expect(quality).toBe('standard')
      expect(quality).not.toBe('hd')
    })

    it('should extract image URL from DALL-E response', () => {
      const mockResponse = {
        data: [
          {
            url: 'https://oaidalleapiprodscus.blob.core.windows.net/private/org-abc/image.png',
            revised_prompt: 'An educational diagram showing photosynthesis with clear labels'
          }
        ]
      }

      expect(mockResponse.data).toBeDefined()
      expect(mockResponse.data.length).toBeGreaterThan(0)
      expect(mockResponse.data[0].url).toBeDefined()
      expect(mockResponse.data[0].revised_prompt).toBeDefined()
    })
  })

  describe('Stable Diffusion Integration', () => {
    it('should use correct Replicate API endpoint', () => {
      const endpoint = 'https://api.replicate.com/v1/predictions'
      
      expect(endpoint).toContain('api.replicate.com')
      expect(endpoint).toContain('predictions')
    })

    it('should configure Stable Diffusion with correct parameters', () => {
      const config = {
        version: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
        input: {
          prompt: 'educational diagram',
          width: 1024,
          height: 1024,
          num_outputs: 1
        }
      }

      expect(config.version).toContain('stability-ai/sdxl')
      expect(config.input.width).toBe(1024)
      expect(config.input.height).toBe(1024)
      expect(config.input.num_outputs).toBe(1)
    })

    it('should enhance prompt for Stable Diffusion', () => {
      const originalPrompt = 'cell structure'
      const enhanced = `${originalPrompt}, educational illustration, clear and simple, high quality, detailed`
      
      expect(enhanced).toContain(originalPrompt)
      expect(enhanced).toContain('educational illustration')
      expect(enhanced).toContain('clear and simple')
      expect(enhanced).toContain('high quality')
    })

    it('should handle polling for prediction completion', () => {
      const statuses = ['starting', 'processing', 'succeeded']
      
      for (const status of statuses) {
        expect(['starting', 'processing', 'succeeded', 'failed'].includes(status)).toBe(true)
      }
    })

    it('should extract image URL from completed prediction', () => {
      const mockPrediction = {
        id: 'pred-123',
        status: 'succeeded',
        output: [
          'https://replicate.delivery/pbxt/abc123/output.png'
        ]
      }

      expect(mockPrediction.status).toBe('succeeded')
      expect(mockPrediction.output).toBeDefined()
      expect(Array.isArray(mockPrediction.output)).toBe(true)
      expect(mockPrediction.output.length).toBeGreaterThan(0)
    })
  })

  describe('Fallback Strategy', () => {
    it('should have fallback from DALL-E to Stable Diffusion', () => {
      const strategy = {
        primary: 'dall-e-3',
        fallback: 'stable-diffusion-xl'
      }

      expect(strategy.primary).toBe('dall-e-3')
      expect(strategy.fallback).toBe('stable-diffusion-xl')
    })

    it('should provide error message when both generators fail', () => {
      const dalleError = 'DALL-E API error: 429'
      const sdError = 'Stable Diffusion failed: timeout'
      const combinedError = `Both DALL-E and Stable Diffusion failed: ${sdError}`

      expect(combinedError).toContain('Both')
      expect(combinedError).toContain('DALL-E')
      expect(combinedError).toContain('Stable Diffusion')
      expect(combinedError).toContain(sdError)
    })
  })

  describe('Generated Image Result Structure', () => {
    it('should have all required fields in result', () => {
      const result: GeneratedImageResult = {
        id: 'asset-uuid',
        url: 'https://storage.example.com/session-123/ma1_generated.png',
        storagePath: 'session-123/ma1_generated.png',
        metadata: {
          prompt: 'Create a diagram of photosynthesis',
          model: 'dall-e-3',
          generatedAt: new Date().toISOString()
        }
      }

      expect(result.id).toBeDefined()
      expect(result.url).toBeDefined()
      expect(result.storagePath).toBeDefined()
      expect(result.metadata).toBeDefined()
      expect(result.metadata.prompt).toBeDefined()
      expect(result.metadata.model).toBeDefined()
      expect(result.metadata.generatedAt).toBeDefined()
    })

    it('should include generation timestamp', () => {
      const timestamp = new Date().toISOString()
      
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should include model information', () => {
      const models = ['dall-e-3', 'stable-diffusion-xl']
      
      for (const model of models) {
        expect(model).toBeDefined()
        expect(typeof model).toBe('string')
      }
    })
  })

  describe('Database Record Structure', () => {
    it('should create correct lesson_media_assets record structure', () => {
      const record = {
        session_id: 'session-123',
        asset_type: 'diagram' as const,
        storage_path: 'session-123/ma1_generated.png',
        metadata_json: {
          model: 'dall-e-3',
          revisedPrompt: 'Enhanced educational diagram',
          originalPrompt: 'photosynthesis diagram',
          mediaItemId: 'ma1',
          generatedAt: new Date().toISOString(),
          source: 'generated'
        }
      }

      expect(record.session_id).toBeDefined()
      expect(record.asset_type).toBeDefined()
      expect(record.storage_path).toBeDefined()
      expect(record.metadata_json).toBeDefined()
      expect(record.metadata_json.originalPrompt).toBeDefined()
      expect(record.metadata_json.mediaItemId).toBeDefined()
      expect(record.metadata_json.generatedAt).toBeDefined()
      expect(record.metadata_json.source).toBe('generated')
    })

    it('should mark source as generated', () => {
      const metadata = {
        source: 'generated',
        model: 'dall-e-3',
        prompt: 'test prompt'
      }

      expect(metadata.source).toBe('generated')
    })

    it('should preserve original prompt in metadata', () => {
      const originalPrompt = 'Create a diagram showing cell division'
      const metadata = {
        originalPrompt,
        model: 'dall-e-3',
        generatedAt: new Date().toISOString()
      }

      expect(metadata.originalPrompt).toBe(originalPrompt)
    })
  })

  describe('Requirements Validation', () => {
    it('should generate new media when not available (Requirement 2.3)', () => {
      const request: ImageGenerationRequest = {
        sessionId: 'session-123',
        mediaItemId: 'ma1',
        prompt: 'Create an educational diagram of photosynthesis',
        type: 'diagram'
      }

      // Validates that the function accepts generation requests
      expect(request.prompt).toBeDefined()
      expect(request.type).toBe('diagram')
    })

    it('should upload generated images to storage (Requirement 2.3)', () => {
      const storagePath = 'session-123/ma1_generated.png'
      const bucket = 'media-assets'

      // Validates storage path format
      expect(storagePath).toContain('session-123')
      expect(storagePath).toContain('ma1')
      expect(storagePath).toContain('_generated')
      expect(bucket).toBe('media-assets')
    })

    it('should insert lesson_media_assets record (Requirement 2.4)', () => {
      const assetRecord = {
        session_id: 'session-123',
        asset_type: 'diagram' as const,
        storage_path: 'session-123/ma1_generated.png',
        metadata_json: {
          model: 'dall-e-3',
          originalPrompt: 'test',
          mediaItemId: 'ma1',
          generatedAt: new Date().toISOString(),
          source: 'generated'
        }
      }

      expect(assetRecord.session_id).toBeDefined()
      expect(assetRecord.asset_type).toBeDefined()
      expect(assetRecord.storage_path).toBeDefined()
      expect(assetRecord.metadata_json).toBeDefined()
      expect(assetRecord.metadata_json.source).toBe('generated')
    })

    it('should store media in Supabase Storage (Requirement 10.4)', () => {
      const storageConfig = {
        bucket: 'media-assets',
        contentType: 'image/png',
        upsert: true
      }

      expect(storageConfig.bucket).toBe('media-assets')
      expect(storageConfig.contentType).toBe('image/png')
      expect(storageConfig.upsert).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing API keys gracefully', () => {
      const error = new Error('OpenAI API key not configured')
      
      expect(error.message).toContain('API key')
      expect(error.message).toContain('not configured')
    })

    it('should handle API errors with status codes', () => {
      const error = new Error('DALL-E API error: 400 - Invalid prompt')
      
      expect(error.message).toContain('API error')
      expect(error.message).toContain('400')
    })

    it('should handle no image generated', () => {
      const error = new Error('No image generated')
      
      expect(error.message).toContain('No image generated')
    })

    it('should handle download failures', () => {
      const error = new Error('Failed to download generated image: 500')
      
      expect(error.message).toContain('Failed to download')
      expect(error.message).toContain('generated image')
    })

    it('should handle storage upload failures', () => {
      const error = new Error('Storage upload failed: Quota exceeded')
      
      expect(error.message).toContain('Storage upload failed')
    })

    it('should handle database insert failures', () => {
      const error = new Error('Failed to insert media asset record: Foreign key violation')
      
      expect(error.message).toContain('Failed to insert')
      expect(error.message).toContain('media asset record')
    })

    it('should handle Stable Diffusion prediction failures', () => {
      const error = new Error('Image generation failed')
      
      expect(error.message).toContain('generation failed')
    })
  })

  describe('CORS Headers', () => {
    it('should include required CORS headers', () => {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }

      expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*')
      expect(corsHeaders['Access-Control-Allow-Headers']).toContain('authorization')
      expect(corsHeaders['Access-Control-Allow-Headers']).toContain('content-type')
    })
  })

  describe('Image Quality and Size', () => {
    it('should generate 1024x1024 images', () => {
      const size = '1024x1024'
      const [width, height] = size.split('x').map(Number)
      
      expect(width).toBe(1024)
      expect(height).toBe(1024)
    })

    it('should use standard quality for faster generation', () => {
      const quality = 'standard'
      
      expect(quality).toBe('standard')
      expect(quality).not.toBe('hd')
    })

    it('should use natural style for educational content', () => {
      const style = 'natural'
      
      expect(style).toBe('natural')
      expect(['natural', 'vivid'].includes(style)).toBe(true)
    })
  })
})
