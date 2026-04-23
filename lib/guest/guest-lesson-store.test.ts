import { beforeEach, describe, expect, it } from 'vitest';

import {
  getGuestContinuationContextByArticleId,
  listGuestHistoryItems,
  saveGuestLesson,
  type GuestLessonRecord,
} from './guest-lesson-store';

function buildLesson(overrides: Partial<GuestLessonRecord> = {}): GuestLessonRecord {
  return {
    id: 'lesson-1',
    guestId: 'guest-1',
    topicPrompt: 'pollination',
    title: 'pollination',
    createdAt: '2026-04-22T10:00:00.000Z',
    updatedAt: '2026-04-22T10:00:00.000Z',
    status: 'complete',
    lessonPlan: null,
    mediaAssets: [],
    activeImageId: null,
    currentMilestoneId: null,
    lastResponse: null,
    turns: [],
    summary: null,
    article: {
      id: 'article-1',
      session_id: 'lesson-1',
      user_id: 'guest',
      title: 'Pollination',
      article_markdown:
        '# Pollination\n\n![Flower diagram](https://example.com/flower.png)\n\n## Overview\n\nStudy notes.',
      article_storage_path: '',
      metadata_json: {
        topic: 'pollination',
      },
      created_at: '2026-04-22T10:05:00.000Z',
      updated_at: '2026-04-22T10:05:00.000Z',
    },
    continuationContext: null,
    ...overrides,
  };
}

describe('listGuestHistoryItems', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('recovers the first image from article markdown for older lessons missing media metadata', () => {
    saveGuestLesson(buildLesson());

    const historyItems = listGuestHistoryItems();

    expect(historyItems).toHaveLength(1);
    expect(historyItems[0]?.metadata_json?.first_image_url).toBe(
      'https://example.com/flower.png'
    );
  });

  it('returns hidden continuation context for a saved article without exposing it in history metadata', () => {
    saveGuestLesson(
      buildLesson({
        continuationContext: {
          sourceSessionId: 'lesson-1',
          sourceArticleId: 'article-1',
          topic: 'pollination',
          learnerLevel: 'beginner',
          outline: ['Identify the flower parts.', 'Explain how pollen moves.'],
          turns: [
            {
              actor: 'user',
              text: 'What is pollination?',
              createdAt: '2026-04-22T10:00:00.000Z',
            },
            {
              actor: 'tutor',
              text: 'Pollination moves pollen from anther to stigma.',
              createdAt: '2026-04-22T10:00:03.000Z',
            },
          ],
          mediaAssets: [],
          activeImageId: null,
          canvasSummary: 'No board task remained active.',
          canvas: {
            mode: 'distribution',
            headline: 'Tutor workspace',
            instruction: 'Listen and respond.',
            tokens: [],
            zones: [],
            equation: null,
            fillBlank: null,
            codeBlock: null,
            multipleChoice: null,
            numberLine: null,
            tableGrid: null,
            graphPlot: null,
            matchingPairs: null,
            ordering: null,
            textResponse: null,
            drawing: null,
          },
          strengths: ['Can explain the main idea in plain words.'],
          weaknesses: ['Still mixes up anther and stigma.'],
          recommendedNextSteps: ['Practice labeling flower parts on a diagram.'],
          resumeHint: 'Resume with flower-part labeling, then move into pollen transfer.',
          completedAt: '2026-04-22T10:05:00.000Z',
        },
      })
    );

    const continuation = getGuestContinuationContextByArticleId('article-1');
    const historyItems = listGuestHistoryItems();

    expect(continuation?.resumeHint).toBe(
      'Resume with flower-part labeling, then move into pollen transfer.'
    );
    expect(historyItems[0]?.metadata_json).not.toHaveProperty('resumeHint');
    expect(historyItems[0]?.metadata_json).not.toHaveProperty('strengths');
  });
});
