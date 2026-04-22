import type {
  TutorCanvasEvidence,
  TutorCanvasInteraction,
  TutorCanvasState,
  TutorTurn,
} from '@/lib/types/tutor';

function tryParseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

export function parseTutorCanvasInteractionFromTranscript(
  transcript: string
): TutorCanvasInteraction | null {
  const match = /^\[Canvas interaction: ([a-z_]+)\]\s*([\s\S]*)$/i.exec(
    transcript.trim()
  );

  if (!match) {
    return null;
  }

  const mode = match[1]?.trim();
  const payloadText = match[2]?.trim() || '';
  const payload = payloadText ? tryParseJson(payloadText) : null;

  switch (mode) {
    case 'fill_blank':
      if (payload?.answers && typeof payload.answers === 'object') {
        const answers = Object.fromEntries(
          Object.entries(payload.answers).filter(([, value]) => typeof value === 'string')
        ) as Record<string, string>;
        return { mode: 'fill_blank', answers };
      }
      return null;
    case 'code_block':
      if (typeof payload?.code !== 'string') {
        return null;
      }

      return {
        mode: 'code_block',
        code: payload.code,
        execution:
          payload.execution &&
          typeof payload.execution === 'object' &&
          ((payload.execution as { status?: unknown }).status === 'success' ||
            (payload.execution as { status?: unknown }).status === 'error') &&
          typeof (payload.execution as { stdout?: unknown }).stdout === 'string' &&
          typeof (payload.execution as { stderr?: unknown }).stderr === 'string'
            ? {
                status: (payload.execution as { status: 'success' | 'error' }).status,
                stdout: (payload.execution as { stdout: string }).stdout,
                stderr: (payload.execution as { stderr: string }).stderr,
              }
            : null,
      };
    case 'multiple_choice':
      return Array.isArray(payload?.selectedIds)
        ? {
            mode: 'multiple_choice',
            selectedIds: payload.selectedIds.filter(
              (value): value is string => typeof value === 'string'
            ),
          }
        : null;
    case 'number_line':
      return typeof payload?.value === 'number' || payload?.value === null
        ? { mode: 'number_line', value: (payload?.value as number | null) ?? null }
        : null;
    case 'table_grid':
      if (payload?.cells && typeof payload.cells === 'object') {
        const cells = Object.fromEntries(
          Object.entries(payload.cells).filter(([, value]) => typeof value === 'string')
        ) as Record<string, string>;
        return { mode: 'table_grid', cells };
      }
      return null;
    case 'graph_plot':
      return Array.isArray(payload?.points) || Array.isArray(payload?.userPoints)
        ? {
            mode: 'graph_plot',
            points: (
              Array.isArray(payload?.points)
                ? payload.points
                : Array.isArray(payload?.userPoints)
                  ? payload.userPoints
                  : []
            )
              .filter(
                (point): point is { x: number; y: number } =>
                  Boolean(point) &&
                  typeof point === 'object' &&
                  typeof (point as { x?: unknown }).x === 'number' &&
                  typeof (point as { y?: unknown }).y === 'number'
              )
              .map((point) => ({ x: point.x, y: point.y })),
          }
        : null;
    case 'matching_pairs':
      return Array.isArray(payload?.userPairs) || Array.isArray(payload?.pairs)
        ? {
            mode: 'matching_pairs',
            userPairs: (
              Array.isArray(payload?.userPairs)
                ? payload.userPairs
                : Array.isArray(payload?.pairs)
                  ? payload.pairs
                  : []
            )
              .filter(
                (pair): pair is { leftId: string; rightId: string } =>
                  Boolean(pair) &&
                  typeof pair === 'object' &&
                  typeof (pair as { leftId?: unknown }).leftId === 'string' &&
                  typeof (pair as { rightId?: unknown }).rightId === 'string'
              )
              .map((pair) => ({ leftId: pair.leftId, rightId: pair.rightId })),
          }
        : null;
    case 'ordering':
      return Array.isArray(payload?.userOrder) || Array.isArray(payload?.order)
        ? {
            mode: 'ordering',
            userOrder: (
              Array.isArray(payload?.userOrder)
                ? payload.userOrder
                : Array.isArray(payload?.order)
                  ? payload.order
                  : []
            ).filter(
              (value): value is string => typeof value === 'string'
            ),
          }
        : null;
    case 'text_response':
      return typeof payload?.text === 'string'
        ? { mode: 'text_response', text: payload.text }
        : null;
    case 'drawing':
      return {
        mode: 'drawing',
        summary:
          typeof payload?.summary === 'string' ? payload.summary : undefined,
        strokeColors: Array.isArray(payload?.strokeColors)
          ? payload.strokeColors.filter(
              (value): value is string => typeof value === 'string'
            )
          : undefined,
        strokeCount:
          typeof payload?.strokeCount === 'number' ? payload.strokeCount : undefined,
      };
    default:
      return null;
  }
}

