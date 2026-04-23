# Setup Guide - AI Teaching Platform

This guide will help you set up the AI Teaching Platform for local development.

## Prerequisites

- **Node.js** 20+ and npm/yarn/pnpm
- **Git** for version control
- API keys for required services (see below)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd algebra
npm install
```

### 2. Environment Setup

Copy the environment template:

```bash
npm run setup
# or manually: cp .env.example .env.local
```

Edit `.env.local` with your API keys:

```bash
nano .env.local
# or use your preferred editor
```

### 3. Get API Keys

#### Required Services

**Supabase** (Database & Storage)
1. Create account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → API
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

**OpenRouter** (AI Models)
1. Create account at [openrouter.ai](https://openrouter.ai)
2. Go to [Keys](https://openrouter.ai/keys)
3. Create new key → `OPENROUTER_API_KEY`

#### Optional Services (Enhanced Features)

**ElevenLabs** (Voice Features)
1. Create account at [elevenlabs.io](https://elevenlabs.io)
2. Go to [Settings → API Keys](https://elevenlabs.io/app/settings/api-keys)
3. Copy key → `ELEVENLABS_API_KEY`

**Replicate** (Image Generation)
1. Create account at [replicate.com](https://replicate.com)
2. Go to [Account → API Tokens](https://replicate.com/account/api-tokens)
3. Copy token → `REPLICATE_API_TOKEN`
4. Go to [Webhooks](https://replicate.com/account/webhooks)
5. Create webhook → `REPLICATE_WEBHOOK_SECRET`

**Serper** (Image Search)
1. Create account at [serper.dev](https://serper.dev)
2. Go to [API Key](https://serper.dev/api-key)
3. Copy key → `SERPER_API_KEY`

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration Modes

### Minimum Configuration (Text-Only Mode)

Only requires Supabase and OpenRouter:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENROUTER_API_KEY=your-openrouter-key
```

**Features available:**
- ✅ Text-based lessons
- ✅ Canvas interactions
- ✅ Lesson history
- ❌ Voice input/output
- ❌ Image generation
- ❌ Image search

### Full Configuration (All Features)

Add all optional services for complete functionality:

```env
# Required (from above)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENROUTER_API_KEY=...

# Optional
ELEVENLABS_API_KEY=...
REPLICATE_API_TOKEN=...
REPLICATE_WEBHOOK_SECRET=...
SERPER_API_KEY=...
```

**Features available:**
- ✅ Text-based lessons
- ✅ Canvas interactions
- ✅ Lesson history
- ✅ Voice input/output (ElevenLabs)
- ✅ Image generation (Replicate)
- ✅ Image search (Serper)

## Customization

### Voice Settings

Override default voice settings in `.env.local`:

```env
# Use a different voice
ELEVENLABS_VOICE_ID=your-voice-id

# Use a different TTS model
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5
```

### AI Model Settings

Override default AI models:

```env
# Use a different main tutor model
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet

# Use a different vision model
OPENROUTER_IMAGE_MODEL=openai/gpt-4o-mini

# Custom OpenRouter settings
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_HTTP_REFERER=https://your-domain.com
OPENROUTER_APP_NAME=My Custom App
```

## Database Setup

### Supabase Schema

The platform requires specific database tables. These are created automatically via Supabase migrations.

If you need to set up manually:

1. Go to your Supabase project
2. Navigate to SQL Editor
3. Run the migration files in `supabase/migrations/`

### Storage Buckets

Required storage buckets:
- `media-assets` - Lesson images and diagrams
- `canvas-snapshots` - Learner drawings
- `lesson-articles` - Generated lesson articles

These are created automatically on first use.

## Testing

Run the test suite:

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch
```

## Troubleshooting

### "ELEVENLABS_API_KEY is not configured"

Voice features are optional. Either:
- Add the API key to `.env.local`
- Use the platform in text-only mode (voice features will be disabled)

### "OPENROUTER_API_KEY is not configured"

This is required. Get a key from [openrouter.ai/keys](https://openrouter.ai/keys).

### "Failed to generate token" (ElevenLabs)

Check that:
1. Your API key is valid
2. You have credits in your ElevenLabs account
3. The key has the correct permissions

### Replicate webhook not working

Ensure:
1. `REPLICATE_WEBHOOK_SECRET` starts with `whsec_`
2. Your webhook URL is publicly accessible
3. The webhook is configured in your Replicate account

### Database connection errors

Verify:
1. Supabase project is active
2. All three Supabase keys are correct
3. Your IP is not blocked by Supabase

## Development Tips

### Guest Mode

The platform runs in guest mode by default:
- No authentication required
- Data stored in browser localStorage
- Perfect for development and demos

### Voice Testing

To test voice features without using credits:
- Use short test phrases
- Test with text mode first
- Check browser console for errors

### Image Generation

Image generation runs asynchronously:
- Lessons start immediately without waiting
- Generated images appear when ready
- Check Replicate dashboard for job status

## Next Steps

- Read the [README.md](README.md) for project overview
- Check [docs/](docs/) for detailed feature documentation
- Review [.kiro/specs/](./kiro/specs/) for architecture details

## Getting Help

- Check existing documentation in `docs/`
- Review environment variable descriptions in `.env.example`
- Check the browser console for client-side errors
- Check the terminal for server-side errors

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Use production-grade Supabase project
3. Configure proper CORS settings
4. Set up Replicate webhooks with public URL
5. Enable Supabase RLS policies
6. Review security settings for all services
7. Enable Web Analytics in the Vercel dashboard to see visits and unique visitors for this app

See deployment documentation for platform-specific guides (Vercel, Railway, etc.).
