# Voice Integration with ElevenLabs

This document describes the voice and audio integration components for the AI Teaching Platform using ElevenLabs APIs.

## Overview

The voice integration provides:
- **Speech-to-Text (STT)**: Real-time voice input capture using ElevenLabs Scribe
- **Text-to-Speech (TTS)**: Natural voice output using ElevenLabs TTS API
- **Combined Interface**: Integrated voice interaction component

## Components

### VoiceInput

Voice input component using ElevenLabs Scribe.

**Features:**
- Real-time transcription with partial and committed transcripts
- Microphone permission handling
- Voice Activity Detection (VAD) for barge-in support
- Audio processing (echo cancellation, noise suppression, auto gain control)
- Secure token-based authentication

**Usage:**
```tsx
import { VoiceInput } from '@/components/lesson';

<VoiceInput
  onTranscript={(text) => console.log('Final:', text)}
  onPartialTranscript={(text) => console.log('Partial:', text)}
  disabled={false}
/>
```

**Props:**
- `onTranscript: (text: string) => void` - Callback for committed transcripts
- `onPartialTranscript?: (text: string) => void` - Callback for partial transcripts
- `disabled?: boolean` - Disable voice input

### VoiceOutput

Text-to-speech component using ElevenLabs TTS API.

**Features:**
- Natural voice synthesis with Eleven Flash v2.5 model
- Configurable voice settings (stability, similarity, style)
- Play/pause/stop controls
- Mute/unmute functionality
- Auto-play support
- Error handling and retry logic

**Usage:**
```tsx
import { VoiceOutput } from '@/components/lesson';

<VoiceOutput
  text="Hello, welcome to the lesson!"
  voiceId="JBFqnCBsd6RMkjVDRZzb"
  autoPlay={true}
  onComplete={() => console.log('Speech finished')}
  onError={(error) => console.error('TTS error:', error)}
/>
```

**Props:**
- `text: string` - Text to convert to speech
- `voiceId?: string` - ElevenLabs voice ID (default: professional voice)
- `autoPlay?: boolean` - Auto-play when audio is ready
- `onComplete?: () => void` - Callback when speech finishes
- `onError?: (error: Error) => void` - Error callback

### VoiceInterface

Combined voice interaction component integrating both input and output.

**Features:**
- Unified interface for voice conversations
- Displays user transcripts and teacher responses
- Visual feedback for listening and speaking states
- Configurable auto-play for teacher responses

**Usage:**
```tsx
import { VoiceInterface } from '@/components/lesson';

<VoiceInterface
  onUserSpeech={(text) => handleUserInput(text)}
  teacherResponse="Great answer! Let's continue..."
  autoPlayResponse={true}
  disabled={false}
  voiceId="JBFqnCBsd6RMkjVDRZzb"
/>
```

**Props:**
- `onUserSpeech: (text: string) => void` - Callback for user speech
- `teacherResponse?: string` - Teacher's response text
- `autoPlayResponse?: boolean` - Auto-play teacher response
- `disabled?: boolean` - Disable voice input
- `voiceId?: string` - Voice ID for teacher responses

## Backend API Endpoints

### Token Generation: `/api/elevenlabs/token`

Generates single-use tokens for ElevenLabs Scribe (STT).

**Security:**
- Never exposes API key to client
- Tokens expire quickly

**Request:**
```
GET /api/elevenlabs/token
```

**Response:**
```json
{
  "token": "single-use-token-string"
}
```

### Text-to-Speech: `/api/elevenlabs/tts`

Converts text to speech audio.

**Request:**
```
POST /api/elevenlabs/tts
Content-Type: application/json

{
  "text": "Hello world",
  "voiceId": "JBFqnCBsd6RMkjVDRZzb",
  "modelId": "eleven_flash_v2_5",
  "voiceSettings": {
    "stability": 0.5,
    "similarityBoost": 0.75,
    "style": 0.0,
    "useSpeakerBoost": true
  }
}
```

**Response:**
```
Content-Type: audio/mpeg
[Audio data as MP3]
```

### Batch transcription fallback: `/api/elevenlabs/transcribe`

Handles short uploaded learner clips and barge-in fallback audio with ElevenLabs speech-to-text.

**Request:**
```
POST /api/elevenlabs/transcribe
Content-Type: multipart/form-data

audio=<wav file>
```

**Response:**
```json
{
  "transcript": "spoken learner text"
}
```

## Configuration

### Environment Variables

Add to `.env.local`:
```
ELEVENLABS_API_KEY=your_api_key_here
```

### Voice Settings

Default voice settings optimized for teaching:
- **Stability**: 0.5 (balanced consistency)
- **Similarity Boost**: 0.75 (natural voice)
- **Style**: 0.0 (neutral teaching tone)
- **Speaker Boost**: true (enhanced clarity)

### Models

- **STT**: `scribe_v2_realtime` - Real-time multilingual transcription
- **TTS**: `eleven_flash_v2_5` - Fast, natural voice synthesis

## Architecture

```
┌─────────────────┐
│   Frontend      │
│  (React)        │
│                 │
│  VoiceInput     │──┐
│  VoiceOutput    │  │
│  VoiceInterface │  │
└─────────────────┘  │
         │           │
         │ HTTPS     │
         ▼           │
┌─────────────────┐  │
│  Backend API    │  │
│  (Next.js)      │  │
│                 │  │
│  /token         │◄─┘
│  /tts           │
│  /transcribe    │
└─────────────────┘
         │
         │ API Key
         ▼
┌─────────────────┐
│  ElevenLabs     │
│  API            │
│                 │
│  Scribe (STT)   │
│  TTS            │
└─────────────────┘
```

## Security Considerations

1. **API Key Protection**: Never expose `ELEVENLABS_API_KEY` in client code
2. **Token-Based Auth**: Use single-use tokens for client-side STT
3. **Rate Limiting**: Consider implementing rate limits for API endpoints

## Testing

Run tests:
```bash
npm test -- components/lesson/voice-input.test.tsx
npm test -- components/lesson/voice-output.test.tsx
npm test -- components/lesson/voice-interface.test.tsx
```

## Requirements Mapping

This implementation satisfies the following requirements:

- **Requirement 4.1**: Voice input capture ✓
- **Requirement 12.1**: ElevenLabs TTS with Eleven Flash v2.5 ✓
- **Requirement 12.2**: ElevenLabs Scribe for STT ✓
- **Requirement 12.3**: Real-time transcription ✓
- **Requirement 12.4**: Voice text optimized for synthesis ✓
- **Requirement 12.5**: Adjustable speech settings ✓
- **Requirement 12.6**: VAD for barge-in detection ✓
- **Requirement 12.7**: ElevenLabs SDK for streaming ✓

- Voice activity detection improvements
- Multi-language support
- Voice cloning for personalized teaching
- Emotion and tone detection
- Real-time translation
