import {
  buildOpenRouterRequest,
  type OpenRouterContentPart,
  type OpenRouterMessage,
} from '@/lib/ai/openrouter';
import { formatTutorDebugMessages, formatTutorDebugValue } from '@/lib/tutor/debug-log';
import type {
  TutorAwaitMode,
  TutorCanvasAction,
  TutorCanvasCommand,
  TutorCanvasEvidence,
  TutorMediaAsset,
  TutorLlmDebugTrace,
  TutorSessionStatus,
} from '@/lib/types/tutor';

export interface TutorModelResponse {
  speech: string;
  awaitMode: TutorAwaitMode;
  canvasAction: TutorCanvasAction;
  commands: TutorCanvasCommand[];
  sessionComplete: boolean;
  status: TutorSessionStatus;
}

export interface TutorModelResult {
  response: TutorModelResponse;
  debug: TutorLlmDebugTrace;
}

export interface TutorIntakeResponse {
  speech: string;
  awaitMode: TutorAwaitMode;
  readyToStartLesson: boolean;
  topic: string | null;
  learnerLevel: string | null;
}

export interface TutorIntakeResult {
  response: TutorIntakeResponse;
  debug: TutorLlmDebugTrace;
}

interface TutorLessonPreparation {
  openingSpeech: string;
  outline: string[];
  imageSearchQuery: string;
  desiredImageCount: number;
}

const LIVE_TUTOR_PERSONALITY_GUIDANCE = [
  'You are a warm, encouraging, emotionally aware live tutor, closer to the Zo tutor style than a sterile worksheet bot.',
  'Sound like a kind human coach: calm, compassionate, lightly playful when it fits, and never cold or mechanical.',
  'Meet the learner where they are. If they are confused, frustrated, embarrassed, or stuck, briefly validate that feeling, lower the pressure, and make the next step feel doable.',
  'If the learner gets something right, celebrate it naturally and move forward with momentum.',
  'Use short, vivid, conversational phrasing instead of textbook language. You may be gently fun, but do not become cheesy, try-hard, or distracting.',
  'Vary your encouragement. Do not repeat the same praise formula every turn.',
  'Do not sound bossy. Guide, coach, reassure, and teach.',
].join(' ');

const LIVE_TUTOR_PERSONALITY_SHORT_GUIDANCE =
  'Keep the tutor warm, encouraging, emotionally aware, and lightly playful. Avoid robotic or worksheet-like tone.';

const LIVE_TUTOR_CANVAS_GUIDANCE = [
  'Use canvas only when it directly helps this exact teaching move; do not force the board for a simple verbal check.',
  'When the learner gives a short spoken answer such as a color, number, yes or no, or a single option, judge the exact answer they gave. Do not rewrite blue into red or swap their answer before evaluating it.',
  'If a board or image will already be shown this turn, do not ask whether the learner wants to see it. It is already on screen, so tell them where to look or what to do.',
  'Choose image_hotspot for identifying a precise region on a diagram or image.',
  'Choose timeline for chronology, sequence, or ordered stages.',
  'Choose continuous_axis for values, estimates, intensity, probability, or other continua.',
  'Choose venn_diagram for overlap, distinction, and classification.',
  'Choose token_builder for assembling equations, grammar pieces, logic forms, or structured expressions.',
  'Choose process_flow for chains, cycles, steps, and causal sequences.',
  'Choose part_whole_builder for fractions, percentages, ratios, and shares.',
  'Use set_tokens only when those tokens should remain visible on the board, such as distribution or token_builder. part_whole_builder uses filled segments, not token dragging.',
  'Choose map_canvas for locations, routes, regions, and spatial comparisons.',
  'Choose claim_evidence_builder for picking a claim and supporting evidence.',
  'Choose compare_matrix for comparing examples across multiple traits.',
  'Use flashcard and true_false as lightweight tutor moves, not as a noisy arcade loop.',
  'When the learner submits board work, inspect the exact evidence, name what is correct, name what is misplaced or missing, and decide the next move from that evidence.',
  'Avoid repetitive hype language such as constant "let\'s go" phrasing. Keep the tone warm, human, and encouraging without sounding pushy.',
  'Keep canvas instructions short, concrete, and naturally spoken. Never say generic filler such as "interact with the board to continue."',
].join(' ');

const LIVE_TUTOR_ALLOWED_COMMANDS =
  'Allowed commands: set_mode, set_tokens, clear_tokens, set_zones, set_equation, clear_equation, show_image, clear_image, set_fill_blank, clear_fill_blank, set_code_block, clear_code_block, set_multiple_choice, clear_multiple_choice, set_number_line, clear_number_line, set_table_grid, clear_table_grid, set_graph_plot, clear_graph_plot, set_matching_pairs, clear_matching_pairs, set_ordering, clear_ordering, set_text_response, clear_text_response, set_drawing, clear_drawing, set_image_hotspot, clear_image_hotspot, set_timeline, clear_timeline, set_continuous_axis, clear_continuous_axis, set_venn_diagram, clear_venn_diagram, set_token_builder, clear_token_builder, set_process_flow, clear_process_flow, set_part_whole_builder, clear_part_whole_builder, set_map_canvas, clear_map_canvas, set_claim_evidence_builder, clear_claim_evidence_builder, set_compare_matrix, clear_compare_matrix, set_flashcard, clear_flashcard, set_true_false, clear_true_false, complete_session.';

const LIVE_TUTOR_CANVAS_MODE_DESCRIPTIONS =
  'Canvas modes: fill_blank (prompt, beforeText, afterText, slots with placeholder/correctAnswer), code_block (prompt, language, starterCode, expectedOutput), multiple_choice (prompt, options with label/isCorrect, allowMultiple), number_line (prompt, min, max, step, correctValue, showTicks, labels), table_grid (prompt, headers, rows, cells with row/col/value/editable/correctAnswer), graph_plot (prompt, xMin, xMax, yMin, yMax, xLabel, yLabel, gridLines, presetPoints, expectedPoints), matching_pairs (prompt, leftItems, rightItems, correctPairs with leftIndex/rightIndex), ordering (prompt, items with label/correctPosition), text_response (prompt, placeholder, maxLength), drawing (prompt, backgroundImageUrl or imageId or imageIndex, canvasWidth, canvasHeight, brushColor, brushSize), image_hotspot (prompt, backgroundImageUrl or imageId or imageIndex, hotspots with label/x/y/radius, allowMultiple), timeline (prompt, items with label/correctPosition), continuous_axis (prompt, min, max, step, correctValue or correctRange, leftLabel, rightLabel), venn_diagram (prompt, leftLabel, rightLabel, items with label/correctRegion), token_builder (prompt, tokens with label/color, slots, correctTokenIds), process_flow (prompt, nodes with label/correctPosition), part_whole_builder (prompt, totalParts, correctFilledParts, label), map_canvas (prompt, backgroundImageUrl or imageId or imageIndex, pins with label/x/y, allowMultiple), claim_evidence_builder (prompt, claims with label/isCorrect, evidenceItems with label/supportsClaimId), compare_matrix (prompt, rows with label, columns with label, correctCells), flashcard (prompt, front, back), true_false (prompt, statement, correctAnswer).';

type TutorMessage = OpenRouterMessage;

type Sanitized<T> = {
  response: T;
  issues: string[];
};