export function coalesceTutorCanvasInteraction(args: {
  transcript: string;
  canvasInteraction?: TutorCanvasInteraction | null;
  canvasEvidence?: TutorCanvasEvidence | null;
}): TutorCanvasInteraction | null {
  if (args.canvasInteraction) {
    return args.canvasInteraction;
  }

  const legacyInteraction = parseTutorCanvasInteractionFromTranscript(args.transcript);
  if (legacyInteraction) {
    return legacyInteraction;
  }

  if (args.canvasEvidence?.dataUrl) {
    return {
      mode: 'drawing',
      summary: args.canvasEvidence.summary,
      strokeColors: args.canvasEvidence.strokeColors,
      strokeCount: args.canvasEvidence.strokeCount,
    };
  }

  return null;
}

export function mergeTutorCanvasStateWithInteraction(
  canvas: TutorCanvasState,
  canvasInteraction: TutorCanvasInteraction | null
): TutorCanvasState {
  if (!canvasInteraction) {
    return canvas;
  }

  switch (canvasInteraction.mode) {
    case 'fill_blank':
      if (!canvas.fillBlank) return canvas;
      return {
        ...canvas,
        fillBlank: {
          ...canvas.fillBlank,
          submitted: true,
          slots: canvas.fillBlank.slots.map((slot) => ({
            ...slot,
            userAnswer: canvasInteraction.answers[slot.id] ?? slot.userAnswer,
          })),
        },
      };
    case 'code_block':
      if (!canvas.codeBlock) return canvas;
      return {
        ...canvas,
        codeBlock: {
          ...canvas.codeBlock,
          userCode: canvasInteraction.code,
          submitted: true,
        },
      };
    case 'multiple_choice':
      if (!canvas.multipleChoice) return canvas;
      return {
        ...canvas,
        multipleChoice: {
          ...canvas.multipleChoice,
          selectedIds: canvasInteraction.selectedIds,
          selectedId: canvas.multipleChoice.allowMultiple
            ? null
            : canvasInteraction.selectedIds[0] ?? null,
          submitted: true,
        },
      };
    case 'number_line':
      if (!canvas.numberLine) return canvas;
      return {
        ...canvas,
        numberLine: {
          ...canvas.numberLine,
          userValue: canvasInteraction.value,
          submitted: true,
        },
      };
    case 'table_grid':
      if (!canvas.tableGrid) return canvas;
      return {
        ...canvas,
        tableGrid: {
          ...canvas.tableGrid,
          submitted: true,
          cells: canvas.tableGrid.cells.map((cell) => ({
            ...cell,
            value:
              cell.editable && canvasInteraction.cells[`${cell.row}_${cell.col}`] !== undefined
                ? canvasInteraction.cells[`${cell.row}_${cell.col}`] || ''
                : cell.value,
          })),
        },
      };
    case 'graph_plot':
      if (!canvas.graphPlot) return canvas;
      return {
        ...canvas,
        graphPlot: {
          ...canvas.graphPlot,
          submitted: true,
          userPoints: canvasInteraction.points.map((point, index) => ({
            id: `user-point-${index + 1}`,
            x: point.x,
            y: point.y,
            userPlaced: true,
          })),
        },
      };
    case 'matching_pairs':
      if (!canvas.matchingPairs) return canvas;
      return {
        ...canvas,
        matchingPairs: {
          ...canvas.matchingPairs,
          submitted: true,
          userPairs: canvasInteraction.userPairs,
        },
      };
    case 'ordering':
      if (!canvas.ordering) return canvas;
      return {
        ...canvas,
        ordering: {
          ...canvas.ordering,
          submitted: true,
          userOrder: canvasInteraction.userOrder,
        },
      };
    case 'text_response':
      if (!canvas.textResponse) return canvas;
      return {
        ...canvas,
        textResponse: {
          ...canvas.textResponse,
          userText: canvasInteraction.text,
          submitted: true,
        },
      };
    case 'drawing':
      if (!canvas.drawing) return canvas;
      return {
        ...canvas,
        drawing: {
          ...canvas.drawing,
          submitted: true,
        },
      };
  }
}

