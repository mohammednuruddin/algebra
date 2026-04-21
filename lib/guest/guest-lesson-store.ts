import type {
  LessonPlan,
  MediaAsset,
  SessionSummary,
  TeacherResponse,
} from '@/lib/types/lesson';
import type { LessonArticleRecord } from '@/lib/types/database';
import { getGuestId } from './guest-id';
import { readJson, writeJson } from './guest-storage';

const GUEST_LESSONS_KEY = 'guest_lesson_sessions';

export type GuestLessonTurn = {
  actor: 'learner' | 'teacher';
  createdAt: string;
  payload: unknown;
};

export type GuestLessonRecord = {
  id: string;
  guestId: string;
  topicPrompt: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: 'planning' | 'active' | 'complete';
  lessonPlan: LessonPlan | null;
  mediaAssets: MediaAsset[];
  activeImageId: string | null;
  currentMilestoneId: string | null;
  lastResponse: TeacherResponse | null;
  turns: GuestLessonTurn[];
  summary: SessionSummary | null;
  article: LessonArticleRecord | null;
};

export type GuestHistoryItem = {
  id: string;
  title: string;
  created_at: string;
  metadata_json: {
    topic?: string;
    duration?: number;
    milestones_covered?: number;
    total_milestones?: number;
    completion_percentage?: number;
    difficulty?: string;
    first_image_url?: string;
  } | null;
};

function readLessons() {
  return readJson<GuestLessonRecord[]>(GUEST_LESSONS_KEY, []);
}

function writeLessons(lessons: GuestLessonRecord[]) {
  writeJson(GUEST_LESSONS_KEY, lessons);
}

function nextTimestamp() {
  return new Date().toISOString();
}

function nextId() {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createGuestLesson(topicPrompt: string): GuestLessonRecord {
  const now = nextTimestamp();

  return {
    id: nextId(),
    guestId: getGuestId(),
    topicPrompt,
    title: topicPrompt,
    createdAt: now,
    updatedAt: now,
    status: 'planning',
    lessonPlan: null,
    mediaAssets: [],
    activeImageId: null,
    currentMilestoneId: null,
    lastResponse: null,
    turns: [],
    summary: null,
    article: null,
  };
}

export function saveGuestLesson(lesson: GuestLessonRecord) {
  const lessons = readLessons().filter((item) => item.id !== lesson.id);
  writeLessons([
    {
      ...lesson,
      updatedAt: nextTimestamp(),
    },
    ...lessons,
  ]);
}

export function getGuestLesson(id: string) {
  return readLessons().find((lesson) => lesson.id === id) ?? null;
}

export function listGuestLessons() {
  return [...readLessons()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function appendGuestLessonTurn(
  id: string,
  turn: GuestLessonTurn
): GuestLessonRecord | null {
  const lesson = getGuestLesson(id);
  if (!lesson) {
    return null;
  }

  const updated: GuestLessonRecord = {
    ...lesson,
    turns: [...lesson.turns, turn],
  };

  saveGuestLesson(updated);
  return updated;
}

export function listGuestHistoryItems(): GuestHistoryItem[] {
  return listGuestLessons()
    .filter((lesson) => lesson.article)
    .map((lesson) => ({
      id: lesson.article!.id,
      title: lesson.article!.title,
      created_at: lesson.article!.created_at,
      metadata_json:
        (lesson.article!.metadata_json as GuestHistoryItem['metadata_json']) ?? null,
    }));
}

export function getGuestArticle(articleId: string) {
  return (
    listGuestLessons().find((lesson) => lesson.article?.id === articleId)?.article ?? null
  );
}
