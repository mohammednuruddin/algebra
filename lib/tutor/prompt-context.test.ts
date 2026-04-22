import { describe, expect, it } from 'vitest';

import {
  buildTutorCanvasStateContext,
  buildTutorLatestLearnerTurnContext,
  parseTutorCanvasInteractionFromTranscript,
} from './prompt-context';
import type { TutorCanvasState } from '@/lib/types/tutor';

function buildCanvas(overrides: Partial<TutorCanvasState> = {}): TutorCanvasState {
  return {
    mode: 'distribution',
    headline: 'Tutor workspace',
    instruction: 'Listen and respond.',
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
    ...overrides,
  };
}

describe('prompt-context code block execution context', () => {
  it('parses code-block execution payloads from transcript markers', () => {
    expect(
      parseTutorCanvasInteractionFromTranscript(
        '[Canvas interaction: code_block] {"code":"print(x)","execution":{"status":"error","stdout":"","stderr":"NameError"}}'
      )
    ).toEqual({
      mode: 'code_block',
      code: 'print(x)',
      execution: {
        status: 'error',
        stdout: '',
        stderr: 'NameError',
      },
    });
  });

  it('includes the latest code execution result in canvas state context and learner-turn context', () => {
    const canvasInteraction = {
      mode: 'code_block' as const,
      code: 'print("hi")',
      execution: {
        status: 'success' as const,
        stdout: 'hi',
        stderr: '',
      },
    };

    const canvasStateContext = buildTutorCanvasStateContext(
      buildCanvas({
        mode: 'code_block',
        codeBlock: {
          prompt: 'Write a print statement.',
          language: 'python',
          starterCode: 'print("hi")',
          userCode: '',
          expectedOutput: 'hi',
          submitted: false,
        },
      }),
      canvasInteraction
    );
    const latestLearnerTurnContext = buildTutorLatestLearnerTurnContext({
      transcript:
        '[Canvas interaction: code_block] {"code":"print(\\"hi\\")","execution":{"status":"success","stdout":"hi","stderr":""}}',
      canvasInteraction,
    });

    expect(canvasStateContext).toContain('"latestExecution"');
    expect(canvasStateContext).toContain('"status": "success"');
    expect(canvasStateContext).toContain('"stdout": "hi"');
    expect(latestLearnerTurnContext).toContain('"execution"');
    expect(latestLearnerTurnContext).toContain('"stderr": ""');
  });
});
