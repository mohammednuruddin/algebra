# AI Teaching Platform

An interactive, voice-first teaching platform that provides personalized lessons on any topic. Built with Next.js, Supabase, and powered by AI agents for lesson planning, teaching, and multimodal interactions.

## Features

- **Voice-First Learning**: Natural voice interactions with automatic turn detection using ElevenLabs
- **Multimodal Input**: Respond using voice, text, canvas drawing, or image annotation
- **Interactive Canvas**: 28+ canvas modes including drawing, graphing, code execution, and image generation
- **Lesson Planning**: AI-generated structured lesson plans with milestones and progress tracking
- **Visual Learning**: Automatic image search and generation for concepts
- **Article Generation**: Completed lessons saved as comprehensive markdown articles with images and formulas
- **Lesson History**: Personal knowledge library with search and PDF export
- **Guest Mode**: Try the platform immediately without authentication
- **Read Aloud**: Listen to saved articles with text-to-speech

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Storage, Auth, Edge Functions)
- **AI**: OpenRouter (GPT-4, Claude), ElevenLabs (TTS/STT)
- **Media**: Replicate (image generation), Serper (image search)
- **Canvas**: Pyodide (Python execution), Monaco Editor (code), KaTeX (math)

## Getting Started

### Quick Setup

For detailed setup instructions, see [SETUP.md](SETUP.md).

### Environment Setup

1. Copy the environment template:
```bash
npm run setup
# or manually: cp .env.example .env.local
```

2. Fill in your API keys in `.env.local`:
   - **Required**: Supabase credentials, OpenRouter API key
   - **Optional**: ElevenLabs (voice), Replicate (image generation), Serper (image search)

See `.env.example` for detailed configuration options.

### Development Server

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Open [http://localhost:3000](http://localhost:3000) to start learning.

## Project Structure

```
app/                    # Next.js app router pages
├── api/               # API routes (AI chat, ElevenLabs, lesson management)
├── lessons/           # Lesson UI (history, articles)
└── page.tsx           # Main tutor interface

components/
├── lesson/            # Core lesson components (canvas, voice, input)
└── tutor/             # Tutor experience components

lib/
├── ai/                # AI agent implementations
├── canvas/            # Canvas modes and tools
├── stt/               # Speech-to-text (ElevenLabs Scribe)
├── tts/               # Text-to-speech (ElevenLabs)
└── types/             # TypeScript definitions

.kiro/specs/           # Project documentation and tasks
```

## Environment Variables

The platform requires several API keys for full functionality. See `.env.example` for a complete list.

### Core Services

| Service | Purpose | Required |
|---------|---------|----------|
| **Supabase** | Database, storage, auth | ✅ Yes |
| **OpenRouter** | AI models (tutor, vision) | ✅ Yes |
| **ElevenLabs** | Voice (TTS + STT) | Optional |
| **Replicate** | Image generation | Optional |
| **Serper** | Image search | Optional |

### Quick Setup

```bash
# Copy the template
cp .env.example .env.local

# Edit with your keys
nano .env.local
```

**Minimum configuration** (text-only mode):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENROUTER_API_KEY=your-openrouter-key
```

**Full configuration** (all features):
```env
# Add the above, plus:
ELEVENLABS_API_KEY=your-elevenlabs-key
REPLICATE_API_TOKEN=your-replicate-token
REPLICATE_WEBHOOK_SECRET=whsec_your-webhook-secret
SERPER_API_KEY=your-serper-key
```

See `.env.example` for detailed documentation of each variable.

## Key Features Explained

### Voice Interaction
- Uses ElevenLabs Eleven Flash v2.5 for fast, natural TTS
- Browser-based voice activity detection with Silero VAD
- Automatic turn detection and barge-in support
- ElevenLabs Scribe for real-time speech-to-text

### Canvas Modes
The platform includes 28+ interactive canvas modes:
- **Drawing**: Freehand, shapes, annotations
- **Math**: Graphing calculator, equation solver, geometry
- **Code**: Python execution (Pyodide), code editor (Monaco)
- **Media**: Image generation (Replicate), image analysis
- **Interactive**: Quizzes, flashcards, timelines, mind maps

### Lesson Flow
1. **Planning**: AI generates structured lesson plan with milestones
2. **Media Prep**: Searches/generates relevant images and diagrams
3. **Teaching**: Interactive turns with voice, text, and canvas
4. **Progress**: Real-time milestone tracking
5. **Summary**: Generates comprehensive article with all content

### Article System
- Markdown format with embedded images and LaTeX formulas
- Searchable lesson history with thumbnails
- PDF export and shareable links
- Read-aloud feature for accessibility

## Documentation

- [SETUP.md](SETUP.md) - Detailed setup instructions
- [.kiro/specs/ai-teaching-platform/requirements.md](.kiro/specs/ai-teaching-platform/requirements.md) - Full requirements
- [.kiro/specs/ai-teaching-platform/design.md](.kiro/specs/ai-teaching-platform/design.md) - System design
- [.kiro/specs/ai-teaching-platform/tasks.md](.kiro/specs/ai-teaching-platform/tasks.md) - Development tasks

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

This app now includes the Vercel Web Analytics client. After deploying, enable Web Analytics for the project in the Vercel dashboard to see visits and unique visitors.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
