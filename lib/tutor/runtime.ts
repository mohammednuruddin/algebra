import type {
  TutorAwaitMode,
  TutorCanvasAction,
  TutorCanvasCommand,
  TutorCanvasMode,
  TutorMediaAsset,
  TutorCanvasState,
  TutorEquationChoice,
  TutorFillBlankSlot,
  TutorRuntimeSnapshot,
} from '@/lib/types/tutor';

const palette = ['#0f172a', '#2563eb', '#0f766e', '#c2410c', '#7c3aed', '#be123c'];

function nextId(prefix: string, index: number) {
  return `${prefix}_${index + 1}`;
}

function asTrimmedString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

const VALID_MODES: Set<string> = new Set([
  'distribution', 'equation', 'fill_blank', 'code_block',
  'multiple_choice', 'number_line', 'table_grid', 'graph_plot',
  'matching_pairs', 'ordering', 'text_response', 'drawing',
  'image_hotspot', 'timeline', 'continuous_axis', 'venn_diagram',
  'token_builder', 'process_flow', 'part_whole_builder', 'map_canvas',
  'claim_evidence_builder', 'compare_matrix', 'flashcard', 'true_false',
]);

function normalizeMode(value: unknown): TutorCanvasMode {
  if (typeof value === 'string' && VALID_MODES.has(value)) return value as TutorCanvasMode;
  return 'distribution';
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

function normalizeTimelineItem(
  value: Partial<{ id: string; label: string; correctPosition: number }>,
  index: number
) {
  return {
    id: asTrimmedString(value.id, nextId('item', index)),
    label: asTrimmedString(value.label, `Item ${index + 1}`),
    correctPosition:
      typeof value.correctPosition === 'number' ? value.correctPosition : undefined,
  };
}

function normalizeHotspot(
  value: Partial<{ id: string; label: string; x: number; y: number; radius: number; isCorrect: boolean }>,
  index: number
) {
  return {
    id: asTrimmedString(value.id, nextId('hotspot', index)),
    label: asTrimmedString(value.label, `Hotspot ${index + 1}`),
    x: typeof value.x === 'number' ? value.x : 50,
    y: typeof value.y === 'number' ? value.y : 50,
    radius: typeof value.radius === 'number' && value.radius > 0 ? value.radius : 12,
    isCorrect: value.isCorrect === true,
  };
}

function normalizeBuilderToken(
  value: Partial<{ id: string; label: string; color: string }>,
  index: number
) {
  return {
    id: asTrimmedString(value.id, nextId('builder_token', index)),
    label: asTrimmedString(value.label, `Token ${index + 1}`),
    color: asTrimmedString(value.color, palette[index % palette.length] || '#0f172a'),
  };
}

function normalizeMapPin(
  value: Partial<{ id: string; label: string; x: number; y: number; isCorrect: boolean }>,
  index: number
) {
  return {
    id: asTrimmedString(value.id, nextId('pin', index)),
    label: asTrimmedString(value.label, `Pin ${index + 1}`),
    x: typeof value.x === 'number' ? value.x : 50,
    y: typeof value.y === 'number' ? value.y : 50,
    isCorrect: value.isCorrect === true,
  };
}

function cloneCanvasState(canvas: TutorCanvasState): TutorCanvasState {
  return {
    ...canvas,
    tokens: [...canvas.tokens],
    zones: [...canvas.zones],
    equation: canvas.equation
      ? {
          ...canvas.equation,
          choices: [...canvas.equation.choices],
        }
      : null,
    fillBlank: canvas.fillBlank
      ? {
          ...canvas.fillBlank,
          slots: canvas.fillBlank.slots.map((slot) => ({ ...slot })),
        }
      : null,
    codeBlock: canvas.codeBlock ? { ...canvas.codeBlock } : null,
    multipleChoice: canvas.multipleChoice
      ? {
          ...canvas.multipleChoice,
          options: [...canvas.multipleChoice.options],
          selectedIds: [...canvas.multipleChoice.selectedIds],
        }
      : null,
    numberLine: canvas.numberLine
      ? {
          ...canvas.numberLine,
          labels: canvas.numberLine.labels ? [...canvas.numberLine.labels] : undefined,
        }
      : null,
    tableGrid: canvas.tableGrid
      ? {
          ...canvas.tableGrid,
          headers: [...canvas.tableGrid.headers],
          cells: canvas.tableGrid.cells.map((cell) => ({ ...cell })),
        }
      : null,
    graphPlot: canvas.graphPlot
      ? {
          ...canvas.graphPlot,
          presetPoints: canvas.graphPlot.presetPoints.map((point) => ({ ...point })),
          userPoints: canvas.graphPlot.userPoints.map((point) => ({ ...point })),
          expectedPoints: canvas.graphPlot.expectedPoints
            ? canvas.graphPlot.expectedPoints.map((point) => ({ ...point }))
            : undefined,
        }
      : null,
    matchingPairs: canvas.matchingPairs
      ? {
          ...canvas.matchingPairs,
          leftItems: canvas.matchingPairs.leftItems.map((item) => ({ ...item })),
          rightItems: canvas.matchingPairs.rightItems.map((item) => ({ ...item })),
          correctPairs: canvas.matchingPairs.correctPairs.map((pair) => ({ ...pair })),
          userPairs: canvas.matchingPairs.userPairs.map((pair) => ({ ...pair })),
        }
      : null,
    ordering: canvas.ordering
      ? {
          ...canvas.ordering,
          items: canvas.ordering.items.map((item) => ({ ...item })),
          userOrder: [...canvas.ordering.userOrder],
        }
      : null,
    textResponse: canvas.textResponse ? { ...canvas.textResponse } : null,
    drawing: canvas.drawing ? { ...canvas.drawing } : null,
    imageHotspot: canvas.imageHotspot
      ? {
          ...canvas.imageHotspot,
          hotspots: canvas.imageHotspot.hotspots.map((hotspot) => ({ ...hotspot })),
          selectedHotspotIds: [...canvas.imageHotspot.selectedHotspotIds],
        }
      : null,
    timeline: canvas.timeline
      ? {
          ...canvas.timeline,
          items: canvas.timeline.items.map((item) => ({ ...item })),
          userOrder: [...canvas.timeline.userOrder],
        }
      : null,
    continuousAxis: canvas.continuousAxis
      ? {
          ...canvas.continuousAxis,
          correctRange: canvas.continuousAxis.correctRange
            ? { ...canvas.continuousAxis.correctRange }
            : undefined,
        }
      : null,
    vennDiagram: canvas.vennDiagram
      ? {
          ...canvas.vennDiagram,
          items: canvas.vennDiagram.items.map((item) => ({ ...item })),
          placements: { ...canvas.vennDiagram.placements },
        }
      : null,
    tokenBuilder: canvas.tokenBuilder
      ? {
          ...canvas.tokenBuilder,
          tokens: canvas.tokenBuilder.tokens.map((token) => ({ ...token })),
          correctTokenIds: canvas.tokenBuilder.correctTokenIds
            ? [...canvas.tokenBuilder.correctTokenIds]
            : undefined,
          userTokenIds: [...canvas.tokenBuilder.userTokenIds],
        }
      : null,
    processFlow: canvas.processFlow
      ? {
          ...canvas.processFlow,
          nodes: canvas.processFlow.nodes.map((node) => ({ ...node })),
          userOrder: [...canvas.processFlow.userOrder],
        }
      : null,
    partWholeBuilder: canvas.partWholeBuilder ? { ...canvas.partWholeBuilder } : null,
    mapCanvas: canvas.mapCanvas
      ? {
          ...canvas.mapCanvas,
          pins: canvas.mapCanvas.pins.map((pin) => ({ ...pin })),
          selectedPinIds: [...canvas.mapCanvas.selectedPinIds],
        }
      : null,
    claimEvidenceBuilder: canvas.claimEvidenceBuilder
      ? {
          ...canvas.claimEvidenceBuilder,
          claims: canvas.claimEvidenceBuilder.claims.map((claim) => ({ ...claim })),
          evidenceItems: canvas.claimEvidenceBuilder.evidenceItems.map((item) => ({ ...item })),
          linkedEvidenceIds: [...canvas.claimEvidenceBuilder.linkedEvidenceIds],
        }
      : null,
    compareMatrix: canvas.compareMatrix
      ? {
          ...canvas.compareMatrix,
          rows: canvas.compareMatrix.rows.map((row) => ({ ...row })),
          columns: canvas.compareMatrix.columns.map((column) => ({ ...column })),
          selectedCells: [...canvas.compareMatrix.selectedCells],
          correctCells: canvas.compareMatrix.correctCells
            ? [...canvas.compareMatrix.correctCells]
            : undefined,
        }
      : null,
    flashcard: canvas.flashcard ? { ...canvas.flashcard } : null,
    trueFalse: canvas.trueFalse ? { ...canvas.trueFalse } : null,
  };
}

function resolveMediaAssetUrl(args: {
  mediaAssets?: TutorMediaAsset[];
  imageId?: string | null;
  imageIndex?: number | null;
}): string | undefined {
  const mediaAssets = args.mediaAssets || [];

  if (typeof args.imageId === 'string' && args.imageId.trim()) {
    const imageId = args.imageId.trim();
    return mediaAssets.find((asset) => asset.id === imageId)?.url;
  }

  if (
    typeof args.imageIndex === 'number' &&
    Number.isFinite(args.imageIndex) &&
    mediaAssets[args.imageIndex]
  ) {
    return mediaAssets[args.imageIndex]?.url;
  }

  return undefined;
}

function resolveCanvasBackgroundUrl(args: {
  backgroundImageUrl?: string;
  mediaAssets?: TutorMediaAsset[];
  imageId?: string | null;
  imageIndex?: number | null;
  defaultImageId?: string | null;
}) {
  const rawBackground = asTrimmedString(args.backgroundImageUrl, '');
  const fromBackgroundAsset = rawBackground
    ? resolveMediaAssetUrl({
        mediaAssets: args.mediaAssets,
        imageId: rawBackground,
      })
    : undefined;

  if (rawBackground) {
    if (
      /^https?:\/\//i.test(rawBackground) ||
      rawBackground.startsWith('/') ||
      rawBackground.startsWith('data:') ||
      rawBackground.startsWith('blob:')
    ) {
      return rawBackground;
    }

    if (fromBackgroundAsset) {
      return fromBackgroundAsset;
    }
  }

  return (
    resolveMediaAssetUrl({
      mediaAssets: args.mediaAssets,
      imageId: args.imageId,
      imageIndex: args.imageIndex,
    }) ||
    resolveMediaAssetUrl({
      mediaAssets: args.mediaAssets,
      imageId: args.defaultImageId,
    })
  );
}

export function createEmptyTutorCanvasState(): TutorCanvasState {
  return {
    mode: 'distribution',
    headline: 'Tutor workspace',
    instruction: 'Listen and arrange the board as the tutor guides you.',
    tokens: [],
    zones: [],
    equation: null,
    fillBlank: null,
    codeBlock: null,
    multipleChoice: null,
    numberLine: null,
    tableGrid: null,
    graphPlot: null,
    matchingPairs: null,
    ordering: null,
    textResponse: null,
    drawing: null,
    imageHotspot: null,
    timeline: null,
    continuousAxis: null,
    vennDiagram: null,
    tokenBuilder: null,
    processFlow: null,
    partWholeBuilder: null,
    mapCanvas: null,
    claimEvidenceBuilder: null,
    compareMatrix: null,
    flashcard: null,
    trueFalse: null,
  };
}

export function applyTutorCommands(
  baseState: TutorCanvasState,
  commands: TutorCanvasCommand[],
  options?: {
    canvasAction?: TutorCanvasAction;
    mediaAssets?: TutorMediaAsset[];
    defaultImageId?: string | null;
  }
): { canvas: TutorCanvasState; sessionComplete: boolean } {
  const canvasAction = options?.canvasAction || 'keep';
  const nextState =
    canvasAction === 'keep'
      ? cloneCanvasState(baseState)
      : createEmptyTutorCanvasState();
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
      case 'set_fill_blank': {
        const slots: TutorFillBlankSlot[] = Array.isArray(command.slots)
          ? command.slots
              .filter((s) => s && typeof s === 'object')
              .map((s, i) => ({
                id: asTrimmedString(s.id, nextId('slot', i)),
                placeholder: asTrimmedString(s.placeholder, `answer ${i + 1}`),
                correctAnswer: typeof s.correctAnswer === 'string' ? s.correctAnswer : undefined,
                userAnswer: '',
              }))
          : [];
        nextState.fillBlank = {
          prompt: asTrimmedString(command.prompt, 'Fill in the blanks.'),
          beforeText: asTrimmedString(command.beforeText, ''),
          afterText: asTrimmedString(command.afterText, ''),
          slots,
          submitted: false,
        };
        nextState.mode = 'fill_blank';
        break;
      }
      case 'clear_fill_blank':
        nextState.fillBlank = null;
        break;
      case 'set_code_block':
        nextState.codeBlock = {
          prompt: asTrimmedString(command.prompt, 'Write your code below.'),
          language: asTrimmedString(command.language, 'python'),
          starterCode: asTrimmedString(command.starterCode, ''),
          userCode: asTrimmedString(command.starterCode, ''),
          expectedOutput: typeof command.expectedOutput === 'string' ? command.expectedOutput : undefined,
          submitted: false,
        };
        nextState.mode = 'code_block';
        break;
      case 'clear_code_block':
        nextState.codeBlock = null;
        break;
      case 'set_multiple_choice': {
        const options = Array.isArray(command.options)
          ? command.options.map((opt, i) => ({
              id: nextId('mc', i),
              label: asTrimmedString(opt.label, `Option ${i + 1}`),
              isCorrect: opt.isCorrect === true,
            }))
          : [];
        nextState.multipleChoice = {
          prompt: asTrimmedString(command.prompt, 'Choose the correct answer.'),
          options,
          selectedId: null,
          allowMultiple: command.allowMultiple === true,
          selectedIds: [],
          submitted: false,
        };
        nextState.mode = 'multiple_choice';
        break;
      }
      case 'clear_multiple_choice':
        nextState.multipleChoice = null;
        break;
      case 'set_number_line': {
        const min = typeof command.min === 'number' ? command.min : 0;
        const max = typeof command.max === 'number' ? command.max : 10;
        nextState.numberLine = {
          prompt: asTrimmedString(command.prompt, 'Place the value on the number line.'),
          min,
          max,
          step: typeof command.step === 'number' && command.step > 0 ? command.step : 1,
          correctValue: typeof command.correctValue === 'number' ? command.correctValue : undefined,
          userValue: null,
          showTicks: command.showTicks !== false,
          labels: Array.isArray(command.labels) ? command.labels : undefined,
          submitted: false,
        };
        nextState.mode = 'number_line';
        break;
      }
      case 'clear_number_line':
        nextState.numberLine = null;
        break;
      case 'set_table_grid': {
        const headers = Array.isArray(command.headers) ? command.headers.map(String) : [];
        const cols = headers.length || 2;
        const rows = typeof command.rows === 'number' && command.rows > 0 ? command.rows : 2;
        const cells = Array.isArray(command.cells)
          ? command.cells.map((c) => ({
              row: typeof c.row === 'number' ? c.row : 0,
              col: typeof c.col === 'number' ? c.col : 0,
              value: asTrimmedString(c.value, ''),
              editable: c.editable !== false,
              correctAnswer: typeof c.correctAnswer === 'string' ? c.correctAnswer : undefined,
            }))
          : [];
        nextState.tableGrid = {
          prompt: asTrimmedString(command.prompt, 'Complete the table.'),
          headers,
          rows,
          cols,
          cells,
          submitted: false,
        };
        nextState.mode = 'table_grid';
        break;
      }
      case 'clear_table_grid':
        nextState.tableGrid = null;
        break;
      case 'set_graph_plot': {
        const presetPoints = Array.isArray(command.presetPoints)
          ? command.presetPoints.map((p, i) => ({
              id: nextId('pt', i),
              x: typeof p.x === 'number' ? p.x : 0,
              y: typeof p.y === 'number' ? p.y : 0,
              label: typeof p.label === 'string' ? p.label : undefined,
              userPlaced: false,
            }))
          : [];
        nextState.graphPlot = {
          prompt: asTrimmedString(command.prompt, 'Plot the points on the graph.'),
          xMin: typeof command.xMin === 'number' ? command.xMin : -10,
          xMax: typeof command.xMax === 'number' ? command.xMax : 10,
          yMin: typeof command.yMin === 'number' ? command.yMin : -10,
          yMax: typeof command.yMax === 'number' ? command.yMax : 10,
          xLabel: asTrimmedString(command.xLabel, 'x'),
          yLabel: asTrimmedString(command.yLabel, 'y'),
          gridLines: command.gridLines !== false,
          presetPoints,
          userPoints: [],
          expectedPoints: Array.isArray(command.expectedPoints) ? command.expectedPoints : undefined,
          submitted: false,
        };
        nextState.mode = 'graph_plot';
        break;
      }
      case 'clear_graph_plot':
        nextState.graphPlot = null;
        break;
      case 'set_matching_pairs': {
        const leftItems = Array.isArray(command.leftItems)
          ? command.leftItems.map((item, i) => ({ id: nextId('ml', i), label: asTrimmedString(item.label, `Left ${i + 1}`) }))
          : [];
        const rightItems = Array.isArray(command.rightItems)
          ? command.rightItems.map((item, i) => ({ id: nextId('mr', i), label: asTrimmedString(item.label, `Right ${i + 1}`) }))
          : [];
        const correctPairs = Array.isArray(command.correctPairs)
          ? command.correctPairs
              .filter((p) => typeof p.leftIndex === 'number' && typeof p.rightIndex === 'number')
              .map((p) => ({
                leftId: leftItems[p.leftIndex]?.id || '',
                rightId: rightItems[p.rightIndex]?.id || '',
              }))
              .filter((p) => p.leftId && p.rightId)
          : [];
        nextState.matchingPairs = {
          prompt: asTrimmedString(command.prompt, 'Match the items.'),
          leftItems,
          rightItems,
          correctPairs,
          userPairs: [],
          submitted: false,
        };
        nextState.mode = 'matching_pairs';
        break;
      }
      case 'clear_matching_pairs':
        nextState.matchingPairs = null;
        break;
      case 'set_ordering': {
        const items = Array.isArray(command.items)
          ? command.items.map((item, i) => ({
              id: nextId('ord', i),
              label: asTrimmedString(item.label, `Item ${i + 1}`),
              correctPosition: typeof item.correctPosition === 'number' ? item.correctPosition : undefined,
            }))
          : [];
        nextState.ordering = {
          prompt: asTrimmedString(command.prompt, 'Arrange in the correct order.'),
          items,
          userOrder: items.map((item) => item.id),
          submitted: false,
        };
        nextState.mode = 'ordering';
        break;
      }
      case 'clear_ordering':
        nextState.ordering = null;
        break;
      case 'set_text_response':
        nextState.textResponse = {
          prompt: asTrimmedString(command.prompt, 'Type your answer.'),
          placeholder: asTrimmedString(command.placeholder, 'Type here...'),
          userText: '',
          maxLength: typeof command.maxLength === 'number' && command.maxLength > 0 ? command.maxLength : undefined,
          submitted: false,
        };
        nextState.mode = 'text_response';
        break;
      case 'clear_text_response':
        nextState.textResponse = null;
        break;
      case 'set_drawing':
        {
          const previousSceneRevision =
            baseState.drawing?.sceneRevision ??
            nextState.drawing?.sceneRevision ??
            0;
        nextState.drawing = {
          prompt: asTrimmedString(command.prompt, 'Draw your answer.'),
          backgroundImageUrl: resolveCanvasBackgroundUrl({
            backgroundImageUrl: command.backgroundImageUrl,
            mediaAssets: options?.mediaAssets,
            imageId: command.imageId,
            imageIndex: command.imageIndex,
            defaultImageId: options?.defaultImageId,
          }),
          canvasWidth: typeof command.canvasWidth === 'number' ? command.canvasWidth : 600,
          canvasHeight: typeof command.canvasHeight === 'number' ? command.canvasHeight : 400,
          brushColor: asTrimmedString(command.brushColor, '#000000'),
          brushSize: typeof command.brushSize === 'number' ? command.brushSize : 3,
          submitted: false,
          sceneRevision: previousSceneRevision + 1,
        };
        nextState.mode = 'drawing';
        break;
        }
      case 'clear_drawing':
        nextState.drawing = null;
        break;
      case 'set_image_hotspot': {
        const hotspots = Array.isArray(command.hotspots)
          ? command.hotspots.map((hotspot, index) => normalizeHotspot(hotspot, index))
          : [];
        nextState.imageHotspot = {
          prompt: asTrimmedString(command.prompt, 'Tap the correct region.'),
          backgroundImageUrl: resolveCanvasBackgroundUrl({
            backgroundImageUrl: command.backgroundImageUrl,
            mediaAssets: options?.mediaAssets,
            imageId: command.imageId,
            imageIndex: command.imageIndex,
            defaultImageId: options?.defaultImageId,
          }),
          hotspots,
          selectedHotspotIds: [],
          allowMultiple: command.allowMultiple === true,
          submitted: false,
        };
        nextState.mode = 'image_hotspot';
        break;
      }
      case 'clear_image_hotspot':
        nextState.imageHotspot = null;
        break;
      case 'set_timeline': {
        const items = Array.isArray(command.items)
          ? command.items.map((item, index) => normalizeTimelineItem(item, index))
          : [];
        nextState.timeline = {
          prompt: asTrimmedString(command.prompt, 'Place the events in order.'),
          items,
          userOrder: items.map((item) => item.id),
          submitted: false,
        };
        nextState.mode = 'timeline';
        break;
      }
      case 'clear_timeline':
        nextState.timeline = null;
        break;
      case 'set_continuous_axis':
        nextState.continuousAxis = {
          prompt: asTrimmedString(command.prompt, 'Place the value on the axis.'),
          min: typeof command.min === 'number' ? command.min : 0,
          max: typeof command.max === 'number' ? command.max : 10,
          step: typeof command.step === 'number' && command.step > 0 ? command.step : 1,
          correctValue:
            typeof command.correctValue === 'number' ? command.correctValue : undefined,
          correctRange:
            command.correctRange &&
            typeof command.correctRange.min === 'number' &&
            typeof command.correctRange.max === 'number'
              ? command.correctRange
              : undefined,
          userValue: null,
          leftLabel: asTrimmedString(command.leftLabel, ''),
          rightLabel: asTrimmedString(command.rightLabel, ''),
          submitted: false,
        };
        nextState.mode = 'continuous_axis';
        break;
      case 'clear_continuous_axis':
        nextState.continuousAxis = null;
        break;
      case 'set_venn_diagram': {
        const items = Array.isArray(command.items)
          ? command.items.map((item, index) => ({
              id: asTrimmedString(item.id, nextId('venn', index)),
              label: asTrimmedString(item.label, `Item ${index + 1}`),
              correctRegion: item.correctRegion,
            }))
          : [];
        nextState.vennDiagram = {
          prompt: asTrimmedString(command.prompt, 'Place the items in the correct region.'),
          leftLabel: asTrimmedString(command.leftLabel, 'Left'),
          rightLabel: asTrimmedString(command.rightLabel, 'Right'),
          items,
          placements: Object.fromEntries(items.map((item) => [item.id, null])),
          submitted: false,
        };
        nextState.mode = 'venn_diagram';
        break;
      }
      case 'clear_venn_diagram':
        nextState.vennDiagram = null;
        break;
      case 'set_token_builder': {
        const tokens = Array.isArray(command.tokens)
          ? command.tokens.map((token, index) => normalizeBuilderToken(token, index))
          : [];
        nextState.tokenBuilder = {
          prompt: asTrimmedString(command.prompt, 'Build the correct expression.'),
          tokens,
          slots:
            typeof command.slots === 'number' && command.slots > 0
              ? command.slots
              : tokens.length,
          correctTokenIds: Array.isArray(command.correctTokenIds)
            ? command.correctTokenIds.filter((id): id is string => typeof id === 'string')
            : undefined,
          userTokenIds: [],
          submitted: false,
        };
        nextState.mode = 'token_builder';
        break;
      }
      case 'clear_token_builder':
        nextState.tokenBuilder = null;
        break;
      case 'set_process_flow': {
        const nodes = Array.isArray(command.nodes)
          ? command.nodes.map((node, index) => normalizeTimelineItem(node, index))
          : [];
        nextState.processFlow = {
          prompt: asTrimmedString(command.prompt, 'Arrange the process steps.'),
          nodes,
          userOrder: nodes.map((node) => node.id),
          submitted: false,
        };
        nextState.mode = 'process_flow';
        break;
      }
      case 'clear_process_flow':
        nextState.processFlow = null;
        break;
      case 'set_part_whole_builder':
        nextState.partWholeBuilder = {
          prompt: asTrimmedString(command.prompt, 'Show the correct share.'),
          totalParts:
            typeof command.totalParts === 'number' && command.totalParts > 0
              ? Math.floor(command.totalParts)
              : 4,
          filledParts: 0,
          correctFilledParts:
            typeof command.correctFilledParts === 'number'
              ? Math.floor(command.correctFilledParts)
              : undefined,
          label: typeof command.label === 'string' ? command.label : undefined,
          submitted: false,
        };
        nextState.mode = 'part_whole_builder';
        break;
      case 'clear_part_whole_builder':
        nextState.partWholeBuilder = null;
        break;
      case 'set_map_canvas': {
        const pins = Array.isArray(command.pins)
          ? command.pins.map((pin, index) => normalizeMapPin(pin, index))
          : [];
        nextState.mapCanvas = {
          prompt: asTrimmedString(command.prompt, 'Pick the correct place on the map.'),
          backgroundImageUrl: resolveCanvasBackgroundUrl({
            backgroundImageUrl: command.backgroundImageUrl,
            mediaAssets: options?.mediaAssets,
            imageId: command.imageId,
            imageIndex: command.imageIndex,
            defaultImageId: options?.defaultImageId,
          }),
          pins,
          selectedPinIds: [],
          allowMultiple: command.allowMultiple === true,
          submitted: false,
        };
        nextState.mode = 'map_canvas';
        break;
      }
      case 'clear_map_canvas':
        nextState.mapCanvas = null;
        break;
      case 'set_claim_evidence_builder': {
        const claims = Array.isArray(command.claims)
          ? command.claims.map((claim, index) => ({
              id: asTrimmedString(claim.id, nextId('claim', index)),
              label: asTrimmedString(claim.label, `Claim ${index + 1}`),
              isCorrect: claim.isCorrect === true,
            }))
          : [];
        const evidenceItems = Array.isArray(command.evidenceItems)
          ? command.evidenceItems.map((item, index) => ({
              id: asTrimmedString(item.id, nextId('evidence', index)),
              label: asTrimmedString(item.label, `Evidence ${index + 1}`),
              supportsClaimId:
                typeof item.supportsClaimId === 'string' ? item.supportsClaimId : undefined,
            }))
          : [];
        nextState.claimEvidenceBuilder = {
          prompt: asTrimmedString(command.prompt, 'Pick the claim and supporting evidence.'),
          claims,
          evidenceItems,
          selectedClaimId: null,
          linkedEvidenceIds: [],
          submitted: false,
        };
        nextState.mode = 'claim_evidence_builder';
        break;
      }
      case 'clear_claim_evidence_builder':
        nextState.claimEvidenceBuilder = null;
        break;
      case 'set_compare_matrix': {
        const rows = Array.isArray(command.rows)
          ? command.rows.map((row, index) => ({
              id: asTrimmedString(row.id, nextId('row', index)),
              label: asTrimmedString(row.label, `Row ${index + 1}`),
            }))
          : [];
        const columns = Array.isArray(command.columns)
          ? command.columns.map((column, index) => ({
              id: asTrimmedString(column.id, nextId('column', index)),
              label: asTrimmedString(column.label, `Column ${index + 1}`),
            }))
          : [];
        nextState.compareMatrix = {
          prompt: asTrimmedString(command.prompt, 'Compare the items across the traits.'),
          rows,
          columns,
          selectedCells: [],
          correctCells: Array.isArray(command.correctCells)
            ? command.correctCells.filter((cell): cell is string => typeof cell === 'string')
            : undefined,
          submitted: false,
        };
        nextState.mode = 'compare_matrix';
        break;
      }
      case 'clear_compare_matrix':
        nextState.compareMatrix = null;
        break;
      case 'set_flashcard':
        nextState.flashcard = {
          prompt: asTrimmedString(command.prompt, 'Study the card, then flip it.'),
          front: asTrimmedString(command.front, ''),
          back: asTrimmedString(command.back, ''),
          revealed: false,
          submitted: false,
        };
        nextState.mode = 'flashcard';
        break;
      case 'clear_flashcard':
        nextState.flashcard = null;
        break;
      case 'set_true_false':
        nextState.trueFalse = {
          prompt: asTrimmedString(command.prompt, 'Decide whether the statement is true or false.'),
          statement: asTrimmedString(command.statement, ''),
          correctAnswer:
            typeof command.correctAnswer === 'boolean' ? command.correctAnswer : undefined,
          userAnswer: null,
          submitted: false,
        };
        nextState.mode = 'true_false';
        break;
      case 'clear_true_false':
        nextState.trueFalse = null;
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

  if (canvas.mode === 'fill_blank' && canvas.fillBlank) {
    const filled = canvas.fillBlank.slots
      .map((slot) => `${slot.placeholder}: ${slot.userAnswer || '(empty)'}`)
      .join(', ');
    return `Fill-in-the-blank: ${canvas.fillBlank.prompt}. Answers: ${filled}. Submitted: ${canvas.fillBlank.submitted}.`;
  }

  if (canvas.mode === 'code_block' && canvas.codeBlock) {
    const codePreview = canvas.codeBlock.userCode.slice(0, 200);
    return `Code editor (${canvas.codeBlock.language}): ${canvas.codeBlock.prompt}. Code: ${codePreview}. Submitted: ${canvas.codeBlock.submitted}.`;
  }

  if (canvas.mode === 'multiple_choice' && canvas.multipleChoice) {
    const mc = canvas.multipleChoice;
    const selected = mc.allowMultiple
      ? mc.selectedIds.map((id) => mc.options.find((o) => o.id === id)?.label).filter(Boolean).join(', ') || 'none'
      : mc.options.find((o) => o.id === mc.selectedId)?.label || 'none';
    return `Multiple choice: ${mc.prompt}. Options: ${mc.options.map((o) => o.label).join(', ')}. Selected: ${selected}. Submitted: ${mc.submitted}.`;
  }

  if (canvas.mode === 'number_line' && canvas.numberLine) {
    return `Number line [${canvas.numberLine.min}–${canvas.numberLine.max}]: ${canvas.numberLine.prompt}. User value: ${canvas.numberLine.userValue ?? 'none'}. Submitted: ${canvas.numberLine.submitted}.`;
  }

  if (canvas.mode === 'table_grid' && canvas.tableGrid) {
    const editableCells = canvas.tableGrid.cells.filter((c) => c.editable);
    const filled = editableCells.filter((c) => c.value.trim()).length;
    return `Table (${canvas.tableGrid.rows}x${canvas.tableGrid.cols}): ${canvas.tableGrid.prompt}. Filled: ${filled}/${editableCells.length}. Submitted: ${canvas.tableGrid.submitted}.`;
  }

  if (canvas.mode === 'graph_plot' && canvas.graphPlot) {
    return `Graph [${canvas.graphPlot.xMin},${canvas.graphPlot.xMax}]x[${canvas.graphPlot.yMin},${canvas.graphPlot.yMax}]: ${canvas.graphPlot.prompt}. Preset: ${canvas.graphPlot.presetPoints.length}, User: ${canvas.graphPlot.userPoints.length}. Submitted: ${canvas.graphPlot.submitted}.`;
  }

  if (canvas.mode === 'matching_pairs' && canvas.matchingPairs) {
    return `Matching: ${canvas.matchingPairs.prompt}. Pairs made: ${canvas.matchingPairs.userPairs.length}/${canvas.matchingPairs.leftItems.length}. Submitted: ${canvas.matchingPairs.submitted}.`;
  }

  if (canvas.mode === 'ordering' && canvas.ordering) {
    return `Ordering: ${canvas.ordering.prompt}. Items: ${canvas.ordering.items.length}. Submitted: ${canvas.ordering.submitted}.`;
  }

  if (canvas.mode === 'text_response' && canvas.textResponse) {
    const preview = canvas.textResponse.userText.slice(0, 100);
    return `Text response: ${canvas.textResponse.prompt}. Answer: ${preview || '(empty)'}. Submitted: ${canvas.textResponse.submitted}.`;
  }

  if (canvas.mode === 'drawing' && canvas.drawing) {
    return `Drawing canvas: ${canvas.drawing.prompt}. Submitted: ${canvas.drawing.submitted}.`;
  }

  if (canvas.mode === 'image_hotspot' && canvas.imageHotspot) {
    return `Image hotspot: ${canvas.imageHotspot.prompt}. Selected: ${canvas.imageHotspot.selectedHotspotIds.join(', ') || 'none'}. Submitted: ${canvas.imageHotspot.submitted}.`;
  }

  if (canvas.mode === 'timeline' && canvas.timeline) {
    return `Timeline: ${canvas.timeline.prompt}. Order: ${canvas.timeline.userOrder.join(', ') || 'none'}. Submitted: ${canvas.timeline.submitted}.`;
  }

  if (canvas.mode === 'continuous_axis' && canvas.continuousAxis) {
    return `Continuous axis [${canvas.continuousAxis.min}–${canvas.continuousAxis.max}]: ${canvas.continuousAxis.prompt}. Learner value: ${canvas.continuousAxis.userValue ?? 'none'}. Submitted: ${canvas.continuousAxis.submitted}.`;
  }

  if (canvas.mode === 'venn_diagram' && canvas.vennDiagram) {
    return `Venn diagram: ${canvas.vennDiagram.prompt}. Placed items: ${Object.values(canvas.vennDiagram.placements).filter(Boolean).length}/${canvas.vennDiagram.items.length}. Submitted: ${canvas.vennDiagram.submitted}.`;
  }

  if (canvas.mode === 'token_builder' && canvas.tokenBuilder) {
    return `Token builder: ${canvas.tokenBuilder.prompt}. Built tokens: ${canvas.tokenBuilder.userTokenIds.join(', ') || 'none'}. Submitted: ${canvas.tokenBuilder.submitted}.`;
  }

  if (canvas.mode === 'process_flow' && canvas.processFlow) {
    return `Process flow: ${canvas.processFlow.prompt}. Order: ${canvas.processFlow.userOrder.join(', ') || 'none'}. Submitted: ${canvas.processFlow.submitted}.`;
  }

  if (canvas.mode === 'part_whole_builder' && canvas.partWholeBuilder) {
    return `Part-whole builder: ${canvas.partWholeBuilder.prompt}. Filled: ${canvas.partWholeBuilder.filledParts}/${canvas.partWholeBuilder.totalParts}. Submitted: ${canvas.partWholeBuilder.submitted}.`;
  }

  if (canvas.mode === 'map_canvas' && canvas.mapCanvas) {
    return `Map canvas: ${canvas.mapCanvas.prompt}. Selected pins: ${canvas.mapCanvas.selectedPinIds.join(', ') || 'none'}. Submitted: ${canvas.mapCanvas.submitted}.`;
  }

  if (canvas.mode === 'claim_evidence_builder' && canvas.claimEvidenceBuilder) {
    return `Claim-evidence builder: ${canvas.claimEvidenceBuilder.prompt}. Claim: ${canvas.claimEvidenceBuilder.selectedClaimId || 'none'}. Evidence links: ${canvas.claimEvidenceBuilder.linkedEvidenceIds.length}. Submitted: ${canvas.claimEvidenceBuilder.submitted}.`;
  }

  if (canvas.mode === 'compare_matrix' && canvas.compareMatrix) {
    return `Compare matrix: ${canvas.compareMatrix.prompt}. Selected cells: ${canvas.compareMatrix.selectedCells.length}. Submitted: ${canvas.compareMatrix.submitted}.`;
  }

  if (canvas.mode === 'flashcard' && canvas.flashcard) {
    return `Flashcard: ${canvas.flashcard.prompt}. Revealed: ${canvas.flashcard.revealed}. Submitted: ${canvas.flashcard.submitted}.`;
  }

  if (canvas.mode === 'true_false' && canvas.trueFalse) {
    return `True/false: ${canvas.trueFalse.statement}. Learner answer: ${canvas.trueFalse.userAnswer === null ? 'none' : canvas.trueFalse.userAnswer ? 'true' : 'false'}. Submitted: ${canvas.trueFalse.submitted}.`;
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

export function updateTutorFillBlankAnswer(
  canvas: TutorCanvasState,
  slotId: string,
  answer: string
): TutorCanvasState {
  if (!canvas.fillBlank) return canvas;

  return {
    ...canvas,
    fillBlank: {
      ...canvas.fillBlank,
      slots: canvas.fillBlank.slots.map((slot) =>
        slot.id === slotId ? { ...slot, userAnswer: answer } : slot
      ),
    },
  };
}

export function updateTutorCodeBlockCode(
  canvas: TutorCanvasState,
  code: string
): TutorCanvasState {
  if (!canvas.codeBlock) return canvas;

  return {
    ...canvas,
    codeBlock: {
      ...canvas.codeBlock,
      userCode: code,
    },
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
  speech: string;
  awaitMode?: TutorAwaitMode;
  mediaAssets?: TutorMediaAsset[];
  activeImageId?: string | null;
  canvas: TutorCanvasState;
  turns?: TutorRuntimeSnapshot['turns'];
  intake?: TutorRuntimeSnapshot['intake'];
  continuation?: TutorRuntimeSnapshot['continuation'];
  status?: TutorRuntimeSnapshot['status'];
  speechRevision?: number;
}) {
  return {
    sessionId: input.sessionId,
    prompt: input.prompt,
    lessonTopic: input.lessonTopic || input.prompt,
    learnerLevel: input.learnerLevel || 'unknown',
    lessonOutline: input.lessonOutline || [],
    status: input.status || 'active',
    speech: input.speech,
    awaitMode: input.awaitMode || 'voice_or_canvas',
    speechRevision: input.speechRevision ?? 1,
    mediaAssets: input.mediaAssets || [],
    activeImageId: input.activeImageId ?? null,
    canvas: input.canvas,
    turns: input.turns || [],
    intake: input.intake ?? null,
    continuation: input.continuation ?? null,
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
