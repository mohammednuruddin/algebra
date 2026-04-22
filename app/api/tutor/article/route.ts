import { NextRequest, NextResponse } from 'next/server';
import { buildOpenRouterRequest } from '@/lib/ai/openrouter';
import type { TutorRuntimeSnapshot } from '@/lib/types/tutor';

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ArticleGenerationRequest;
    const { snapshot } = body;

    if (!snapshot) {
      return NextResponse.json({ error: 'Missing snapshot' }, { status: 400 });
    }

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
          'You generate lesson articles from tutoring session transcripts. Return strict JSON with keys: title (string), article_markdown (string). The article_markdown must be well-formatted Markdown with LaTeX math (use $...$ for inline and $$...$$ for display math). Include all key concepts covered, examples worked through, and any code discussed. Structure with clear headings. Include image references using ![description](url) syntax where relevant images were shown. Format code blocks with language identifiers. Make it a comprehensive study reference.',
      },
      {
        role: 'user' as const,
        content: `Generate a lesson article from this tutoring session.\n\nTopic: ${snapshot.lessonTopic}\nLearner level: ${snapshot.learnerLevel}\nLesson outline:\n${snapshot.lessonOutline.join('\n')}\n\nImages used:\n${imageContext}\n\nSession transcript:\n${turnsSummary}\n\nGenerate a well-formatted article that captures all the teaching content.`,
      },
    ];

    const outbound = buildOpenRouterRequest({
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 4000,
    });

    const response = await fetch(outbound.url, {
      method: 'POST',
      headers: outbound.headers,
      body: JSON.stringify(outbound.body),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Article generation failed (${response.status}): ${text.slice(0, 200)}`);
    }

    const payload = parseJson(text) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Article generation returned no content');
    }

    const parsed = parseJson(content) as {
      title?: string;
      article_markdown?: string;
    };

    if (!parsed || !parsed.article_markdown) {
      throw new Error('Article generation returned invalid format');
    }

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
