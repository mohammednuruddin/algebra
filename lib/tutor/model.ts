import { buildOpenRouterRequest } from '@/lib/ai/openrouter';
import type {
  TutorAwaitMode,
  TutorCanvasCommand,
  TutorMediaAsset,
  TutorLlmDebugTrace,
  TutorSessionStatus,
} from '@/lib/types/tutor';

export interface TutorModelResponse {
  title: string;
  speech: string;
  helperText: string | null;
  awaitMode: TutorAwaitMode;
  commands: TutorCanvasCommand[];
  sessionComplete: boolean;
  status: TutorSessionStatus;
}

export interface TutorModelResult {
  response: TutorModelResponse;
  debug: TutorLlmDebugTrace;
}

interface TutorLessonPreparation {
  title: string;
  openingSpeech: string;
  outline: string[];
  imageSearchQuery: string;
  desiredImageCount: number;
}

type TutorMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function preview(value: string, limit = 1200) {
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function trimmed(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function parseJson(text: string) {
  return JSON.parse(text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()) as unknown;
}

function sanitizeAwaitMode(value: unknown): TutorAwaitMode {
  if (value === 'voice') {
    return 'voice';
  }

  return 'voice_or_canvas';
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
          mode: command.mode === 'equation' ? 'equation' : 'distribution',
        });
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
      default:
        break;
    }
  }

  return commands;
}

function sanitizeTutorResponse(value: unknown): TutorModelResponse | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const speech = trimmed(record.speech);

  if (!speech) {
    return null;
  }

  return {
    title: trimmed(record.title, 'Live tutor'),
    speech,
    helperText: trimmed(record.helperText) || null,
    awaitMode: sanitizeAwaitMode(record.awaitMode),
    commands: sanitizeCommands(record.commands),
    sessionComplete: record.sessionComplete === true,
    status: record.sessionComplete === true ? 'completed' : 'active',
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

  const debug: TutorLlmDebugTrace = {
    stage,
    messages,
    rawResponseText: text,
    rawModelContent: content,
    parsedResponse: parsed,
    usedFallback: false,
    fallbackReason: null,
  };

  logTutorDebug(debug);

  return {
    response: sanitized,
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
    title: 'Live tutor',
    speech: `We are starting live. Look at the board and talk me through how you would solve ${left} plus ${right}.`,
    helperText: 'Use the canvas and explain your thinking out loud.',
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
    title: 'Live tutor',
    speech: `I prepared a live workspace for ${prompt.trim()}. Start arranging the board while you tell me what you already know.`,
    helperText: 'Move the cards, then speak naturally.',
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

function buildLessonPreparationFallback(input: { topic: string; learnerLevel: string }): TutorLessonPreparation {
  return {
    title: input.topic,
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
      title: 'Live tutor',
      speech: 'Nice work. You have enough to move on, so I am wrapping this round here.',
      helperText: 'Session complete.',
      awaitMode: 'voice',
      sessionComplete: true,
      status: 'completed',
      commands: [{ type: 'complete_session' }],
    };
  }

  return {
    title: 'Live tutor',
    speech: `Good. Keep using the board and tighten the explanation. Right now I see: ${args.canvasSummary}`,
    helperText: 'Say the next step clearly while you work the board.',
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
        'You are preparing a conversational lesson. Return strict JSON only with keys title, openingSpeech, outline, imageSearchQuery, desiredImageCount. The lesson should be speech-first and fluid, not a task list. desiredImageCount must be an integer from 0 to 4. Ask for images only if they will genuinely help later explanation.',
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
      title: trimmed(parsed.title, input.topic),
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
        'You are preparing the opening turn for a speech-first live tutor. Return strict JSON only with keys title, speech, helperText, awaitMode, sessionComplete, commands. Use awaitMode values voice or voice_or_canvas only. Every command object must use a key named type, never command. Allowed commands are set_mode, set_headline, set_instruction, set_tokens, clear_tokens, set_zones, set_equation, clear_equation, show_image, clear_image, complete_session. For set_headline use a headline field. For set_instruction use an instruction field. For set_zones use zones with id, label, optional hint, optional color, and optional count. If you want visible movable objects, either emit explicit set_tokens tokens or provide zone count values so tokens can be generated. Keep the lesson conversational, not task-list driven. Only use image or canvas commands when they genuinely help understanding.',
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
        'You are the live tutor inside a minimal speech-and-canvas product. Return strict JSON only with keys title, speech, helperText, awaitMode, sessionComplete, commands. Use awaitMode values voice or voice_or_canvas only. Every command object must use a key named type, never command. Allowed commands are set_mode, set_headline, set_instruction, set_tokens, clear_tokens, set_zones, set_equation, clear_equation, show_image, clear_image, complete_session. For set_headline use a headline field. For set_instruction use an instruction field. For set_zones use zones with id, label, optional hint, optional color, and optional count. If you want visible movable objects, either emit explicit set_tokens tokens or provide zone count values so tokens can be generated. Keep this lesson conversational, explanatory, and continuous. Use image or canvas commands only when they help the explanation.',
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
