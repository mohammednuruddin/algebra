import type { OpenRouterContentPart } from '@/lib/ai/openrouter';

export type TutorSessionStatus = 'preparing' | 'active' | 'completed';

export type TutorAwaitMode = 'voice' | 'voice_or_canvas';
export type TutorCanvasAction = 'keep' | 'replace' | 'clear';

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
  | 'drawing'
  | 'image_hotspot'
  | 'timeline'
  | 'continuous_axis'
  | 'venn_diagram'
  | 'token_builder'
  | 'process_flow'
  | 'part_whole_builder'
  | 'map_canvas'
  | 'claim_evidence_builder'
  | 'compare_matrix'
  | 'flashcard'
  | 'true_false';

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
  sceneRevision?: number;
}

export interface TutorHotspot {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  isCorrect?: boolean;
}

export interface TutorImageHotspotState {
  prompt: string;
  backgroundImageUrl?: string;
  hotspots: TutorHotspot[];
  selectedHotspotIds: string[];
  allowMultiple: boolean;
  submitted: boolean;
}

export interface TutorTimelineItem {
  id: string;
  label: string;
  correctPosition?: number;
}

export interface TutorTimelineState {
  prompt: string;
  items: TutorTimelineItem[];
  userOrder: string[];
  submitted: boolean;
}

export interface TutorContinuousAxisState {
  prompt: string;
  min: number;
  max: number;
  step: number;
  correctValue?: number;
  correctRange?: { min: number; max: number };
  userValue: number | null;
  leftLabel?: string;
  rightLabel?: string;
  submitted: boolean;
}

export type TutorVennRegion = 'left' | 'overlap' | 'right';

export interface TutorVennItem {
  id: string;
  label: string;
  correctRegion?: TutorVennRegion;
}

export interface TutorVennDiagramState {
  prompt: string;
  leftLabel: string;
  rightLabel: string;
  items: TutorVennItem[];
  placements: Record<string, TutorVennRegion | null>;
  submitted: boolean;
}

export interface TutorBuilderToken {
  id: string;
  label: string;
  color?: string;
}

export interface TutorTokenBuilderState {
  prompt: string;
  tokens: TutorBuilderToken[];
  slots: number;
  correctTokenIds?: string[];
  userTokenIds: string[];
  submitted: boolean;
}

export interface TutorProcessFlowState {
  prompt: string;
  nodes: TutorTimelineItem[];
  userOrder: string[];
  submitted: boolean;
}

export interface TutorPartWholeBuilderState {
  prompt: string;
  totalParts: number;
  filledParts: number;
  correctFilledParts?: number;
  label?: string;
  submitted: boolean;
}

export interface TutorMapPin {
  id: string;
  label: string;
  x: number;
  y: number;
  isCorrect?: boolean;
}

export interface TutorMapCanvasState {
  prompt: string;
  backgroundImageUrl?: string;
  pins: TutorMapPin[];
  selectedPinIds: string[];
  allowMultiple: boolean;
  submitted: boolean;
}

export interface TutorClaimOption {
  id: string;
  label: string;
  isCorrect?: boolean;
}

export interface TutorEvidenceOption {
  id: string;
  label: string;
  supportsClaimId?: string;
}

export interface TutorClaimEvidenceBuilderState {
  prompt: string;
  claims: TutorClaimOption[];
  evidenceItems: TutorEvidenceOption[];
  selectedClaimId: string | null;
  linkedEvidenceIds: string[];
  submitted: boolean;
}

export interface TutorCompareMatrixRow {
  id: string;
  label: string;
}

export interface TutorCompareMatrixColumn {
  id: string;
  label: string;
}

export interface TutorCompareMatrixState {
  prompt: string;
  rows: TutorCompareMatrixRow[];
  columns: TutorCompareMatrixColumn[];
  selectedCells: string[];
  correctCells?: string[];
  submitted: boolean;
}

export interface TutorFlashcardState {
  prompt: string;
  front: string;
  back: string;
  revealed: boolean;
  submitted: boolean;
}

export interface TutorTrueFalseState {
  prompt: string;
  statement: string;
  correctAnswer?: boolean;
  userAnswer: boolean | null;
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
  imageHotspot?: TutorImageHotspotState | null;
  timeline?: TutorTimelineState | null;
  continuousAxis?: TutorContinuousAxisState | null;
  vennDiagram?: TutorVennDiagramState | null;
  tokenBuilder?: TutorTokenBuilderState | null;
  processFlow?: TutorProcessFlowState | null;
  partWholeBuilder?: TutorPartWholeBuilderState | null;
  mapCanvas?: TutorMapCanvasState | null;
  claimEvidenceBuilder?: TutorClaimEvidenceBuilderState | null;
  compareMatrix?: TutorCompareMatrixState | null;
  flashcard?: TutorFlashcardState | null;
  trueFalse?: TutorTrueFalseState | null;
}

export interface TutorIntakeState {
  status: 'active' | 'complete';
  topic: string | null;
  learnerLevel: string | null;
}

