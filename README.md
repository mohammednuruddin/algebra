This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Live Tutor Media

Background tutor image generation and quiz-variant editing use Replicate webhooks plus Supabase storage.

Required env vars:

- `REPLICATE_API_TOKEN`
- `REPLICATE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`

Implementation notes live in [docs/2026-04-23-live-tutor-image-generation.md](/Users/nuru/sanchrobytes/algebra/docs/2026-04-23-live-tutor-image-generation.md).

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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
