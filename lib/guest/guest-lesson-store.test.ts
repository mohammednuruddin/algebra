import { beforeEach, describe, expect, it } from 'vitest';

import { listGuestHistoryItems, saveGuestLesson, type GuestLessonRecord } from './guest-lesson-store';

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
});