function canvasStateToContext(
  canvas: TutorCanvasState,
  canvasInteraction: TutorCanvasInteraction | null
): Record<string, unknown> {
  if (canvas.mode === 'fill_blank' && canvas.fillBlank) {
    return {
      mode: canvas.mode,
      prompt: canvas.fillBlank.prompt,
      beforeText: canvas.fillBlank.beforeText,
      afterText: canvas.fillBlank.afterText,
      submitted: canvas.fillBlank.submitted,
      slots: canvas.fillBlank.slots.map((slot) => ({
        id: slot.id,
        placeholder: slot.placeholder,
        learnerAnswer: slot.userAnswer || null,
        correctAnswer: slot.correctAnswer ?? null,
      })),
    };
  }

  if (canvas.mode === 'code_block' && canvas.codeBlock) {
    const latestExecution =
      canvasInteraction?.mode === 'code_block'
        ? canvasInteraction.execution ?? null
        : null;

    return {
      mode: canvas.mode,
      prompt: canvas.codeBlock.prompt,
      language: canvas.codeBlock.language,
      starterCode: canvas.codeBlock.starterCode,
      learnerCode: canvas.codeBlock.userCode || null,
      expectedOutput: canvas.codeBlock.expectedOutput ?? null,
      latestExecution,
      submitted: canvas.codeBlock.submitted,
    };
  }

  if (canvas.mode === 'multiple_choice' && canvas.multipleChoice) {
    const multipleChoice = canvas.multipleChoice;
    return {
      mode: canvas.mode,
      prompt: multipleChoice.prompt,
      allowMultiple: multipleChoice.allowMultiple,
      options: multipleChoice.options.map((option) => ({
        id: option.id,
        label: option.label,
        isCorrect: option.isCorrect ?? false,
      })),
      learnerSelection: {
        selectedIds: multipleChoice.selectedIds,
        selectedLabels: multipleChoice.options
          .filter((option) => multipleChoice.selectedIds.includes(option.id))
          .map((option) => option.label),
      },
      submitted: multipleChoice.submitted,
    };
  }

  if (canvas.mode === 'number_line' && canvas.numberLine) {
    return {
      mode: canvas.mode,
      prompt: canvas.numberLine.prompt,
      min: canvas.numberLine.min,
      max: canvas.numberLine.max,
      step: canvas.numberLine.step,
      learnerValue: canvas.numberLine.userValue,
      correctValue: canvas.numberLine.correctValue ?? null,
      submitted: canvas.numberLine.submitted,
    };
  }

  if (canvas.mode === 'table_grid' && canvas.tableGrid) {
    return {
      mode: canvas.mode,
      prompt: canvas.tableGrid.prompt,
      headers: canvas.tableGrid.headers,
      rows: canvas.tableGrid.rows,
      cols: canvas.tableGrid.cols,
      submitted: canvas.tableGrid.submitted,
      cells: canvas.tableGrid.cells.map((cell) => ({
        row: cell.row,
        col: cell.col,
        value: cell.value || null,
        editable: cell.editable,
        correctAnswer: cell.correctAnswer ?? null,
      })),
    };
  }

  if (canvas.mode === 'graph_plot' && canvas.graphPlot) {
    return {
      mode: canvas.mode,
      prompt: canvas.graphPlot.prompt,
      bounds: {
        xMin: canvas.graphPlot.xMin,
        xMax: canvas.graphPlot.xMax,
        yMin: canvas.graphPlot.yMin,
        yMax: canvas.graphPlot.yMax,
      },
      expectedPoints: canvas.graphPlot.expectedPoints ?? [],
      learnerPoints: canvas.graphPlot.userPoints.map((point) => ({
        x: point.x,
        y: point.y,
        label: point.label ?? null,
      })),
      submitted: canvas.graphPlot.submitted,
    };
  }

  if (canvas.mode === 'matching_pairs' && canvas.matchingPairs) {
    return {
      mode: canvas.mode,
      prompt: canvas.matchingPairs.prompt,
      leftItems: canvas.matchingPairs.leftItems,
      rightItems: canvas.matchingPairs.rightItems,
      learnerPairs: canvas.matchingPairs.userPairs,
      correctPairs: canvas.matchingPairs.correctPairs,
      submitted: canvas.matchingPairs.submitted,
    };
  }

  if (canvas.mode === 'ordering' && canvas.ordering) {
    return {
      mode: canvas.mode,
      prompt: canvas.ordering.prompt,
      items: canvas.ordering.items,
      learnerOrder: canvas.ordering.userOrder,
      submitted: canvas.ordering.submitted,
    };
  }

  if (canvas.mode === 'text_response' && canvas.textResponse) {
    return {
      mode: canvas.mode,
      prompt: canvas.textResponse.prompt,
      placeholder: canvas.textResponse.placeholder,
      learnerText: canvas.textResponse.userText || null,
      maxLength: canvas.textResponse.maxLength ?? null,
      submitted: canvas.textResponse.submitted,
    };
  }

  if (canvas.mode === 'drawing' && canvas.drawing) {
    return {
      mode: canvas.mode,
      prompt: canvas.drawing.prompt,
      backgroundImageUrl: canvas.drawing.backgroundImageUrl ?? null,
      brushColor: canvas.drawing.brushColor,
      brushSize: canvas.drawing.brushSize,
      canvasWidth: canvas.drawing.canvasWidth,
      canvasHeight: canvas.drawing.canvasHeight,
      submitted: canvas.drawing.submitted,
    };
  }

  if (canvas.mode === 'equation' && canvas.equation) {
    return {
      mode: canvas.mode,
      prompt: canvas.equation.prompt,
      expression: canvas.equation.expression,
      choices: canvas.equation.choices,
      selectedChoiceId: canvas.equation.selectedChoiceId,
    };
  }

  return {
    mode: canvas.mode,
    zones: canvas.zones.map((zone) => ({
      id: zone.id,
      label: zone.label,
      hint: zone.hint ?? null,
    })),
    tokens: canvas.tokens.map((token) => ({
      id: token.id,
      label: token.label,
      zoneId: token.zoneId,
    })),
  };
}

