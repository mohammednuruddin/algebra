import type {
  TutorAwaitMode,
  TutorCanvasCommand,
  TutorCanvasMode,
  TutorMediaAsset,
  TutorCanvasState,
  TutorEquationChoice,
  TutorRuntimeSnapshot,
} from '@/lib/types/tutor';

const palette = ['#0f172a', '#2563eb', '#0f766e', '#c2410c', '#7c3aed', '#be123c'];

function nextId(prefix: string, index: number) {
  return `${prefix}_${index + 1}`;
}

function asTrimmedString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeMode(value: unknown): TutorCanvasMode {
  return value === 'equation' ? 'equation' : 'distribution';
}

function normalizeToken(
  value: Partial<{ id: string; label: string; color: string; zoneId: string | null }>,
  index: number
) {
  const hasExplicitLabel = Object.prototype.hasOwnProperty.call(value, 'label');

  return {
    id: asTrimmedString(value.id, nextId('token', index)),
    label: hasExplicitLabel ? (typeof value.label === 'string' ? value.label : '') : `Item ${index + 1}`,
    color: asTrimmedString(value.color, palette[index % palette.length] || '#0f172a'),
    zoneId: typeof value.zoneId === 'string' && value.zoneId.trim() ? value.zoneId.trim() : null,
  };
}

function normalizeZone(
  value: Partial<{ id: string; label: string; hint: string; accent: string; count: number; color: string }>,
  index: number
) {
  return {
    id: asTrimmedString(value.id, nextId('zone', index)),
    label: asTrimmedString(value.label, `Group ${index + 1}`),
    hint: asTrimmedString(value.hint, ''),
    accent: asTrimmedString(value.accent || value.color, palette[(index + 1) % palette.length] || '#2563eb'),
    count: typeof value.count === 'number' && Number.isFinite(value.count) ? Math.max(0, Math.floor(value.count)) : undefined,
    color: asTrimmedString(value.color, ''),
  };
}

function createTokensFromZones(zones: TutorCanvasState['zones']) {
  const tokens: TutorCanvasState['tokens'] = [];

  for (const zone of zones) {
    const count = typeof zone.count === 'number' ? zone.count : 0;
    for (let index = 0; index < count; index += 1) {
      tokens.push(
        normalizeToken(
          {
            id: `${zone.id}_token_${index + 1}`,
            label: '',
            color: zone.color || zone.accent,
            zoneId: zone.id,
          },
          tokens.length
        )
      );
    }
  }

  return tokens;
}

function normalizeChoice(
  value: Partial<TutorEquationChoice>,
  index: number
): TutorEquationChoice {
  return {
    id: asTrimmedString(value.id, nextId('choice', index)),
    label: asTrimmedString(value.label, `Choice ${index + 1}`),
    value: asTrimmedString(value.value, `${index + 1}`),
    isCorrect: value.isCorrect === true,
  };
}

export function createEmptyTutorCanvasState(): TutorCanvasState {
  return {
    mode: 'distribution',
    headline: 'Tutor workspace',
    instruction: 'Listen and arrange the board as the tutor guides you.',
    tokens: [],
    zones: [],
    equation: null,
  };
}

export function applyTutorCommands(
  baseState: TutorCanvasState,
  commands: TutorCanvasCommand[]
): { canvas: TutorCanvasState; sessionComplete: boolean } {
  const nextState: TutorCanvasState = {
    ...baseState,
    tokens: [...baseState.tokens],
    zones: [...baseState.zones],
    equation: baseState.equation
      ? {
          ...baseState.equation,
          choices: [...baseState.equation.choices],
        }
      : null,
  };
  let sessionComplete = false;

  for (const command of commands) {
    switch (command.type) {
      case 'set_mode':
        nextState.mode = normalizeMode(command.mode);
        break;
      case 'set_headline':
        nextState.headline = asTrimmedString(command.headline, nextState.headline);
        break;
      case 'set_instruction':
        nextState.instruction = asTrimmedString(command.instruction, nextState.instruction);
        break;
      case 'set_tokens':
        nextState.tokens = command.tokens.map((token, index) => normalizeToken(token, index));
        break;
      case 'clear_tokens':
        nextState.tokens = [];
        break;
      case 'set_zones':
        nextState.zones = command.zones.map((zone, index) => normalizeZone(zone, index));
        if (nextState.tokens.length === 0) {
          nextState.tokens = createTokensFromZones(nextState.zones);
        }
        break;
      case 'set_equation':
        nextState.equation = {
          prompt: asTrimmedString(command.prompt, 'Choose the best answer.'),
          expression: asTrimmedString(command.expression, ''),
          selectedChoiceId: null,
          choices: command.choices.map((choice, index) => normalizeChoice(choice, index)),
        };
        break;
      case 'clear_equation':
        nextState.equation = null;
        break;
      case 'complete_session':
        sessionComplete = true;
        break;
      default:
        break;
    }
  }

  return { canvas: nextState, sessionComplete };
}