export interface TutorCanvasEvidence {
  mode: string;
  summary?: string;
  dataUrl?: string;
  overlayDataUrl?: string;
  strokeColors?: string[];
  strokeCount?: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface TutorCodeExecutionResult {
  status: 'success' | 'error';
  stdout: string;
  stderr: string;
}

export type TutorCanvasInteraction =
  | {
      mode: 'fill_blank';
      answers: Record<string, string>;
    }
  | {
      mode: 'code_block';
      code: string;
      execution?: TutorCodeExecutionResult | null;
    }
  | {
      mode: 'multiple_choice';
      selectedIds: string[];
    }
  | {
      mode: 'number_line';
      value: number | null;
    }
  | {
      mode: 'table_grid';
      cells: Record<string, string>;
    }
  | {
      mode: 'graph_plot';
      points: Array<{ x: number; y: number }>;
    }
  | {
      mode: 'matching_pairs';
      userPairs: Array<{ leftId: string; rightId: string }>;
    }
  | {
      mode: 'ordering';
      userOrder: string[];
    }
  | {
      mode: 'text_response';
      text: string;
    }
  | {
      mode: 'drawing';
      summary?: string;
      strokeColors?: string[];
      strokeCount?: number;
    }
  | {
      mode: 'image_hotspot';
      selectedHotspotIds: string[];
    }
  | {
      mode: 'timeline';
      userOrder: string[];
    }
  | {
      mode: 'continuous_axis';
      value: number | null;
    }
  | {
      mode: 'venn_diagram';
      placements: Record<string, TutorVennRegion | null>;
    }
  | {
      mode: 'token_builder';
      userTokenIds: string[];
    }
  | {
      mode: 'process_flow';
      userOrder: string[];
    }
  | {
      mode: 'part_whole_builder';
      filledParts: number;
    }
  | {
      mode: 'map_canvas';
      selectedPinIds: string[];
    }
  | {
      mode: 'claim_evidence_builder';
      selectedClaimId: string | null;
      linkedEvidenceIds: string[];
    }
  | {
      mode: 'compare_matrix';
      selectedCells: string[];
    }
  | {
      mode: 'flashcard';
      revealed: boolean;
    }
  | {
      mode: 'true_false';
      answer: boolean | null;
    };

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
      imageId?: string;
      imageIndex?: number;
      canvasWidth?: number;
      canvasHeight?: number;
      brushColor?: string;
      brushSize?: number;
    }
  | {
      type: 'clear_drawing';
    }
  | {
      type: 'set_image_hotspot';
      prompt: string;
      backgroundImageUrl?: string;
      imageId?: string;
      imageIndex?: number;
      hotspots: Array<Partial<TutorHotspot> & { label: string }>;
      allowMultiple?: boolean;
    }
  | {
      type: 'clear_image_hotspot';
    }
  | {
      type: 'set_timeline';
      prompt: string;
      items: Array<Partial<TutorTimelineItem> & { label: string }>;
    }
  | {
      type: 'clear_timeline';
    }
  | {
      type: 'set_continuous_axis';
      prompt: string;
      min: number;
      max: number;
      step?: number;
      correctValue?: number;
      correctRange?: { min: number; max: number };
      leftLabel?: string;
      rightLabel?: string;
    }
  | {
      type: 'clear_continuous_axis';
    }
  | {
      type: 'set_venn_diagram';
      prompt: string;
      leftLabel: string;
      rightLabel: string;
      items: Array<Partial<TutorVennItem> & { label: string; correctRegion?: TutorVennRegion }>;
    }
  | {
      type: 'clear_venn_diagram';
    }
  | {
      type: 'set_token_builder';
      prompt: string;
      tokens: Array<Partial<TutorBuilderToken> & { label: string }>;
      slots?: number;
      correctTokenIds?: string[];
    }
  | {
      type: 'clear_token_builder';
    }
  | {
      type: 'set_process_flow';
      prompt: string;
      nodes: Array<Partial<TutorTimelineItem> & { label: string }>;
    }
  | {
      type: 'clear_process_flow';
    }
  | {
      type: 'set_part_whole_builder';
      prompt: string;
      totalParts: number;
      correctFilledParts?: number;
      label?: string;
    }
  | {
      type: 'clear_part_whole_builder';
    }
  | {
      type: 'set_map_canvas';
      prompt: string;
      backgroundImageUrl?: string;
      imageId?: string;
      imageIndex?: number;
      pins: Array<Partial<TutorMapPin> & { label: string }>;
      allowMultiple?: boolean;
    }
  | {
      type: 'clear_map_canvas';
    }
  | {
      type: 'set_claim_evidence_builder';
      prompt: string;
      claims: Array<Partial<TutorClaimOption> & { label: string }>;
      evidenceItems: Array<Partial<TutorEvidenceOption> & { label: string }>;
    }
  | {
      type: 'clear_claim_evidence_builder';
    }
  | {
      type: 'set_compare_matrix';
      prompt: string;
      rows: Array<Partial<TutorCompareMatrixRow> & { label: string }>;
      columns: Array<Partial<TutorCompareMatrixColumn> & { label: string }>;
      correctCells?: string[];
    }
  | {
      type: 'clear_compare_matrix';
    }
  | {
      type: 'set_flashcard';
      prompt: string;
      front: string;
      back: string;
    }
  | {
      type: 'clear_flashcard';
    }
  | {
      type: 'set_true_false';
      prompt: string;
      statement: string;
      correctAnswer?: boolean;
    }
  | {
      type: 'clear_true_false';
    }
  | {
      type: 'complete_session';
    };

export interface TutorTurn {
  actor: 'user' | 'tutor';
  text: string;
  createdAt: string;
  canvasSummary?: string;
  canvasInteraction?: TutorCanvasInteraction | null;
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
    content: string | OpenRouterContentPart[];
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