function preview(value: string, limit = 1200) {
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function trimmed(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function extractJsonCandidate(text: string) {
  const trimmedText = text.trim();
  const unfenced = trimmedText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (unfenced.startsWith('{') || unfenced.startsWith('[')) {
    return unfenced;
  }

  const firstBrace = unfenced.indexOf('{');
  const lastBrace = unfenced.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return unfenced.slice(firstBrace, lastBrace + 1);
  }

  const firstBracket = unfenced.indexOf('[');
  const lastBracket = unfenced.lastIndexOf(']');
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    return unfenced.slice(firstBracket, lastBracket + 1);
  }

  return unfenced;
}

function parseJson(text: string) {
  return JSON.parse(extractJsonCandidate(text)) as unknown;
}

function formatDebugValue(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function sanitizeAwaitMode(
  value: unknown,
  fallbackMode: TutorAwaitMode
): { awaitMode: TutorAwaitMode; issue: string | null } {
  if (value === 'voice') {
    return {
      awaitMode: 'voice',
      issue: null,
    };
  }

  if (value === 'voice_or_canvas') {
    return {
      awaitMode: 'voice_or_canvas',
      issue: null,
    };
  }

  return {
    awaitMode: fallbackMode,
    issue: `Invalid awaitMode ${formatDebugValue(value)} normalized to ${fallbackMode}`,
  };
}

function inferCanvasAction(commands: TutorCanvasCommand[]): TutorCanvasAction {
  if (commands.length === 0) {
    return 'keep';
  }

  const imageOnlyCommands = commands.every(
    (command) => command.type === 'show_image' || command.type === 'clear_image'
  );

  if (imageOnlyCommands) {
    return 'clear';
  }

  return 'replace';
}

function sanitizeCanvasAction(
  value: unknown,
  fallbackAction: TutorCanvasAction
): { canvasAction: TutorCanvasAction; issue: string | null } {
  if (value === 'keep' || value === 'replace' || value === 'clear') {
    return {
      canvasAction: value,
      issue: null,
    };
  }

  return {
    canvasAction: fallbackAction,
    issue:
      value == null
        ? null
        : `Invalid canvasAction ${formatDebugValue(value)} normalized to ${fallbackAction}`,
  };
}

function sanitizeCommands(value: unknown): TutorCanvasCommand[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const commands: TutorCanvasCommand[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const command = item as Record<string, unknown>;
    const type = trimmed(command.type || command.command);

    switch (type) {
      case 'set_mode': {
        const mode = trimmed(command.mode || command.value);
        if (
          mode !== 'distribution' &&
          mode !== 'equation' &&
          mode !== 'fill_blank' &&
          mode !== 'code_block' &&
          mode !== 'multiple_choice' &&
          mode !== 'number_line' &&
          mode !== 'table_grid' &&
          mode !== 'graph_plot' &&
          mode !== 'matching_pairs' &&
          mode !== 'ordering' &&
          mode !== 'text_response' &&
          mode !== 'drawing' &&
          mode !== 'image_hotspot' &&
          mode !== 'timeline' &&
          mode !== 'continuous_axis' &&
          mode !== 'venn_diagram' &&
          mode !== 'token_builder' &&
          mode !== 'process_flow' &&
          mode !== 'part_whole_builder' &&
          mode !== 'map_canvas' &&
          mode !== 'claim_evidence_builder' &&
          mode !== 'compare_matrix' &&
          mode !== 'flashcard' &&
          mode !== 'true_false'
        ) {
          break;
        }

        commands.push({
          type: 'set_mode',
          mode,
        } as TutorCanvasCommand);
        break;
      }
      case 'set_headline': {
        commands.push({
          type: 'set_headline',
          headline: trimmed(command.headline || command.text, 'Tutor workspace'),
        });
        break;
      }
      case 'set_instruction': {
        commands.push({
          type: 'set_instruction',
          instruction: trimmed(
            command.instruction || command.text,
            'Use the board while you explain your thinking.'
          ),
        });
        break;
      }
      case 'set_tokens': {
        const tokens = Array.isArray(command.tokens)
          ? command.tokens
              .filter((token) => token && typeof token === 'object')
              .map((token) => {
                const value = token as Record<string, unknown>;
                return {
                  id: trimmed(value.id),
                  label: trimmed(value.label, 'Item'),
                  color: trimmed(value.color),
                  zoneId:
                    typeof value.zoneId === 'string' && value.zoneId.trim()
                      ? value.zoneId.trim()
                      : null,
                };
              })
          : [];
        commands.push({ type: 'set_tokens', tokens });
        break;
      }
      case 'clear_tokens': {
        commands.push({ type: 'clear_tokens' });
        break;
      }
      case 'set_zones': {
        const zones = Array.isArray(command.zones)
          ? command.zones
              .filter((zone) => zone && typeof zone === 'object')
              .map((zone) => {
                const value = zone as Record<string, unknown>;
                return {
                  id: trimmed(value.id),
                  label: trimmed(value.label, 'Zone'),
                  hint: trimmed(value.hint),
                  accent: trimmed(value.accent || value.color),
                  color: trimmed(value.color),
                  count:
                    typeof value.count === 'number' && Number.isFinite(value.count)
                      ? Math.max(0, Math.floor(value.count))
                      : undefined,
                };
              })
          : [];
        commands.push({ type: 'set_zones', zones });
        break;
      }
      case 'set_equation': {
        const choices = Array.isArray(command.choices)
          ? command.choices
              .filter((choice) => choice && typeof choice === 'object')
              .map((choice) => {
                const value = choice as Record<string, unknown>;
                return {
                  id: trimmed(value.id),
                  label: trimmed(value.label, 'Choice'),
                  value: trimmed(value.value, trimmed(value.label, '0')),
                  isCorrect: value.isCorrect === true,
                };
              })
          : [];
        commands.push({
          type: 'set_equation',
          prompt: trimmed(command.prompt, 'Choose the best answer.'),
          expression: trimmed(command.expression, ''),
          choices,
        });
        break;
      }
      case 'clear_equation': {
        commands.push({ type: 'clear_equation' });
        break;
      }
      case 'complete_session': {
        commands.push({ type: 'complete_session' });
        break;
      }
      case 'show_image': {
        commands.push({
          type: 'show_image',
          ...(typeof command.imageId === 'string' ? { imageId: command.imageId } : {}),
          ...(typeof command.imageIndex === 'number' ? { imageIndex: command.imageIndex } : {}),
        });
        break;
      }
      case 'clear_image': {
        commands.push({ type: 'clear_image' });
        break;
      }
      case 'set_fill_blank': {
        commands.push({
          type: 'set_fill_blank',
          prompt: trimmed(command.prompt, 'Fill in the blanks.'),
          beforeText: trimmed(command.beforeText, ''),
          afterText: trimmed(command.afterText, ''),
          slots: Array.isArray(command.slots)
            ? command.slots
                .filter((s: unknown) => s && typeof s === 'object')
                .map((s: Record<string, unknown>) => ({
                  placeholder: trimmed(s.placeholder, 'answer'),
                  ...(typeof s.id === 'string' ? { id: s.id } : {}),
                  ...(typeof s.correctAnswer === 'string' ? { correctAnswer: s.correctAnswer } : {}),
                }))
            : [],
        });
        break;
      }
      case 'clear_fill_blank': {
        commands.push({ type: 'clear_fill_blank' });
        break;
      }
      case 'set_code_block': {
        commands.push({
          type: 'set_code_block',
          prompt: trimmed(command.prompt, 'Write your code below.'),
          language: trimmed(command.language, 'python'),
          starterCode: trimmed(command.starterCode, ''),
          ...(typeof command.expectedOutput === 'string' ? { expectedOutput: command.expectedOutput } : {}),
        });
        break;
      }
      case 'clear_code_block': {
        commands.push({ type: 'clear_code_block' });
        break;
      }
      case 'set_multiple_choice': {
        const opts = Array.isArray(command.options)
          ? command.options
              .filter((o: unknown) => o && typeof o === 'object')
              .map((o: Record<string, unknown>) => ({
                label: trimmed(o.label, 'Option'),
                ...(o.isCorrect === true ? { isCorrect: true } : {}),
              }))
          : [];
        commands.push({
          type: 'set_multiple_choice',
          prompt: trimmed(command.prompt, 'Choose the correct answer.'),
          options: opts,
          ...(command.allowMultiple === true ? { allowMultiple: true } : {}),
        });
        break;
      }
      case 'clear_multiple_choice': {
        commands.push({ type: 'clear_multiple_choice' });
        break;
      }
      case 'set_number_line': {
        commands.push({
          type: 'set_number_line',
          prompt: trimmed(command.prompt, 'Place the value on the number line.'),
          min: typeof command.min === 'number' ? command.min : 0,
          max: typeof command.max === 'number' ? command.max : 10,
          ...(typeof command.step === 'number' ? { step: command.step } : {}),
          ...(typeof command.correctValue === 'number' ? { correctValue: command.correctValue } : {}),
          ...(typeof command.showTicks === 'boolean' ? { showTicks: command.showTicks } : {}),
          ...(Array.isArray(command.labels) ? { labels: command.labels } : {}),
        });
        break;
      }
      case 'clear_number_line': {
        commands.push({ type: 'clear_number_line' });
        break;
      }
      case 'set_table_grid': {
        commands.push({
          type: 'set_table_grid',
          prompt: trimmed(command.prompt, 'Complete the table.'),
          headers: Array.isArray(command.headers) ? command.headers.map(String) : [],
          rows: typeof command.rows === 'number' && command.rows > 0 ? command.rows : 2,
          ...(Array.isArray(command.cells) ? { cells: command.cells } : {}),
        });
        break;
      }
      case 'clear_table_grid': {
        commands.push({ type: 'clear_table_grid' });
        break;
      }
      case 'set_graph_plot': {
        commands.push({
          type: 'set_graph_plot',
          prompt: trimmed(command.prompt, 'Plot the points on the graph.'),
          ...(typeof command.xMin === 'number' ? { xMin: command.xMin } : {}),
          ...(typeof command.xMax === 'number' ? { xMax: command.xMax } : {}),
          ...(typeof command.yMin === 'number' ? { yMin: command.yMin } : {}),
          ...(typeof command.yMax === 'number' ? { yMax: command.yMax } : {}),
          ...(typeof command.xLabel === 'string' ? { xLabel: command.xLabel } : {}),
          ...(typeof command.yLabel === 'string' ? { yLabel: command.yLabel } : {}),
          ...(typeof command.gridLines === 'boolean' ? { gridLines: command.gridLines } : {}),
          ...(Array.isArray(command.presetPoints) ? { presetPoints: command.presetPoints } : {}),
          ...(Array.isArray(command.expectedPoints) ? { expectedPoints: command.expectedPoints } : {}),
        });
        break;
      }
      case 'clear_graph_plot': {
        commands.push({ type: 'clear_graph_plot' });
        break;
      }
      case 'set_matching_pairs': {
        commands.push({
          type: 'set_matching_pairs',
          prompt: trimmed(command.prompt, 'Match the items.'),
          leftItems: Array.isArray(command.leftItems)
            ? command.leftItems.filter((i: unknown) => i && typeof i === 'object').map((i: Record<string, unknown>) => ({ label: trimmed(i.label, 'Item') }))
            : [],
          rightItems: Array.isArray(command.rightItems)
            ? command.rightItems.filter((i: unknown) => i && typeof i === 'object').map((i: Record<string, unknown>) => ({ label: trimmed(i.label, 'Item') }))
            : [],
          correctPairs: Array.isArray(command.correctPairs)
            ? command.correctPairs.filter((p: unknown) => p && typeof p === 'object' && typeof (p as Record<string, unknown>).leftIndex === 'number' && typeof (p as Record<string, unknown>).rightIndex === 'number')
            : [],
        });
        break;
      }
      case 'clear_matching_pairs': {
        commands.push({ type: 'clear_matching_pairs' });
        break;
      }
      case 'set_ordering': {
        commands.push({
          type: 'set_ordering',
          prompt: trimmed(command.prompt, 'Arrange in the correct order.'),
          items: Array.isArray(command.items)
            ? command.items
                .filter((i: unknown) => i && typeof i === 'object')
                .map((i: Record<string, unknown>) => ({
                  label: trimmed(i.label, 'Item'),
                  ...(typeof i.correctPosition === 'number' ? { correctPosition: i.correctPosition } : {}),
                }))
            : [],
        });
        break;
      }
      case 'clear_ordering': {
        commands.push({ type: 'clear_ordering' });
        break;
      }
      case 'set_text_response': {
        commands.push({
          type: 'set_text_response',
          prompt: trimmed(command.prompt, 'Type your answer.'),
          ...(typeof command.placeholder === 'string' ? { placeholder: command.placeholder } : {}),
          ...(typeof command.maxLength === 'number' ? { maxLength: command.maxLength } : {}),
        });
        break;
      }
      case 'clear_text_response': {
        commands.push({ type: 'clear_text_response' });
        break;
      }
      case 'set_drawing': {
        commands.push({
          type: 'set_drawing',
          prompt: trimmed(command.prompt, 'Draw your answer.'),
          ...(typeof command.backgroundImageUrl === 'string' ? { backgroundImageUrl: command.backgroundImageUrl } : {}),
          ...(typeof command.imageId === 'string' ? { imageId: command.imageId } : {}),
          ...(typeof command.imageIndex === 'number' ? { imageIndex: command.imageIndex } : {}),
          ...(typeof command.canvasWidth === 'number' ? { canvasWidth: command.canvasWidth } : {}),
          ...(typeof command.canvasHeight === 'number' ? { canvasHeight: command.canvasHeight } : {}),
          ...(typeof command.brushColor === 'string' ? { brushColor: command.brushColor } : {}),
          ...(typeof command.brushSize === 'number' ? { brushSize: command.brushSize } : {}),
        });
        break;
      }
      case 'clear_drawing': {
        commands.push({ type: 'clear_drawing' });
        break;
      }
      case 'set_image_hotspot': {
        commands.push({
          type: 'set_image_hotspot',
          prompt: trimmed(command.prompt, 'Tap the correct region.'),
          ...(typeof command.backgroundImageUrl === 'string'
            ? { backgroundImageUrl: command.backgroundImageUrl }
            : {}),
          ...(typeof command.imageId === 'string' ? { imageId: command.imageId } : {}),
          ...(typeof command.imageIndex === 'number' ? { imageIndex: command.imageIndex } : {}),
          hotspots: Array.isArray(command.hotspots)
            ? command.hotspots
                .filter((hotspot: unknown) => hotspot && typeof hotspot === 'object')
                .map((hotspot: Record<string, unknown>) => ({
                  label: trimmed(hotspot.label, 'Hotspot'),
                  ...(typeof hotspot.id === 'string' ? { id: hotspot.id } : {}),
                  ...(typeof hotspot.x === 'number' ? { x: hotspot.x } : {}),
                  ...(typeof hotspot.y === 'number' ? { y: hotspot.y } : {}),
                  ...(typeof hotspot.radius === 'number' ? { radius: hotspot.radius } : {}),
                  ...(hotspot.isCorrect === true ? { isCorrect: true } : {}),
                }))
            : [],
          ...(command.allowMultiple === true ? { allowMultiple: true } : {}),
        });
        break;
      }
      case 'clear_image_hotspot': {
        commands.push({ type: 'clear_image_hotspot' });
        break;
      }
      case 'set_timeline': {
        commands.push({
          type: 'set_timeline',
          prompt: trimmed(command.prompt, 'Place the events in order.'),
          items: Array.isArray(command.items)
            ? command.items
                .filter((item: unknown) => item && typeof item === 'object')
                .map((item: Record<string, unknown>) => ({
                  label: trimmed(item.label, 'Item'),
                  ...(typeof item.id === 'string' ? { id: item.id } : {}),
                  ...(typeof item.correctPosition === 'number'
                    ? { correctPosition: item.correctPosition }
                    : {}),
                }))
            : [],
        });
        break;
      }
      case 'clear_timeline': {
        commands.push({ type: 'clear_timeline' });
        break;
      }
      case 'set_continuous_axis': {
        commands.push({
          type: 'set_continuous_axis',
          prompt: trimmed(command.prompt, 'Place the value on the axis.'),
          min: typeof command.min === 'number' ? command.min : 0,
          max: typeof command.max === 'number' ? command.max : 10,
          ...(typeof command.step === 'number' ? { step: command.step } : {}),
          ...(typeof command.correctValue === 'number'
            ? { correctValue: command.correctValue }
            : {}),
          ...(command.correctRange &&
          typeof command.correctRange === 'object' &&
          typeof (command.correctRange as { min?: unknown }).min === 'number' &&
          typeof (command.correctRange as { max?: unknown }).max === 'number'
            ? {
                correctRange: {
                  min: (command.correctRange as { min: number }).min,
                  max: (command.correctRange as { max: number }).max,
                },
              }
            : {}),
          ...(typeof command.leftLabel === 'string' ? { leftLabel: command.leftLabel } : {}),
          ...(typeof command.rightLabel === 'string' ? { rightLabel: command.rightLabel } : {}),
        });
        break;
      }
      case 'clear_continuous_axis': {
        commands.push({ type: 'clear_continuous_axis' });
        break;
      }
      case 'set_venn_diagram': {
        commands.push({
          type: 'set_venn_diagram',
          prompt: trimmed(command.prompt, 'Place the items in the correct region.'),
          leftLabel: trimmed(command.leftLabel, 'Left'),
          rightLabel: trimmed(command.rightLabel, 'Right'),
          items: Array.isArray(command.items)
            ? command.items
                .filter((item: unknown) => item && typeof item === 'object')
                .map((item: Record<string, unknown>) => ({
                  label: trimmed(item.label, 'Item'),
                  ...(typeof item.id === 'string' ? { id: item.id } : {}),
                  ...(item.correctRegion === 'left' ||
                  item.correctRegion === 'overlap' ||
                  item.correctRegion === 'right'
                    ? { correctRegion: item.correctRegion }
                    : {}),
                }))
            : [],
        });
        break;
      }
      case 'clear_venn_diagram': {
        commands.push({ type: 'clear_venn_diagram' });
        break;
      }
      case 'set_token_builder': {
        commands.push({
          type: 'set_token_builder',
          prompt: trimmed(command.prompt, 'Build the correct expression.'),
          tokens: Array.isArray(command.tokens)
            ? command.tokens
                .filter((token: unknown) => token && typeof token === 'object')
                .map((token: Record<string, unknown>) => ({
                  label: trimmed(token.label, 'Token'),
                  ...(typeof token.id === 'string' ? { id: token.id } : {}),
                  ...(typeof token.color === 'string' ? { color: token.color } : {}),
                }))
            : [],
          ...(typeof command.slots === 'number' ? { slots: command.slots } : {}),
          ...(Array.isArray(command.correctTokenIds)
            ? { correctTokenIds: command.correctTokenIds.filter((id: unknown): id is string => typeof id === 'string') }
            : {}),
        });
        break;
      }
      case 'clear_token_builder': {
        commands.push({ type: 'clear_token_builder' });
        break;
      }
      case 'set_process_flow': {
        commands.push({
          type: 'set_process_flow',
          prompt: trimmed(command.prompt, 'Arrange the process steps.'),
          nodes: Array.isArray(command.nodes)
            ? command.nodes
                .filter((node: unknown) => node && typeof node === 'object')
                .map((node: Record<string, unknown>) => ({
                  label: trimmed(node.label, 'Node'),
                  ...(typeof node.id === 'string' ? { id: node.id } : {}),
                  ...(typeof node.correctPosition === 'number'
                    ? { correctPosition: node.correctPosition }
                    : {}),
                }))
            : [],
        });
        break;
      }
      case 'clear_process_flow': {
        commands.push({ type: 'clear_process_flow' });
        break;
      }
      case 'set_part_whole_builder': {
        commands.push({
          type: 'set_part_whole_builder',
          prompt: trimmed(command.prompt, 'Show the correct share.'),
          totalParts: typeof command.totalParts === 'number' ? command.totalParts : 4,
          ...(typeof command.correctFilledParts === 'number'
            ? { correctFilledParts: command.correctFilledParts }
            : {}),
          ...(typeof command.label === 'string' ? { label: command.label } : {}),
        });
        break;
      }
      case 'clear_part_whole_builder': {
        commands.push({ type: 'clear_part_whole_builder' });
        break;
      }
      case 'set_map_canvas': {
        commands.push({
          type: 'set_map_canvas',
          prompt: trimmed(command.prompt, 'Pick the correct place on the map.'),
          ...(typeof command.backgroundImageUrl === 'string'
            ? { backgroundImageUrl: command.backgroundImageUrl }
            : {}),
          ...(typeof command.imageId === 'string' ? { imageId: command.imageId } : {}),
          ...(typeof command.imageIndex === 'number' ? { imageIndex: command.imageIndex } : {}),
          pins: Array.isArray(command.pins)
            ? command.pins
                .filter((pin: unknown) => pin && typeof pin === 'object')
                .map((pin: Record<string, unknown>) => ({
                  label: trimmed(pin.label, 'Pin'),
                  ...(typeof pin.id === 'string' ? { id: pin.id } : {}),
                  ...(typeof pin.x === 'number' ? { x: pin.x } : {}),
                  ...(typeof pin.y === 'number' ? { y: pin.y } : {}),
                  ...(pin.isCorrect === true ? { isCorrect: true } : {}),
                }))
            : [],
          ...(command.allowMultiple === true ? { allowMultiple: true } : {}),
        });
        break;
      }
      case 'clear_map_canvas': {
        commands.push({ type: 'clear_map_canvas' });
        break;
      }
      case 'set_claim_evidence_builder': {
        commands.push({
          type: 'set_claim_evidence_builder',
          prompt: trimmed(command.prompt, 'Pick the claim and supporting evidence.'),
          claims: Array.isArray(command.claims)
            ? command.claims
                .filter((claim: unknown) => claim && typeof claim === 'object')
                .map((claim: Record<string, unknown>) => ({
                  label: trimmed(claim.label, 'Claim'),
                  ...(typeof claim.id === 'string' ? { id: claim.id } : {}),
                  ...(claim.isCorrect === true ? { isCorrect: true } : {}),
                }))
            : [],
          evidenceItems: Array.isArray(command.evidenceItems)
            ? command.evidenceItems
                .filter((item: unknown) => item && typeof item === 'object')
                .map((item: Record<string, unknown>) => ({
                  label: trimmed(item.label, 'Evidence'),
                  ...(typeof item.id === 'string' ? { id: item.id } : {}),
                  ...(typeof item.supportsClaimId === 'string'
                    ? { supportsClaimId: item.supportsClaimId }
                    : {}),
                }))
            : [],
        });
        break;
      }
      case 'clear_claim_evidence_builder': {
        commands.push({ type: 'clear_claim_evidence_builder' });
        break;
      }
      case 'set_compare_matrix': {
        commands.push({
          type: 'set_compare_matrix',
          prompt: trimmed(command.prompt, 'Compare the items across the traits.'),
          rows: Array.isArray(command.rows)
            ? command.rows
                .filter((row: unknown) => row && typeof row === 'object')
                .map((row: Record<string, unknown>) => ({
                  label: trimmed(row.label, 'Row'),
                  ...(typeof row.id === 'string' ? { id: row.id } : {}),
                }))
            : [],
          columns: Array.isArray(command.columns)
            ? command.columns
                .filter((column: unknown) => column && typeof column === 'object')
                .map((column: Record<string, unknown>) => ({
                  label: trimmed(column.label, 'Column'),
                  ...(typeof column.id === 'string' ? { id: column.id } : {}),
                }))
            : [],
          ...(Array.isArray(command.correctCells)
            ? {
                correctCells: command.correctCells.filter(
                  (cell: unknown): cell is string => typeof cell === 'string'
                ),
              }
            : {}),
        });
        break;
      }
      case 'clear_compare_matrix': {
        commands.push({ type: 'clear_compare_matrix' });
        break;
      }
      case 'set_flashcard': {
        commands.push({
          type: 'set_flashcard',
          prompt: trimmed(command.prompt, 'Study the card, then flip it.'),
          front: trimmed(command.front, ''),
          back: trimmed(command.back, ''),
        });
        break;
      }
      case 'clear_flashcard': {
        commands.push({ type: 'clear_flashcard' });
        break;
      }
      case 'set_true_false': {
        commands.push({
          type: 'set_true_false',
          prompt: trimmed(command.prompt, 'Decide whether the statement is true or false.'),
          statement: trimmed(command.statement, ''),
          ...(typeof command.correctAnswer === 'boolean'
            ? { correctAnswer: command.correctAnswer }
            : {}),
        });
        break;
      }
      case 'clear_true_false': {
        commands.push({ type: 'clear_true_false' });
        break;
      }
      default:
        break;
    }
  }

  return commands;
}

function sanitizeTutorResponse(value: unknown): Sanitized<TutorModelResponse> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const speech = trimmed(record.speech);

  if (!speech) {
    return null;
  }

  const commands = sanitizeCommands(record.commands);
  const fallbackAwaitMode = commands.length > 0 ? 'voice_or_canvas' : 'voice';
  const awaitMode = sanitizeAwaitMode(record.awaitMode, fallbackAwaitMode);
  const canvasAction = sanitizeCanvasAction(
    record.canvasAction,
    inferCanvasAction(commands)
  );
  const issues = [awaitMode.issue, canvasAction.issue].filter(Boolean) as string[];

  return {
    response: {
      speech,
      awaitMode: awaitMode.awaitMode,
      canvasAction: canvasAction.canvasAction,
      commands,
      sessionComplete: record.sessionComplete === true,
      status: record.sessionComplete === true ? 'completed' : 'active',
    },
    issues,
  };
}

