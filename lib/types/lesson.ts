// Core domain types for the AI Teaching Platform

// ─── Lesson Plan Types ──────────────────────────────────────────────────────────

export interface Milestone {
  id: string;
  title: string;
  description: string;
  required: boolean;
  successCriteria: string[];
  estimatedDuration?: number; // in minutes
}

export interface Concept {
  id: string;
  name: string;
  description: string;
  relatedMilestones: string[];
  misconceptions?: string[];
}

export interface LessonPlan {
  topic: string;
  normalizedTopic: string;
  objective: string;
  milestones: Milestone[];
  concepts: Concept[];
  estimatedDuration: number; // in minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  visualsNeeded: boolean;
  interactiveMoments: InteractiveMoment[];
}

export interface InteractiveMoment {
  id: string;
  type: 'question' | 'canvas_task' | 'image_annotation' | 'voice_response';
  milestoneId: string;
  prompt: string;
  expectedResponseType: string;
}

// ─── Media Types ────────────────────────────────────────────────────────────────

export interface MediaAsset {
  id: string;
  type: 'image' | 'diagram' | 'chart' | 'formula';
  url: string;
  storagePath: string;
  thumbnailUrl?: string;
  description: string;
  altText: string;
  source?: string;
  domain?: string;
  metadata?: Record<string, unknown>;
  relatedMilestones: string[];
}

export interface MediaManifest {
  assets: MediaAsset[];
  prefetchUrls: string[];
  totalSize: number; // in bytes
}

export type LessonPreparationStageId =
  | 'session'
  | 'planning'
  | 'media_search'
  | 'media_analysis'
  | 'initializing'
  | 'ready';

export interface LessonPreparationStage {
  id: LessonPreparationStageId;
  label: string;
  detail?: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

// ─── Teaching Turn Types ────────────────────────────────────────────────────────

export type InputMode = 'voice' | 'text' | 'canvas_draw' | 'canvas_mark' | 'image_annotation' | 'selection' | 'mixed';

export interface LearnerInput {
  mode: InputMode;
  timestamp: Date;
  raw: {
    text?: string;
    audioUrl?: string;
    canvasSnapshotUrl?: string;
    imageAnnotationUrl?: string;
    selection?: string | number;
  };
  interpreted?: {
    text?: string;
    intent?: string;
    confidence?: number;
    markings?: InterpretedMarking[];
  };
}

export interface InterpretedMarking {
  type: 'circle' | 'arrow' | 'highlight' | 'text' | 'selection';
  target?: string;
  coordinates?: { x: number; y: number; width?: number; height?: number };
  confidence: number;
  meaning?: string;
}

export type TeachingActionType = 
  | 'speak'
  | 'display_text'
  | 'show_media'
  | 'highlight_concept'
  | 'enable_canvas'
  | 'enable_voice'
  | 'provide_feedback'
  | 'advance_milestone';

export interface TeachingAction {
  type: TeachingActionType;
  params: Record<string, unknown>;
  sequenceOrder: number;
}

export interface TeacherResponse {
  speech: string;
  displayText?: string;
  actions: TeachingAction[];
  awaitedInputMode: InputMode;
  currentMilestoneId: string;
  isCorrectAnswer?: boolean;
  feedback?: {
    type: 'positive' | 'corrective' | 'neutral';
    message: string;
  };
}

// ─── Canvas Types ───────────────────────────────────────────────────────────────

export interface CanvasSnapshot {
  id: string;
  sessionId: string;
  turnId?: string;
  imageUrl: string;
  storagePath: string;
  type: 'drawing' | 'annotation' | 'selection';
  timestamp: Date;
  interpretation?: {
    summary: string;
    markings: InterpretedMarking[];
    confidence: number;
  };
}

// ─── Session Status Types ───────────────────────────────────────────────────────

export type SessionStatus = 'planning' | 'ready' | 'active' | 'completed';

export type MilestoneStatus = 'not_started' | 'introduced' | 'practiced' | 'covered' | 'confirmed';

export interface MilestoneProgress {
  milestoneId: string;
  status: MilestoneStatus;
  attempts: number;
  correctAttempts: number;
  evidence: string[];
  lastUpdated: Date;
}

// ─── Session Summary Types ──────────────────────────────────────────────────────

export interface SessionSummary {
  topic: string;
  duration: number; // in minutes
  milestonesCompleted: number;
  milestonesTotal: number;
  accuracy: number; // percentage
  strengths: string[];
  areasForImprovement: string[];
  nextSteps: string[];
  keyTakeaways: string[];
}

// ─── Article Types ──────────────────────────────────────────────────────────────

export interface LessonArticle {
  id: string;
  sessionId: string;
  userId: string;
  title: string;
  markdown: string;
  storagePath: string;
  metadata: {
    topic: string;
    duration: number;
    completionDate: Date;
    milestonesCount: number;
    mediaReferences: string[];
    formulaCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ArticleMetadata {
  topic: string;
  date: Date;
  duration: number;
  milestonesCompleted: number;
  thumbnailUrl?: string;
  tags: string[];
}
