// Database record types matching Supabase schema

import type { 
  LessonPlan, 
  MediaManifest, 
  SessionSummary, 
  LearnerInput, 
  TeacherResponse,
  MilestoneStatus,
  SessionStatus
} from './lesson';

// ─── Database Table Types ───────────────────────────────────────────────────────

export interface LessonSessionRecord {
  id: string;
  user_id: string;
  topic_prompt: string;
  normalized_topic: string | null;
  status: SessionStatus;
  lesson_plan_json: LessonPlan | null;
  media_manifest_json: MediaManifest | null;
  current_milestone_id: string | null;
  summary_json: SessionSummary | null;
  article_path: string | null;
  article_generated_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface LessonTurnRecord {
  id: string;
  session_id: string;
  turn_index: number;
  actor: 'learner' | 'teacher';
  input_mode: string | null;
  raw_input_json: LearnerInput | null;
  interpreted_input_json: Record<string, unknown> | null;
  teacher_response_json: TeacherResponse | null;
  created_at: string;
}

export interface LessonMilestoneProgressRecord {
  id: string;
  session_id: string;
  milestone_id: string;
  status: MilestoneStatus;
  evidence_json: Record<string, unknown> | null;
  updated_at: string;
}

export interface LessonMediaAssetRecord {
  id: string;
  session_id: string;
  kind: 'searched' | 'generated' | 'uploaded';
  storage_path: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface CanvasSnapshotRecord {
  id: string;
  session_id: string;
  turn_id: string | null;
  storage_path: string;
  snapshot_type: string | null;
  interpreter_result_json: Record<string, unknown> | null;
  created_at: string;
}

export interface LessonArticleRecord {
  id: string;
  session_id: string;
  user_id: string;
  title: string;
  article_markdown: string;
  article_storage_path: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ─── Database Insert Types ──────────────────────────────────────────────────────

export type LessonSessionInsert = Omit<LessonSessionRecord, 'id' | 'created_at' | 'updated_at'>;
export type LessonTurnInsert = Omit<LessonTurnRecord, 'id' | 'created_at'>;
export type LessonMilestoneProgressInsert = Omit<LessonMilestoneProgressRecord, 'id' | 'updated_at'>;
export type LessonMediaAssetInsert = Omit<LessonMediaAssetRecord, 'id' | 'created_at'>;
export type CanvasSnapshotInsert = Omit<CanvasSnapshotRecord, 'id' | 'created_at'>;
export type LessonArticleInsert = Omit<LessonArticleRecord, 'id' | 'created_at' | 'updated_at'>;

// ─── Database Update Types ──────────────────────────────────────────────────────

export type LessonSessionUpdate = Partial<Omit<LessonSessionRecord, 'id' | 'user_id' | 'created_at'>>;
export type LessonTurnUpdate = Partial<Omit<LessonTurnRecord, 'id' | 'session_id' | 'created_at'>>;
export type LessonMilestoneProgressUpdate = Partial<Omit<LessonMilestoneProgressRecord, 'id' | 'session_id'>>;
export type LessonArticleUpdate = Partial<Omit<LessonArticleRecord, 'id' | 'session_id' | 'user_id' | 'created_at'>>;

export type TutorImageGenerationJobSourceType = 'generate' | 'edit';
export type TutorImageGenerationJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface TutorImageGenerationJobRecord {
  id: string;
  session_id: string;
  prediction_id: string;
  source_type: TutorImageGenerationJobSourceType;
  purpose: string;
  status: TutorImageGenerationJobStatus;
  prompt: string;
  source_image_id: string | null;
  requested_edits_json: Record<string, unknown> | null;
  asset_storage_path: string | null;
  asset_url: string | null;
  asset_alt_text: string | null;
  asset_description: string | null;
  asset_metadata_json: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

type TutorImageGenerationJobOptionalColumns =
  | 'source_image_id'
  | 'requested_edits_json'
  | 'asset_storage_path'
  | 'asset_url'
  | 'asset_alt_text'
  | 'asset_description'
  | 'asset_metadata_json'
  | 'error_message'
  | 'completed_at';

export type TutorImageGenerationJobInsert = Omit<
  TutorImageGenerationJobRecord,
  'id' | 'created_at' | 'updated_at' | TutorImageGenerationJobOptionalColumns
> &
  Partial<Pick<TutorImageGenerationJobRecord, TutorImageGenerationJobOptionalColumns>>;

export type TutorImageGenerationJobUpdate = Partial<
  Omit<TutorImageGenerationJobRecord, 'id' | 'created_at'>
>;

// ─── Supabase Client Types ──────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      lesson_sessions: {
        Row: LessonSessionRecord;
        Insert: LessonSessionInsert;
        Update: LessonSessionUpdate;
      };
      lesson_turns: {
        Row: LessonTurnRecord;
        Insert: LessonTurnInsert;
        Update: LessonTurnUpdate;
      };
      lesson_milestone_progress: {
        Row: LessonMilestoneProgressRecord;
        Insert: LessonMilestoneProgressInsert;
        Update: LessonMilestoneProgressUpdate;
      };
      lesson_media_assets: {
        Row: LessonMediaAssetRecord;
        Insert: LessonMediaAssetInsert;
        Update: Partial<LessonMediaAssetRecord>;
      };
      canvas_snapshots: {
        Row: CanvasSnapshotRecord;
        Insert: CanvasSnapshotInsert;
        Update: Partial<CanvasSnapshotRecord>;
      };
      lesson_articles: {
        Row: LessonArticleRecord;
        Insert: LessonArticleInsert;
        Update: LessonArticleUpdate;
      };
      tutor_image_generation_jobs: {
        Row: TutorImageGenerationJobRecord;
        Insert: TutorImageGenerationJobInsert;
        Update: TutorImageGenerationJobUpdate;
      };
    };
  };
}