function sanitizeTutorIntakeResponse(
  value: unknown,
  context: { latestUserMessage?: string | null }
): Sanitized<TutorIntakeResponse> | null {
  void context;
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const speech = trimmed(record.speech);

  if (!speech) {
    return null;
  }

  const topic = trimmed(record.topic) || null;
  const learnerLevel = trimmed(record.learnerLevel) || null;
  const awaitMode = sanitizeAwaitMode(record.awaitMode, 'voice');
  const issues = awaitMode.issue ? [awaitMode.issue] : [];
  const readyToStartLesson = record.readyToStartLesson === true && Boolean(topic);

  return {
    response: {
      speech,
      awaitMode: awaitMode.awaitMode,
      readyToStartLesson,
      topic,
      learnerLevel,
    },
    issues,
  };
}

function logTutorDebug(debug: TutorLlmDebugTrace) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(
    `[tutor:${debug.stage}] system prompt + history\n${JSON.stringify(
      formatTutorDebugMessages(debug.messages),
      null,
      2
    )}`
  );
  console.log(
    `[tutor:${debug.stage}] raw response text`,
    formatTutorDebugValue(debug.rawResponseText)
  );
  console.log(
    `[tutor:${debug.stage}] raw model content`,
    formatTutorDebugValue(debug.rawModelContent)
  );
  console.log(
    `[tutor:${debug.stage}] parsed response`,
    formatTutorDebugValue(debug.parsedResponse)
  );
  console.log(`[tutor:${debug.stage}] fallback`, {
    usedFallback: debug.usedFallback,
    fallbackReason: debug.fallbackReason,
  });
}

