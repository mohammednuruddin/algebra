import { NextRequest, NextResponse } from 'next/server';
import { buildOpenRouterRequest } from '@/lib/ai/openrouter';
import { formatTutorDebugMessages, formatTutorDebugValue } from '@/lib/tutor/debug-log';
import type { TutorRuntimeSnapshot } from '@/lib/types/tutor';
import { retryAsync } from '@/lib/utils/retry';

interface ArticleGenerationRequest {
  snapshot: TutorRuntimeSnapshot;
}

type ArticleGenerationDebugAttempt = {
  attempt: number;
  messages: Array<{
    role: 'system' | 'user';
    content: string;
  }>;
  responseStatus: number | null;
  rawResponseText: string | null;
  rawModelContent: string | null;
  parsedResponse: unknown;
  error: string | null;
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
  } catch {
    return null;
  }
}

class ArticleGenerationAttemptError extends Error {
  constructor(
    message: string,
    readonly debugAttempt: ArticleGenerationDebugAttempt,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = 'ArticleGenerationAttemptError';
  }
}

function isArticleGenerationAttemptError(
  error: unknown
): error is ArticleGenerationAttemptError {
  return error instanceof ArticleGenerationAttemptError;
}

function logArticleAttemptDebug(debug: ArticleGenerationDebugAttempt) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(
    `[tutor:article] attempt ${debug.attempt} prompt\n${JSON.stringify(
      formatTutorDebugMessages(debug.messages),
      null,
      2
    )}`
  );
  console.log(
    `[tutor:article] attempt ${debug.attempt} response status`,
    debug.responseStatus
  );
  console.log(
    `[tutor:article] attempt ${debug.attempt} raw response text`,
    formatTutorDebugValue(debug.rawResponseText)
  );
  console.log(
    `[tutor:article] attempt ${debug.attempt} raw model content`,
    formatTutorDebugValue(debug.rawModelContent)
  );
  console.log(
    `[tutor:article] attempt ${debug.attempt} parsed response`,
    formatTutorDebugValue(debug.parsedResponse)
  );
  console.log(`[tutor:article] attempt ${debug.attempt} error`, debug.error);
}

function buildArticleAttemptDebug(
  attempt: number,
  messages: ArticleGenerationDebugAttempt['messages'],
  overrides: Partial<Omit<ArticleGenerationDebugAttempt, 'attempt' | 'messages'>>
): ArticleGenerationDebugAttempt {
  return {
    attempt,
    messages,
    responseStatus: null,
    rawResponseText: null,
    rawModelContent: null,
    parsedResponse: null,
    error: null,
    ...overrides,
  };
}

function buildArticleAttemptError(
  message: string,
  debugAttempt: ArticleGenerationDebugAttempt,
  retryable: boolean
) {
  const debug = {
    ...debugAttempt,
    error: message,
  };

  logArticleAttemptDebug(debug);
  return new ArticleGenerationAttemptError(message, debug, retryable);
}

async function generateArticleContent(
  snapshot: TutorRuntimeSnapshot,
  attempt: number
) {
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
  const responseStatus = response.status;

  if (!response.ok) {
    const message = `Article generation failed (${response.status}): ${text.slice(0, 200)}`;
    const debugAttempt = buildArticleAttemptDebug(attempt, messages, {
      responseStatus,
      rawResponseText: text,
    });

    if (response.status === 429 || response.status >= 500) {
      throw buildArticleAttemptError(message, debugAttempt, true);
    }

    throw buildArticleAttemptError(message, debugAttempt, false);
  }

  const payload = parseJson(text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw buildArticleAttemptError(
      'Article generation returned no content',
      buildArticleAttemptDebug(attempt, messages, {
        responseStatus,
        rawResponseText: text,
        parsedResponse: payload,
      }),
      true
    );
  }

  const parsed = parseJson(content) as {
    title?: string;
    article_markdown?: string;
  };

  if (!parsed || !parsed.article_markdown) {
    throw buildArticleAttemptError(
      'Article generation returned invalid format',
      buildArticleAttemptDebug(attempt, messages, {
        responseStatus,
        rawResponseText: text,
        rawModelContent: content,
        parsedResponse: parsed,
      }),
      true
    );
  }

  return parsed;
}

export async function POST(request: NextRequest) {
  const debugAttempts: ArticleGenerationDebugAttempt[] = [];
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
        try {
          return await generateArticleContent(snapshot, attempt);
        } catch (error) {
          if (isArticleGenerationAttemptError(error)) {
            debugAttempts.push(error.debugAttempt);
          }

          throw error;
        }
      },
      {
        attempts: 3,
        shouldRetry: (error) =>
          isArticleGenerationAttemptError(error) ? error.retryable : false,
      }
    ).catch((error) => {
      if (isArticleGenerationAttemptError(error)) {
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
      {
        error: error instanceof Error ? error.message : 'Failed to generate article',
        ...(process.env.NODE_ENV === 'production'
          ? {}
          : {
              debug: {
                attempts: debugAttempts,
              },
            }),
      },
      { status: 500 }
    );
  }
}
