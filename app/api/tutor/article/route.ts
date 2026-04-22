import { NextRequest, NextResponse } from 'next/server';
import { buildOpenRouterRequest } from '@/lib/ai/openrouter';
import type { TutorRuntimeSnapshot } from '@/lib/types/tutor';
import { retryAsync } from '@/lib/utils/retry';

interface ArticleGenerationRequest {
  snapshot: TutorRuntimeSnapshot;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
  } catch {
    return null;
  }
}

class RetryableArticleGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableArticleGenerationError';
  }
}

function isRetryableArticleGenerationError(
  error: unknown
): error is RetryableArticleGenerationError {
  return error instanceof RetryableArticleGenerationError;
}

async function generateArticleContent(snapshot: TutorRuntimeSnapshot) {
  const turnsSummary = snapshot.turns
    .map((turn) => `${turn.actor}: ${turn.text}`)
    .join('\n');

  const imageContext = snapshot.mediaAssets.length
    ? snapshot.mediaAssets
        .map((asset) => `- ${asset.altText}: ${asset.url}`)
        .join('\n')
    : 'No images used.';

  const messages = [
    {
      role: 'system' as const,
      content:
        'You generate lesson articles from tutoring session transcripts. Return strict JSON with keys: title (string), article_markdown (string). The article_markdown must be real, polished Markdown meant to be rendered in a markdown viewer. Make it a study guide, not a transcript. Required structure: start with a single # title, then include sections such as ## Overview, ## Key Ideas, ## Worked Example or ## What We Practiced, ## Common Mistakes or ## Checks for Understanding, and ## Recap or ## Practice Prompts when relevant. Use bullet lists, numbered steps, tables, and fenced code blocks with language tags when they help. Use LaTeX math with $...$ inline and $$...$$ display. Include image references using ![description](url) syntax where relevant images were shown. Do not output raw JSON inside article_markdown, do not write conversational filler, and do not leave it as plain prose paragraphs only.',
    },
    {
      role: 'user' as const,
      content: `Generate a lesson article from this tutoring session.\n\nTopic: ${snapshot.lessonTopic}\nLearner level: ${snapshot.learnerLevel}\nLesson outline:\n${snapshot.lessonOutline.join('\n')}\n\nImages used:\n${imageContext}\n\nSession transcript:\n${turnsSummary}\n\nGenerate a well-formatted markdown study guide that captures the teaching content, the learner's practice, and the clearest examples from the session.`,
    },
  ];

  const outbound = buildOpenRouterRequest({
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const response = await fetch(outbound.url, {
    method: 'POST',
    headers: outbound.headers,
    body: JSON.stringify(outbound.body),
  });

  const text = await response.text();

  if (!response.ok) {
    const message = `Article generation failed (${response.status}): ${text.slice(0, 200)}`;

    if (response.status === 429 || response.status >= 500) {
      throw new RetryableArticleGenerationError(message);
    }

    throw new Error(message);
  }

  const payload = parseJson(text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new RetryableArticleGenerationError('Article generation returned no content');
  }

  const parsed = parseJson(content) as {
    title?: string;
    article_markdown?: string;
  };

  if (!parsed || !parsed.article_markdown) {
    throw new RetryableArticleGenerationError('Article generation returned invalid format');
  }

  return parsed;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ArticleGenerationRequest;
    const { snapshot } = body;

    if (!snapshot) {
      return NextResponse.json({ error: 'Missing snapshot' }, { status: 400 });
    }
    let attemptsUsed = 0;
    const parsed = await retryAsync(
      async (attempt) => {
        attemptsUsed = attempt;
        return generateArticleContent(snapshot);
      },
      {
        attempts: 3,
        shouldRetry: isRetryableArticleGenerationError,
      }
    ).catch((error) => {
      if (isRetryableArticleGenerationError(error)) {
        throw new Error(`${error.message} after ${attemptsUsed} attempts`);
      }

      throw error;
    });

    const articleId = `article_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const article = {
      id: articleId,
      session_id: snapshot.sessionId,
      user_id: 'guest',
      title: parsed.title || snapshot.lessonTopic,
      article_markdown: parsed.article_markdown,
      article_storage_path: '',
      metadata_json: {
        topic: snapshot.lessonTopic,
        learnerLevel: snapshot.learnerLevel,
        turnCount: snapshot.turns.length,
        imageCount: snapshot.mediaAssets.length,
      },
      created_at: now,
      updated_at: now,
    };

    return NextResponse.json({ article });
  } catch (error) {
    console.error('Error generating article:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate article' },
      { status: 500 }
    );
  }
}