function buildFallbackDebug(
  stage: TutorLlmDebugTrace['stage'],
  messages: TutorMessage[],
  reason: string,
  parsedResponse: unknown = null
): TutorLlmDebugTrace {
  return {
    stage,
    messages,
    rawResponseText: null,
    rawModelContent: null,
    parsedResponse,
    usedFallback: true,
    fallbackReason: reason,
  };
}

function parseStructured<T>(content: string): T {
  return parseJson(content) as T;
}

async function callModel(
  stage: TutorLlmDebugTrace['stage'],
  messages: TutorMessage[]
): Promise<TutorModelResult | null> {
  const outbound = buildOpenRouterRequest({
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 1200,
  });

  const response = await fetch(outbound.url, {
    method: 'POST',
    headers: outbound.headers,
    body: JSON.stringify(outbound.body),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Tutor model failed (${response.status}): ${preview(text)}`);
  }

  const payload = parseJson(text) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Tutor model returned no content');
  }

  const parsed = parseJson(content);
  const sanitized = sanitizeTutorResponse(parsed);

  if (!sanitized) {
    return null;
  }

  const issues = sanitized.issues;
  const debug: TutorLlmDebugTrace = {
    stage,
    messages,
    rawResponseText: text,
    rawModelContent: content,
    parsedResponse: parsed,
    usedFallback: issues.length > 0,
    fallbackReason: issues.length > 0 ? issues.join('; ') : null,
  };

  logTutorDebug(debug);

  return {
    response: sanitized.response,
    debug,
  };
}

function buildTokenWords(prompt: string) {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => word.length > 3)
    .slice(0, 6);

  if (words.length >= 4) {
    return words;
  }

  return ['idea', 'step', 'pattern', 'result'];
}

function buildEquationFallback(prompt: string): TutorModelResponse {
  const match = prompt.match(/(\d+)\D+(\d+)/);
  const left = match ? Number.parseInt(match[1] || '7', 10) : 7;
  const right = match ? Number.parseInt(match[2] || '5', 10) : 5;
  const correct = String(left + right);
  const wrongA = String(left + right - 1);
  const wrongB = String(left + right + 2);
  const wrongC = String(Math.max(left + right - 3, 1));

  return {
    speech: `Let’s start. How would you solve ${left} plus ${right}? Talk me through it.`,
    awaitMode: 'voice_or_canvas',
    canvasAction: 'replace',
    sessionComplete: false,
    status: 'active',
    commands: [
      { type: 'set_mode', mode: 'equation' },
      {
        type: 'set_equation',
        prompt: 'Choose the result that fits the expression.',
        expression: `${left} + ${right} = ?`,
        choices: [
          { label: correct, value: correct, isCorrect: true },
          { label: wrongA, value: wrongA },
          { label: wrongB, value: wrongB },
          { label: wrongC, value: wrongC },
        ],
      },
    ],
  };
}

export function buildInitialTutorFallback(prompt: string): TutorModelResponse {
  const normalized = prompt.toLowerCase();
  if (/(add|plus|sum|solve|equation|algebra|fraction|multiply|divide|subtract)/i.test(normalized)) {
    return buildEquationFallback(prompt);
  }

  const words = buildTokenWords(prompt);

  return {
    speech: `Let’s begin with ${prompt.trim()}. Move the board pieces and tell me what you already know.`,
    awaitMode: 'voice_or_canvas',
    canvasAction: 'replace',
    sessionComplete: false,
    status: 'active',
    commands: [
      { type: 'set_mode', mode: 'distribution' },
      {
        type: 'set_zones',
        zones: [
          { label: 'What we know', hint: 'Place the stable facts here.' },
          { label: 'What changes', hint: 'Place the moving pieces here.' },
        ],
      },
      {
        type: 'set_tokens',
        tokens: words.map((word) => ({ label: word })),
      },
    ],
  };
}

function buildTutorIntakeFallback(args: {
  topic?: string | null;
  learnerLevel?: string | null;
  latestUserMessage?: string | null;
}): TutorIntakeResponse {
  const topic = trimmed(args.topic) || null;
  const learnerLevel = trimmed(args.learnerLevel) || null;

  if (topic) {
    return {
      speech: `Let’s start with ${topic}. What do you already know about it?`,
      awaitMode: 'voice',
      readyToStartLesson: true,
      topic,
      learnerLevel,
    };
  }

  return {
    speech: 'What would you like to learn today?',
    awaitMode: 'voice',
    readyToStartLesson: false,
    topic: null,
    learnerLevel,
  };
}

export async function generateTutorIntakeTurn(args: {
  stage: TutorLlmDebugTrace['stage'];
  history: Array<{ actor: 'user' | 'tutor'; text: string }>;
  latestUserMessage?: string | null;
  topic?: string | null;
  learnerLevel?: string | null;
}): Promise<TutorIntakeResult> {
  const historyText = args.history.length
    ? args.history.map((turn) => `${turn.actor}: ${turn.text}`).join('\n')
    : 'No conversation yet.';

  const messages: TutorMessage[] = [
    {
      role: 'system',
      content:
        'You are the opening intake for a live AI tutor. Return strict JSON only with keys speech, awaitMode, readyToStartLesson, topic, learnerLevel. awaitMode must be exactly "voice" or "voice_or_canvas" and nothing else. RULES: (1) Be extremely brief — 1 sentence max. (2) As soon as you can identify a topic and level of user, set readyToStartLesson=true IMMEDIATELY. Do not ask follow-up questions about goals, sub-topics, or preferences. Do not ask whether this is for class, motivation, or curiosity. The learner wants to learn, not answer a questionnaire. (3) If the learner asks a content question, set readyToStartLesson=true with the topic extracted from their question. (5) Never ask more than one intake question total. topic = concise normalized topic or null. learnerLevel = short phrase or null. Never mention setup, stages, forms, titles, or labels.',
    },
    {
      role: 'user',
      content: `Known topic: ${args.topic || 'unknown'}\nKnown learner level: ${args.learnerLevel || 'unknown'}\nLatest learner message: ${args.latestUserMessage || 'none'}\nConversation so far:\n${historyText}\n\nReturn the next intake turn. If you have enough context to start teaching, set readyToStartLesson true.`,
    },
  ];
  let rawResponseText: string | null = null;
  let rawModelContent: string | null = null;
  let parsedResponse: unknown = null;

  try {
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
    rawResponseText = text;

    if (!response.ok) {
      throw new Error(`Tutor intake failed (${response.status}): ${preview(text)}`);
    }

    const payload = parseJson(text) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    rawModelContent = content || null;
    if (!content) {
      throw new Error('Tutor intake returned no content');
    }

    const parsed = parseJson(content);
    parsedResponse = parsed;
    const sanitized = sanitizeTutorIntakeResponse(parsed, {
      latestUserMessage: args.latestUserMessage,
    });

    if (!sanitized) {
      throw new Error('Tutor intake returned invalid JSON');
    }

    const issues = sanitized.issues;
    const debug: TutorLlmDebugTrace = {
      stage: args.stage,
      messages,
      rawResponseText,
      rawModelContent,
      parsedResponse,
      usedFallback: issues.length > 0,
      fallbackReason: issues.length > 0 ? issues.join('; ') : null,
    };

    logTutorDebug(debug);

    return {
      response: sanitized.response,
      debug,
    };
  } catch (error) {
    const fallback: TutorIntakeResult = {
      response: buildTutorIntakeFallback({
        topic: args.topic,
        learnerLevel: args.learnerLevel,
        latestUserMessage: args.latestUserMessage,
      }),
      debug: {
        stage: args.stage,
        messages,
        rawResponseText,
        rawModelContent,
        parsedResponse,
        usedFallback: true,
        fallbackReason:
          error instanceof Error ? error.message : 'Unknown tutor intake error',
      },
    };

    logTutorDebug(fallback.debug);

    return fallback;
  }
}

function buildLessonPreparationFallback(input: { topic: string; learnerLevel: string }): TutorLessonPreparation {
  return {
    openingSpeech: `Alright. I am preparing ${input.topic} for someone who is ${input.learnerLevel}.`,
    outline: [
      'Start from what the learner already knows.',
      'Introduce the main idea simply.',
      'Use one concrete example.',
      'Check understanding out loud.',
    ],
    imageSearchQuery: `${input.topic} simple teaching diagram`,
    desiredImageCount: /scratch|new|beginner/i.test(input.learnerLevel) ? 2 : 1,
  };
}

export function buildTurnTutorFallback(args: {
  prompt: string;
  transcript: string;
  canvasSummary: string;
}): TutorModelResponse {
  const transcript = args.transcript.trim();
  const lower = transcript.toLowerCase();

  if (/(done|i get it|i understand|finished|that makes sense)/i.test(lower)) {
    return {
      speech: 'Nice work. You really did get it, so we can wrap this round here.',
      awaitMode: 'voice',
      canvasAction: 'clear',
      sessionComplete: true,
      status: 'completed',
      commands: [{ type: 'complete_session' }],
    };
  }

  return {
    speech: `You’re okay. Let’s take the next small step together. Right now I see: ${args.canvasSummary}`,
    awaitMode: 'voice_or_canvas',
    canvasAction: 'keep',
    sessionComplete: false,
    status: 'active',
    commands: [],
  };
}

export async function generateLessonPreparation(input: {
  topic: string;
  learnerLevel: string;
}): Promise<TutorLessonPreparation> {
  const messages: TutorMessage[] = [
    {
      role: 'system',
      content:
        `You are preparing a conversational lesson. ${LIVE_TUTOR_PERSONALITY_SHORT_GUIDANCE} Return strict JSON only with keys openingSpeech, outline, imageSearchQuery, desiredImageCount. The lesson should be speech-first and fluid, not a task list. desiredImageCount must be an integer from 0 to 5. Ask for images only if they will genuinely help later explanation. Do not generate titles or labels. The openingSpeech should already sound warm, welcoming, and human.`,
    },
    {
      role: 'user',
      content: `Topic: ${input.topic}\nLearner level: ${input.learnerLevel}\n\nPrepare the lesson context for a speech-first tutoring session.`,
    },
  ];

  try {
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

    if (!response.ok) {
      throw new Error(`Lesson preparation failed (${response.status}): ${preview(text)}`);
    }

    const payload = parseStructured<{
      choices?: Array<{ message?: { content?: string } }>;
    }>(text);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Lesson preparation returned no content');
    }

    const parsed = parseStructured<Record<string, unknown>>(content);
    return {
      openingSpeech: trimmed(parsed.openingSpeech, `I am preparing ${input.topic} now.`),
      outline: Array.isArray(parsed.outline)
        ? parsed.outline
            .filter((item) => typeof item === 'string' && item.trim())
            .map((item) => String(item).trim())
            .slice(0, 6)
        : buildLessonPreparationFallback(input).outline,
      imageSearchQuery: trimmed(parsed.imageSearchQuery, `${input.topic} teaching diagram`),
      desiredImageCount:
        typeof parsed.desiredImageCount === 'number' && Number.isFinite(parsed.desiredImageCount)
          ? Math.max(0, Math.min(4, Math.floor(parsed.desiredImageCount)))
          : buildLessonPreparationFallback(input).desiredImageCount,
    };
  } catch {
    return buildLessonPreparationFallback(input);
  }
}

export async function generateInitialTutorResponse(input: {
  topic: string;
  learnerLevel: string;
  outline: string[];
  imageAssets: TutorMediaAsset[];
  openingSpeech: string;
}): Promise<TutorModelResult> {
  const imageContext = input.imageAssets.length
    ? input.imageAssets
        .map((asset, index) => `${index}: ${asset.id} | ${asset.altText} | ${asset.description}`)
        .join('\n')
    : 'No prepared images.';
  const messages: TutorMessage[] = [
    {
      role: 'system',
      content:
        `You are a live speech-first tutor. ${LIVE_TUTOR_PERSONALITY_GUIDANCE} Return strict JSON with keys speech, awaitMode, sessionComplete, canvasAction, commands. awaitMode: voice or voice_or_canvas. canvasAction must be exactly keep, replace, or clear. TEACHING RULES: (1) Actually TEACH — explain a concept, give a fact, describe what is happening, or build on what the learner said. Do not just ask questions back-to-back. (2) Keep speech to 2-3 sentences: one sentence teaching, one engaging the learner. (3) Never leave dead air — give the learner something to say, look at, or do, but commands can be empty when speech alone is enough. (4) Show images when available and genuinely helpful. (5) The speech must always match the commands. Do not say one thing and spawn a different task. (6) It is not compulsory to always show something; you may just be talking or asking. (7) If you ask the learner to look at an image or diagram, do not spawn an unrelated quiz or task in the same turn. Either just show the image, or make any canvas task directly about that same image. (8) If you ask the learner to point, mark, circle, trace, or identify a part on an image, use set_drawing and attach that same image via imageId, imageIndex, or backgroundImageUrl so the learner can mark it. Explicitly tell the learner which drawing color to use, and keep that aligned with brushColor. (9) canvasAction rules: keep = preserve the current canvas/task, replace = swap in a new task and discard the old one, clear = remove the current canvas task. (10) For code_block tasks, starterCode must contain only real code the learner should keep or edit. Never put instructional placeholder comments or prose inside starterCode such as "# Type your math here and press Enter". If no starter code is needed, use an empty string and keep the instruction in prompt instead. Every command uses key "type". ${LIVE_TUTOR_CANVAS_GUIDANCE} ${LIVE_TUTOR_ALLOWED_COMMANDS} ${LIVE_TUTOR_CANVAS_MODE_DESCRIPTIONS} Use the most appropriate canvas mode for each teaching moment.`,
    },
    {
      role: 'user',
      content: `Topic: ${input.topic}\nLearner level: ${input.learnerLevel}\nPreparation outline:\n- ${input.outline.join('\n- ')}\nPrepared images:\n${imageContext}\nOpening prep speech: ${input.openingSpeech}\n\nPrepare the opening live tutor turn. If an image would help immediately, use show_image. If a canvas scene helps, set it up. It is valid to return no canvas commands at all. If you tell the learner to inspect an image or diagram, do not also spawn a separate unrelated quiz in that same turn.`,
    },
  ];

  try {
    const result = await callModel('session_create', messages);
    if (result) {
      return result;
    }
  } catch (error) {
    const fallback: TutorModelResult = {
      response: buildInitialTutorFallback(input.topic),
      debug: buildFallbackDebug(
        'session_create',
        messages,
        error instanceof Error ? error.message : 'Unknown tutor create error'
      ),
    };
    logTutorDebug(fallback.debug);
    return fallback;
  }

  const fallback: TutorModelResult = {
    response: buildInitialTutorFallback(input.topic),
    debug: buildFallbackDebug('session_create', messages, 'Model response could not be sanitized'),
  };
  logTutorDebug(fallback.debug);
  return fallback;
}

export async function generateTutorTurn(args: {
  topic: string;
  learnerLevel: string;
  outline: string[];
  imageAssets: TutorMediaAsset[];
  activeImageId: string | null;
  transcript: string;
  canvasSummary: string;
  canvasStateContext?: string;
  latestLearnerTurnContext?: string;
  recentTurnFrames?: string;
  recentTurns: string;
  canvasTaskPrompt?: string | null;
  canvasReferenceImageUrl?: string | null;
  canvasBrushColor?: string | null;
  canvasEvidence?: TutorCanvasEvidence | null;
}): Promise<TutorModelResult> {
  const imageContext = args.imageAssets.length
    ? args.imageAssets
        .map((asset, index) => `${index}: ${asset.id} | ${asset.altText} | ${asset.description}`)
        .join('\n')
    : 'No prepared images.';
  const activeImageContext =
    args.imageAssets.find((asset) => asset.id === args.activeImageId)?.altText || 'none';
  const messages: TutorMessage[] = [
    {
      role: 'system',
      content:
        `You are Tibia, a funny and supportive live tutor in a speech-and-canvas. ${LIVE_TUTOR_PERSONALITY_GUIDANCE}. In EVERY TURN, YOU MUST ALWAYS SAY YOUR SPEECH IN MAX 4 SENTENCES WITHOUT LEAVING A DEAD AIR. Return strict JSON with keys speech, awaitMode, sessionComplete, canvasAction, commands. awaitMode: voice or voice_or_canvas. canvasAction must be exactly keep, replace, or clear. Persona: You must be funny and nice to talk to. But must be brief in your speech. If user says something unrelated, just create something fun from that and redirect them to the lesson. Use stop words a lot for natural sounding. like 'um', 'huh', 'you know' etc.\n\n TEACHING RULES: (1) TEACH first — explain a concept, state a fact, describe what the learner is seeing, or connect to what they just said. Do not just ask questions without teaching. (2) Keep speech to 2-3 concise sentences: teach something, then prompt the learner to respond or interact. (3) Never leave dead air — give the learner something to say, look at, or do, but commands can be empty when speech alone is enough. (4) If an image is available and relevant, show it. (5) The speech must always match the commands. Do not say one thing and spawn a different thing. And if you spawn something, then direct then user towards it in your speech. (6) Read the structured current canvas state and structured turn history carefully; prefer them over any lossy prose summary. The recent turn history is chronological oldest first, newest last. (7) If you ask the learner to look at an image or diagram, do not spawn an unrelated quiz or task in the same turn. Either just show the image, or make any canvas task directly about that same image. (8) If you ask the learner to point, mark, circle, trace, or identify a part on an image, use set_drawing and attach that same image via imageId, imageIndex, or backgroundImageUrl so the learner can mark it. When you do this, explicitly tell the learner which drawing color to use, and keep that aligned with brushColor. (9) When the learner answers, give immediate feedback: say whether they are right, explain why, then move forward. Always be brief in your speech so that you dont bore the student. If their answer is correct or substantially correct, acknowledge it and progress to the next concept. Do NOT ask another question about the same concept after a correct answer. When the learner gives an answer, judge the exact answer they gave. Do not rewrite or swap their answer before evaluating it Take it as it is and correct them nicely if wrong or move it nicely if right. (10) NEVER include the answer in your question prompt. Do not say "(Answer: ...)" or give away the solution. Let the learner think and respond. (11) Progress through the lesson outline — do not get stuck repeating the same question or asking variations of the same question. Move to new material after the learner demonstrates understanding. (12) If learner markup evidence is attached, treat it as the learner answer attempt for the current drawing task. If both the original reference image and the learner-marked image are attached, the learner marks appear only in the second image. Evaluate those marks first, acknowledge what the learner circled/pointed to, and do not talk about their markings as if they were pre-existing labels in the original diagram. canvasAction rules: keep = preserve the current canvas/task, replace = swap in a new task and discard the old one, clear = remove the current canvas task. ENDING RULES: (13) If the learner clearly wants to stop, end, be done, finish, wrap up, or call it a day, immediately set sessionComplete=true, use awaitMode="voice", and include a complete_session command. Do not keep teaching or assign another task after an explicit stop request. (14) If the learner seems to understand the current concept well enough, you may ask a brief choice such as "one more example or call it a day?" In that choice turn, keep sessionComplete=false until the learner answers. (15) If the learner answers that choice with wanting to continue, keep teaching with sessionComplete=false. If the learner answers with wanting to end, set sessionComplete=true. (16) sessionComplete should stay false unless you are either ending now or confident the learner just asked to end now. (17) For code_block tasks, starterCode must contain only real code the learner should keep or edit. Never put instructional placeholder comments or prose inside starterCode such as "# Type your math here and press Enter". If no starter code is needed, use an empty string and keep the instruction in prompt instead. Every command uses key "type". (18) If you show or replace a board or image in this turn, do not ask whether the learner wants to see it. It is already on screen, so tell them exactly where to look or what to do next. Do not say you can pop something up if your commands already popped it up. And never use this symbol \`\ if you want quote something use this '. so intead of \`name\` write 'name'.. (19) when saying goodbye, remind the user than youre creating an article for what theyve studied so they can check the sidebar and read. ${LIVE_TUTOR_CANVAS_GUIDANCE} ${LIVE_TUTOR_ALLOWED_COMMANDS} ${LIVE_TUTOR_CANVAS_MODE_DESCRIPTIONS} Use the best canvas modes for each teaching moment. Be creative`
    },
  ];

  const canvasEvidenceContext = args.canvasEvidence?.dataUrl
    ? [
        'A learner markup submission is attached.',
        args.canvasTaskPrompt ? `Current drawing task: ${args.canvasTaskPrompt}` : null,
        args.canvasBrushColor
          ? `Expected learner markup color for this task: ${args.canvasBrushColor}.`
          : null,
        args.canvasEvidence?.strokeColors?.length
          ? `Detected markup colors in learner answer: ${args.canvasEvidence.strokeColors.join(', ')}.`
          : null,
        typeof args.canvasEvidence?.strokeCount === 'number'
          ? `Detected learner stroke count: ${args.canvasEvidence.strokeCount}.`
          : null,
        args.canvasReferenceImageUrl
          ? 'Attached image order: first the original reference image, then the learner\'s marked-up composite answer image.'
          : 'The attached image is the learner\'s marked-up composite answer image.',
        args.canvasEvidence?.overlayDataUrl
          ? 'A final attached image is a markup-only overlay showing just the learner-added strokes without the original diagram.'
          : null,
        'Treat circles, arrows, highlights, traces, and scribbles in the learner answer image as the learner\'s work.',
        'First judge whether the learner marked the right place. Explicitly acknowledge the learner markup before moving on.',
      ]
        .filter(Boolean)
        .join('\n')
    : null;

  const userPrompt = `Topic: ${args.topic}\nLearner level: ${args.learnerLevel}\nLesson outline:\n- ${args.outline.join('\n- ')}\nAvailable images:\n${imageContext}\nCurrently shown image: ${activeImageContext}\nLatest learner transcript: ${args.transcript}\nLatest learner turn (structured JSON):\n${args.latestLearnerTurnContext || 'none'}\nCurrent canvas state (structured JSON):\n${args.canvasStateContext || 'none'}\nCurrent canvas summary: ${args.canvasSummary}\nCanvas evidence summary: ${args.canvasEvidence?.summary || 'none'}\nRecent turn history (structured JSON, chronological oldest first, newest last):\n${args.recentTurnFrames || '[]'}\nRecent dialogue (legacy prose summary): ${args.recentTurns}${canvasEvidenceContext ? `\n\n${canvasEvidenceContext}` : ''}\n\nReturn the next live tutor turn. Only change the board or image when that helps the explanation.`;

  const userContent: string | OpenRouterContentPart[] =
    args.canvasEvidence?.dataUrl
      ? [
          {
            type: 'text',
            text: userPrompt,
          },
          ...(args.canvasReferenceImageUrl
            ? [
                {
                  type: 'image_url' as const,
                  image_url: {
                    url: args.canvasReferenceImageUrl,
                    detail: 'high' as const,
                  },
                },
              ]
            : []),
          {
            type: 'image_url',
            image_url: {
              url: args.canvasEvidence.dataUrl,
              detail: 'high',
            },
          },
          ...(args.canvasEvidence.overlayDataUrl
            ? [
                {
                  type: 'image_url' as const,
                  image_url: {
                    url: args.canvasEvidence.overlayDataUrl,
                    detail: 'high' as const,
                  },
                },
              ]
            : []),
        ]
      : userPrompt;

  messages.push({
    role: 'user',
    content: userContent,
  });

  try {
    const result = await callModel('turn', messages);
    if (result) {
      return result;
    }
  } catch (error) {
    const fallback: TutorModelResult = {
      response: buildTurnTutorFallback({
        prompt: args.topic,
        transcript: args.transcript,
        canvasSummary: args.canvasSummary,
      }),
      debug: buildFallbackDebug(
        'turn',
        messages,
        error instanceof Error ? error.message : 'Unknown tutor turn error'
      ),
    };
    logTutorDebug(fallback.debug);
    return fallback;
  }

  const fallback: TutorModelResult = {
    response: buildTurnTutorFallback({
      prompt: args.topic,
      transcript: args.transcript,
      canvasSummary: args.canvasSummary,
    }),
    debug: buildFallbackDebug('turn', messages, 'Model response could not be sanitized'),
  };
  logTutorDebug(fallback.debug);
  return fallback;
}