export function summarizeTutorCanvas(canvas: TutorCanvasState) {
  if (canvas.mode === 'equation' && canvas.equation) {
    const selected = canvas.equation.choices.find(
      (choice) => choice.id === canvas.equation?.selectedChoiceId
    );
    return `Equation board: ${canvas.equation.expression}. Selected answer: ${selected?.label || 'none'}.`;
  }

  const zoneSummary = canvas.zones
    .map((zone) => {
      const count = canvas.tokens.filter((token) => token.zoneId === zone.id).length;
      return `${zone.label}: ${count}`;
    })
    .join(', ');
  const unplaced = canvas.tokens.filter((token) => !token.zoneId).length;

  return `Distribution board. ${zoneSummary || 'No zones yet'}. Unplaced: ${unplaced}.`;
}

export function updateTutorCanvasTokenZone(
  canvas: TutorCanvasState,
  tokenId: string,
  zoneId: string | null
) {
  return {
    ...canvas,
    tokens: canvas.tokens.map((token) =>
      token.id === tokenId ? { ...token, zoneId } : token
    ),
  };
}

export function updateTutorEquationChoice(canvas: TutorCanvasState, choiceId: string) {
  if (!canvas.equation) {
    return canvas;
  }

  return {
    ...canvas,
    equation: {
      ...canvas.equation,
      selectedChoiceId: choiceId,
    },
  };
}

export function createTutorSnapshot(input: {
  sessionId: string;
  prompt: string;
  lessonTopic?: string;
  learnerLevel?: string;
  lessonOutline?: string[];
  title: string;
  speech: string;
  helperText?: string | null;
  awaitMode?: TutorAwaitMode;
  mediaAssets?: TutorMediaAsset[];
  activeImageId?: string | null;
  canvas: TutorCanvasState;
  turns?: TutorRuntimeSnapshot['turns'];
  status?: TutorRuntimeSnapshot['status'];
  speechRevision?: number;
}) {
  return {
    sessionId: input.sessionId,
    prompt: input.prompt,
    lessonTopic: input.lessonTopic || input.prompt,
    learnerLevel: input.learnerLevel || 'unknown',
    lessonOutline: input.lessonOutline || [],
    title: input.title,
    status: input.status || 'active',
    speech: input.speech,
    helperText: input.helperText ?? null,
    awaitMode: input.awaitMode || 'voice_or_canvas',
    speechRevision: input.speechRevision ?? 1,
    mediaAssets: input.mediaAssets || [],
    activeImageId: input.activeImageId ?? null,
    canvas: input.canvas,
    turns: input.turns || [],
  } satisfies TutorRuntimeSnapshot;
}

export function applyTutorMediaCommands(args: {
  currentActiveImageId: string | null;
  mediaAssets: TutorMediaAsset[];
  commands: TutorCanvasCommand[];
}) {
  let nextActiveImageId = args.currentActiveImageId;

  for (const command of args.commands) {
    switch (command.type) {
      case 'show_image': {
        if (typeof command.imageId === 'string' && command.imageId.trim()) {
          nextActiveImageId = command.imageId.trim();
          break;
        }

        if (
          typeof command.imageIndex === 'number' &&
          Number.isFinite(command.imageIndex) &&
          args.mediaAssets[command.imageIndex]
        ) {
          nextActiveImageId = args.mediaAssets[command.imageIndex]?.id || null;
        }
        break;
      }
      case 'clear_image':
        nextActiveImageId = null;
        break;
      default:
        break;
    }
  }

  return nextActiveImageId;
}
