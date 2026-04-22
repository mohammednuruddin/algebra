export type TutorSessionStatus = 'preparing' | 'active' | 'completed';

export type TutorAwaitMode = 'voice' | 'voice_or_canvas';

export type TutorCanvasMode =
  | 'distribution'
  | 'equation'
  | 'fill_blank'
  | 'code_block'
  | 'multiple_choice'
  | 'number_line'
  | 'table_grid'
  | 'graph_plot'
  | 'matching_pairs'
  | 'ordering'
  | 'text_response'
  | 'drawing';

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

export interface TutorFillBlankSlot {
  id: string;
  placeholder: string;
  correctAnswer?: string;
  userAnswer: string;
}

export interface TutorFillBlankState {
  prompt: string;
  beforeText: string;
  afterText: string;
  slots: TutorFillBlankSlot[];
  submitted: boolean;
}

export interface TutorCodeBlockState {
  prompt: string;
  language: string;
  starterCode: string;
  userCode: string;
  expectedOutput?: string;
  submitted: boolean;
}

export interface TutorMultipleChoiceOption {
  id: string;
  label: string;
  isCorrect?: boolean;
}

export interface TutorMultipleChoiceState {
  prompt: string;
  options: TutorMultipleChoiceOption[];
  selectedId: string | null;
  allowMultiple: boolean;
  selectedIds: string[];
  submitted: boolean;
}

export interface TutorNumberLineState {
  prompt: string;
  min: number;
  max: number;
  step: number;
  correctValue?: number;
  userValue: number | null;
  showTicks: boolean;
  labels?: Array<{ value: number; label: string }>;
  submitted: boolean;
}

export interface TutorTableCell {
  row: number;
  col: number;
  value: string;
  editable: boolean;
  correctAnswer?: string;
}

export interface TutorTableGridState {
  prompt: string;
  headers: string[];
  rows: number;
  cols: number;
  cells: TutorTableCell[];
  submitted: boolean;
}

export interface TutorGraphPoint {
  id: string;
  x: number;
  y: number;
  label?: string;
  userPlaced: boolean;
}

export interface TutorGraphPlotState {
  prompt: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xLabel: string;
  yLabel: string;
  gridLines: boolean;
  presetPoints: TutorGraphPoint[];
  userPoints: TutorGraphPoint[];
  expectedPoints?: Array<{ x: number; y: number }>;
  submitted: boolean;
}

export interface TutorMatchingItem {
  id: string;
  label: string;
}

export interface TutorMatchingPairsState {
  prompt: string;
  leftItems: TutorMatchingItem[];
  rightItems: TutorMatchingItem[];
  correctPairs: Array<{ leftId: string; rightId: string }>;
  userPairs: Array<{ leftId: string; rightId: string }>;
  submitted: boolean;
}

export interface TutorOrderingItem {
  id: string;
  label: string;
  correctPosition?: number;
}

export interface TutorOrderingState {
  prompt: string;
  items: TutorOrderingItem[];
  userOrder: string[];
  submitted: boolean;
}

export interface TutorTextResponseState {
  prompt: string;
  placeholder: string;
  userText: string;
  maxLength?: number;
  submitted: boolean;
}

export interface TutorDrawingState {
  prompt: string;
  backgroundImageUrl?: string;
  canvasWidth: number;
  canvasHeight: number;
  brushColor: string;
  brushSize: number;
  submitted: boolean;
}

export interface TutorCanvasState {
  mode: TutorCanvasMode;
  headline: string;
  instruction: string;
  tokens: TutorCanvasToken[];
  zones: TutorCanvasZone[];
  equation: TutorEquationState | null;
  fillBlank: TutorFillBlankState | null;
  codeBlock: TutorCodeBlockState | null;
  multipleChoice: TutorMultipleChoiceState | null;
  numberLine: TutorNumberLineState | null;
  tableGrid: TutorTableGridState | null;
  graphPlot: TutorGraphPlotState | null;
  matchingPairs: TutorMatchingPairsState | null;
  ordering: TutorOrderingState | null;
  textResponse: TutorTextResponseState | null;
  drawing: TutorDrawingState | null;
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
      type: 'set_fill_blank';
      prompt: string;
      beforeText: string;
      afterText: string;
      slots: Array<Partial<TutorFillBlankSlot> & { placeholder: string }>;
    }
  | {
      type: 'clear_fill_blank';
    }
  | {
      type: 'set_code_block';
      prompt: string;
      language: string;
      starterCode: string;
      expectedOutput?: string;
    }
  | {
      type: 'clear_code_block';
    }
  | {
      type: 'set_multiple_choice';
      prompt: string;
      options: Array<{ label: string; isCorrect?: boolean }>;
      allowMultiple?: boolean;
    }
  | {
      type: 'clear_multiple_choice';
    }
  | {
      type: 'set_number_line';
      prompt: string;
      min: number;
      max: number;
      step?: number;
      correctValue?: number;
      showTicks?: boolean;
      labels?: Array<{ value: number; label: string }>;
    }
  | {
      type: 'clear_number_line';
    }
  | {
      type: 'set_table_grid';
      prompt: string;
      headers: string[];
      rows: number;
      cells?: Array<{ row: number; col: number; value: string; editable?: boolean; correctAnswer?: string }>;
    }
  | {
      type: 'clear_table_grid';
    }
  | {
      type: 'set_graph_plot';
      prompt: string;
      xMin?: number;
      xMax?: number;
      yMin?: number;
      yMax?: number;
      xLabel?: string;
      yLabel?: string;
      gridLines?: boolean;
      presetPoints?: Array<{ x: number; y: number; label?: string }>;
      expectedPoints?: Array<{ x: number; y: number }>;
    }
  | {
      type: 'clear_graph_plot';
    }
  | {
      type: 'set_matching_pairs';
      prompt: string;
      leftItems: Array<{ label: string }>;
      rightItems: Array<{ label: string }>;
      correctPairs: Array<{ leftIndex: number; rightIndex: number }>;
    }
  | {
      type: 'clear_matching_pairs';
    }
  | {
      type: 'set_ordering';
      prompt: string;
      items: Array<{ label: string; correctPosition?: number }>;
    }
  | {
      type: 'clear_ordering';
    }
  | {
      type: 'set_text_response';
      prompt: string;
      placeholder?: string;
      maxLength?: number;
    }
  | {
      type: 'clear_text_response';
    }
  | {
      type: 'set_drawing';
      prompt: string;
      backgroundImageUrl?: string;
      canvasWidth?: number;
      canvasHeight?: number;
      brushColor?: string;
      brushSize?: number;
    }
  | {
      type: 'clear_drawing';
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