export function buildTutorCanvasStateContext(
  canvas: TutorCanvasState,
  canvasInteraction: TutorCanvasInteraction | null
): string {
  return JSON.stringify(
    canvasStateToContext(
      mergeTutorCanvasStateWithInteraction(canvas, canvasInteraction),
      canvasInteraction
    ),
    null,
    2
  );
}

function turnToFrame(turn: TutorTurn): Record<string, unknown> {
  return {
    actor: turn.actor,
    text: turn.text,
    canvasSummary: turn.canvasSummary ?? null,
    canvasInteraction:
      turn.canvasInteraction ?? parseTutorCanvasInteractionFromTranscript(turn.text),
  };
}

export function buildTutorRecentTurnFrames(
  turns: TutorTurn[],
  limit = 6
): string {
  return JSON.stringify(turns.slice(-limit).map(turnToFrame), null, 2);
}

export function buildTutorLatestLearnerTurnContext(args: {
  transcript: string;
  canvasInteraction: TutorCanvasInteraction | null;
  canvasEvidence?: TutorCanvasEvidence | null;
}): string {
  return JSON.stringify(
    {
      actor: 'user',
      text: args.transcript,
      canvasInteraction: args.canvasInteraction,
      canvasEvidenceSummary: args.canvasEvidence?.summary ?? null,
    },
    null,
    2
  );
}
