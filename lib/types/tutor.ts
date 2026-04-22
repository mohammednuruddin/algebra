export type TutorSessionStatus = 'preparing' | 'active' | 'completed';

export type TutorAwaitMode = 'voice' | 'voice_or_canvas';

export type TutorCanvasMode = 'distribution' | 'equation';

export interface TutorCanvasToken {
  id: string;
  label: string;
  color: string;
  zoneId: string | null;
}

export interface TutorCanvasZone {
  id: string;
  label: string;
  hint?: string;
  accent?: string;
  count?: number;
  color?: string;
}

export interface TutorMediaAsset {
  id: string;
  url: string;
  altText: string;
  description: string;
  thumbnailUrl?: string;
  source?: string;
  domain?: string;
  metadata?: Record<string, unknown>;
}

export interface TutorEquationChoice {
  id: string;
  label: string;
  value: string;
  isCorrect?: boolean;
}

export interface TutorEquationState {
  prompt: string;
  expression: string;
  selectedChoiceId: string | null;
  choices: TutorEquationChoice[];
}

export interface TutorCanvasState {
  mode: TutorCanvasMode;
  headline: string;
  instruction: string;
  tokens: TutorCanvasToken[];
  zones: TutorCanvasZone[];
  equation: TutorEquationState | null;
}

export interface TutorIntakeState {
  status: 'active' | 'complete';
  topic: string | null;
  learnerLevel: string | null;
}

export type TutorCanvasCommand =
  | {
      type: 'set_mode';
      mode: TutorCanvasMode;
    }
  | {
      type: 'set_headline';
      headline: string;
    }
  | {
      type: 'set_instruction';
      instruction: string;
    }
  | {
      type: 'set_tokens';
      tokens: Array<Partial<TutorCanvasToken> & { label: string }>;
    }
  | {
      type: 'clear_tokens';
    }
  | {
      type: 'set_zones';
      zones: Array<
        Partial<TutorCanvasZone> & {
          label: string;
          count?: number;
          color?: string;
        }
      >;
    }
  | {
      type: 'set_equation';
      prompt: string;
      expression: string;
      choices: Array<Partial<TutorEquationChoice> & { label: string; value: string }>;
    }
  | {
      type: 'clear_equation';
    }
  | {
      type: 'show_image';
      imageId?: string;
      imageIndex?: number;
    }
  | {
      type: 'clear_image';
    }
  | {
      type: 'complete_session';
    };

export interface TutorTurn {
  actor: 'user' | 'tutor';
  text: string;
  createdAt: string;
  canvasSummary?: string;
}

export interface TutorRuntimeSnapshot {
  sessionId: string;
  prompt: string;
  lessonTopic: string;
  learnerLevel: string;
  lessonOutline: string[];
  status: TutorSessionStatus;
  speech: string;
  awaitMode: TutorAwaitMode;
  speechRevision: number;
  mediaAssets: TutorMediaAsset[];
  activeImageId: string | null;
  canvas: TutorCanvasState;
  turns: TutorTurn[];
  intake: TutorIntakeState | null;
}

export interface TutorLlmDebugTrace {
  stage: 'session_create' | 'turn';
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  rawResponseText: string | null;
  rawModelContent: string | null;
  parsedResponse: unknown;
  usedFallback: boolean;
  fallbackReason: string | null;
}

export interface TutorSessionCreateResponse {
  snapshot: TutorRuntimeSnapshot;
  debug?: TutorLlmDebugTrace;
}

export interface TutorTurnResponse {
  snapshot: TutorRuntimeSnapshot;
  debug?: TutorLlmDebugTrace;
}
