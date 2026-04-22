import { buildOpenRouterRequest } from '@/lib/ai/openrouter';
import { shouldAutoStartTutorLesson } from '@/lib/tutor/intake-heuristics';
import type {
  TutorAwaitMode,
  TutorCanvasCommand,
  TutorMediaAsset,
  TutorLlmDebugTrace,
  TutorSessionStatus,
} from '@/lib/types/tutor';

export interface TutorModelResponse {
  speech: string;
  awaitMode: TutorAwaitMode;
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

type TutorMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

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
        commands.push({
          type: 'set_mode',
          mode: trimmed(command.mode, 'distribution'),
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

  return {
    response: {
      speech,
      awaitMode: awaitMode.awaitMode,
      commands,
      sessionComplete: record.sessionComplete === true,
      status: record.sessionComplete === true ? 'completed' : 'active',
    },
    issues: awaitMode.issue ? [awaitMode.issue] : [],
  };
}

function sanitizeTutorIntakeResponse(
  value: unknown,
  context: { latestUserMessage?: string | null }
): Sanitized<TutorIntakeResponse> | null {
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
  let readyToStartLesson = record.readyToStartLesson === true && Boolean(topic);

  if (
    !readyToStartLesson &&
    shouldAutoStartTutorLesson({
      topic,
      learnerLevel,
      latestUserMessage: context.latestUserMessage,
    })
  ) {
    readyToStartLesson = true;
    issues.push('Promoted readyToStartLesson from tutor intake heuristics');
  }

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

  console.log(`[tutor:${debug.stage}] system prompt + history`, debug.messages);
  console.log(`[tutor:${debug.stage}] raw response text`, debug.rawResponseText);
  console.log(`[tutor:${debug.stage}] raw model content`, debug.rawModelContent);
  console.log(`[tutor:${debug.stage}] parsed response`, debug.parsedResponse);
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
    sessionComplete: false,
    status: 'active',
    commands: [
      { type: 'set_mode', mode: 'equation' },
      { type: 'set_headline', headline: 'Equation board' },
      { type: 'set_instruction', instruction: 'Pick a result, then explain why it works.' },
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
    sessionComplete: false,
    status: 'active',
    commands: [
      { type: 'set_mode', mode: 'distribution' },
      { type: 'set_headline', headline: 'Thinking board' },
      { type: 'set_instruction', instruction: 'Sort ideas before you explain your next move.' },
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

  if (
    topic &&
    shouldAutoStartTutorLesson({
      topic,
      learnerLevel,
      latestUserMessage: args.latestUserMessage,
    })
  ) {
    return {
      speech: `Let’s start with ${topic}. What do you already know about it?`,
      awaitMode: 'voice',
      readyToStartLesson: true,
      topic,
      learnerLevel,
    };
  }

  if (topic) {
    return {
      speech: `We can work on ${topic}. What part would you like to understand first?`,
      awaitMode: 'voice',
      readyToStartLesson: false,
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
        'You are the opening intake for a live AI tutor. Return strict JSON only with keys speech, awaitMode, readyToStartLesson, topic, learnerLevel. awaitMode must be exactly "voice" or "voice_or_canvas" and nothing else. RULES: (1) Be extremely brief — one short sentence max. (2) As soon as you can identify a topic, set readyToStartLesson=true IMMEDIATELY. Do not ask follow-up questions about goals, sub-topics, or preferences. The learner wants to learn, not answer a questionnaire. (3) If the learner gives a topic (even without a level), set readyToStartLesson=true and infer learnerLevel as "beginner" if not stated. (4) If the learner asks a content question, set readyToStartLesson=true with the topic extracted from their question. (5) Only ask "What do you want to learn?" if you truly have zero topic information. (6) Never ask more than one intake question total. topic = concise normalized topic or null. learnerLevel = short phrase or null. Never mention setup, stages, forms, titles, or labels.',
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
      temperature: 0.3,
      max_tokens: 700,
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
      speech: 'Nice work. You have enough to move on, so I’m wrapping this round here.',
      awaitMode: 'voice',
      sessionComplete: true,
      status: 'completed',
      commands: [{ type: 'complete_session' }],
    };
  }

  return {
    speech: `Good. Keep going. Right now I see: ${args.canvasSummary}`,
    awaitMode: 'voice_or_canvas',
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
        'You are preparing a conversational lesson. Return strict JSON only with keys openingSpeech, outline, imageSearchQuery, desiredImageCount. The lesson should be speech-first and fluid, not a task list. desiredImageCount must be an integer from 0 to 4. Ask for images only if they will genuinely help later explanation. Do not generate titles or labels.',
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
      temperature: 0.2,
      max_tokens: 700,
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
        'You are a live speech-first tutor. Return strict JSON with keys speech, awaitMode, sessionComplete, commands. awaitMode: voice or voice_or_canvas. TEACHING RULES: (1) Actually TEACH — explain a concept, give a fact, describe what is happening, or build on what the learner said. Do not just ask questions back-to-back. (2) Keep speech to 2-3 sentences: one sentence teaching, one engaging the learner. (3) Never leave dead air — always pair speech with a visual (show_image) or interactive activity (canvas command) so the learner has something to see and do. (4) Show images early and often when available — they make the lesson come alive. (5) Use canvas modes to make learning hands-on, not passive. This is turn-by-turn dialogue, not a lecture — but each turn must TEACH something new. Every command uses key "type". Allowed commands: set_mode, set_headline, set_instruction, set_tokens, clear_tokens, set_zones, set_equation, clear_equation, show_image, clear_image, set_fill_blank, clear_fill_blank, set_code_block, clear_code_block, set_multiple_choice, clear_multiple_choice, set_number_line, clear_number_line, set_table_grid, clear_table_grid, set_graph_plot, clear_graph_plot, set_matching_pairs, clear_matching_pairs, set_ordering, clear_ordering, set_text_response, clear_text_response, set_drawing, clear_drawing, complete_session. Canvas modes: fill_blank (prompt, beforeText, afterText, slots with placeholder/correctAnswer), code_block (prompt, language, starterCode, expectedOutput), multiple_choice (prompt, options with label/isCorrect, allowMultiple), number_line (prompt, min, max, step, correctValue, showTicks, labels), table_grid (prompt, headers, rows, cells with row/col/value/editable/correctAnswer), graph_plot (prompt, xMin, xMax, yMin, yMax, xLabel, yLabel, gridLines, presetPoints, expectedPoints), matching_pairs (prompt, leftItems, rightItems, correctPairs with leftIndex/rightIndex), ordering (prompt, items with label/correctPosition), text_response (prompt, placeholder, maxLength), drawing (prompt, backgroundImageUrl, canvasWidth, canvasHeight, brushColor, brushSize). Use the most appropriate canvas mode for each teaching moment.',
    },
    {
      role: 'user',
      content: `Topic: ${input.topic}\nLearner level: ${input.learnerLevel}\nPreparation outline:\n- ${input.outline.join('\n- ')}\nPrepared images:\n${imageContext}\nOpening prep speech: ${input.openingSpeech}\n\nPrepare the opening live tutor turn. If an image would help immediately, use show_image. If a canvas scene helps, set it up.`,
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
  recentTurns: string;
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
        'You are a live tutor in a speech-and-canvas product. Return strict JSON with keys speech, awaitMode, sessionComplete, commands. awaitMode: voice or voice_or_canvas. TEACHING RULES: (1) TEACH first — explain a concept, state a fact, describe what the learner is seeing, or connect to what they just said. Do not just ask questions without teaching. (2) Keep speech to 2-3 concise sentences: teach something, then prompt the learner to respond or interact. (3) Never leave dead air — always give the learner something to look at (show_image) or do (canvas interaction). If an image is available and relevant, show it. (4) Use canvas modes actively — set up activities the learner can interact with (multiple_choice, fill_blank, matching_pairs, etc.) so learning is hands-on. (5) When the learner answers, give immediate feedback: say whether they are right, explain why, then move forward. (6) Progress through the lesson outline — do not get stuck repeating the same question. Every command uses key "type". Allowed commands: set_mode, set_headline, set_instruction, set_tokens, clear_tokens, set_zones, set_equation, clear_equation, show_image, clear_image, set_fill_blank, clear_fill_blank, set_code_block, clear_code_block, set_multiple_choice, clear_multiple_choice, set_number_line, clear_number_line, set_table_grid, clear_table_grid, set_graph_plot, clear_graph_plot, set_matching_pairs, clear_matching_pairs, set_ordering, clear_ordering, set_text_response, clear_text_response, set_drawing, clear_drawing, complete_session. Canvas modes: fill_blank (prompt, beforeText, afterText, slots with placeholder/correctAnswer), code_block (prompt, language, starterCode, expectedOutput), multiple_choice (prompt, options with label/isCorrect, allowMultiple), number_line (prompt, min, max, step, correctValue, showTicks, labels), table_grid (prompt, headers, rows, cells with row/col/value/editable/correctAnswer), graph_plot (prompt, xMin, xMax, yMin, yMax, xLabel, yLabel, gridLines, presetPoints, expectedPoints), matching_pairs (prompt, leftItems, rightItems, correctPairs with leftIndex/rightIndex), ordering (prompt, items with label/correctPosition), text_response (prompt, placeholder, maxLength), drawing (prompt, backgroundImageUrl, canvasWidth, canvasHeight, brushColor, brushSize). Use the best canvas mode for each teaching moment.'
    },
    {
      role: 'user',
      content: `Topic: ${args.topic}\nLearner level: ${args.learnerLevel}\nLesson outline:\n- ${args.outline.join('\n- ')}\nAvailable images:\n${imageContext}\nCurrently shown image: ${activeImageContext}\nLatest learner transcript: ${args.transcript}\nCurrent canvas summary: ${args.canvasSummary}\nRecent dialogue: ${args.recentTurns}\n\nReturn the next live tutor turn. Only change the board or image when that helps the explanation.`,
    },
  ];

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
