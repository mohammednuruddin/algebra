'use client';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TutorCanvasHost } from './tutor-canvas-host';
import type { TutorCanvasState } from '@/lib/types/tutor';

const mockRunPythonCode = vi.fn();

const mockDrawingCanvas = vi.fn(
  ({
    onSnapshot,
    disabled,
  }: {
    onSnapshot?: (dataUrl: string) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="drawing-canvas">
      <div data-testid="drawing-disabled">{String(Boolean(disabled))}</div>
      <button type="button" onClick={() => onSnapshot?.('data:image/png;base64,mark')}>
        Snapshot
      </button>
    </div>
  )
);

vi.mock('@/components/lesson/drawing-canvas', () => ({
  DrawingCanvas: (props: { onSnapshot?: (dataUrl: string) => void }) => mockDrawingCanvas(props),
}));

vi.mock('@/components/tutor/tutor-code-editor', () => ({
  TutorCodeEditor: ({
    value,
    disabled,
    onChange,
  }: {
    value: string;
    disabled?: boolean;
    onChange: (value: string) => void;
  }) => (
    <textarea
      data-testid="code-editor"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock('@/lib/code/python-runner', () => ({
  runPythonCode: (code: string) => mockRunPythonCode(code),
}));

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
    ...overrides,
  };
}

describe('TutorCanvasHost drawing mode', () => {
  it('uses the shared drawing canvas toolset and forwards snapshots', () => {
    const onCanvasSubmit = vi.fn();

    render(
      <TutorCanvasHost
        canvas={buildCanvas({
          mode: 'drawing',
          drawing: {
            prompt: 'Mark the anther.',
            backgroundImageUrl: 'https://example.com/flower.png',
            canvasWidth: 800,
            canvasHeight: 600,
            brushColor: '#000000',
            brushSize: 3,
            submitted: false,
          },
        })}
        onMoveToken={vi.fn()}
        onChooseEquationAnswer={vi.fn()}
        onCanvasSubmit={onCanvasSubmit}
      />
    );

    expect(screen.getByTestId('drawing-canvas')).toBeInTheDocument();
    expect(mockDrawingCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 800,
        height: 600,
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /snapshot/i }));

    expect(onCanvasSubmit).toHaveBeenCalledWith(
      'drawing',
      expect.objectContaining({
        dataUrl: 'data:image/png;base64,mark',
        canvasWidth: 800,
        canvasHeight: 600,
      })
    );
  });

  it('unlocks a repeated drawing task when the scene revision changes', () => {
    const onCanvasSubmit = vi.fn();

    const { rerender } = render(
      <TutorCanvasHost
        canvas={buildCanvas({
          mode: 'drawing',
          drawing: {
            prompt: 'Circle the shoot.',
            backgroundImageUrl: 'https://example.com/seed.png',
            canvasWidth: 800,
            canvasHeight: 600,
            brushColor: '#ff3b30',
            brushSize: 3,
            submitted: false,
            sceneRevision: 1,
          },
        })}
        onMoveToken={vi.fn()}
        onChooseEquationAnswer={vi.fn()}
        onCanvasSubmit={onCanvasSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /snapshot/i }));

    expect(screen.getByTestId('drawing-disabled')).toHaveTextContent('true');

    rerender(
      <TutorCanvasHost
        canvas={buildCanvas({
          mode: 'drawing',
          drawing: {
            prompt: 'Circle the shoot.',
            backgroundImageUrl: 'https://example.com/seed.png',
            canvasWidth: 800,
            canvasHeight: 600,
            brushColor: '#ff3b30',
            brushSize: 3,
            submitted: false,
            sceneRevision: 2,
          },
        })}
        onMoveToken={vi.fn()}
        onChooseEquationAnswer={vi.fn()}
        onCanvasSubmit={onCanvasSubmit}
      />
    );

    expect(screen.getByTestId('drawing-disabled')).toHaveTextContent('false');
  });

  it('unlocks a kept drawing task when a new tutor speech turn arrives', () => {
    const onCanvasSubmit = vi.fn();

    const { rerender } = render(
      <TutorCanvasHost
        speechRevision={1}
        canvas={buildCanvas({
          mode: 'drawing',
          drawing: {
            prompt: 'Circle the shoot.',
            backgroundImageUrl: 'https://example.com/seed.png',
            canvasWidth: 800,
            canvasHeight: 600,
            brushColor: '#ff3b30',
            brushSize: 3,
            submitted: false,
            sceneRevision: 1,
          },
        })}
        onMoveToken={vi.fn()}
        onChooseEquationAnswer={vi.fn()}
        onCanvasSubmit={onCanvasSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /snapshot/i }));

    expect(screen.getByTestId('drawing-disabled')).toHaveTextContent('true');

    rerender(
      <TutorCanvasHost
        speechRevision={2}
        canvas={buildCanvas({
          mode: 'drawing',
          drawing: {
            prompt: 'Circle the shoot.',
            backgroundImageUrl: 'https://example.com/seed.png',
            canvasWidth: 800,
            canvasHeight: 600,
            brushColor: '#ff3b30',
            brushSize: 3,
            submitted: false,
            sceneRevision: 1,
          },
        })}
        onMoveToken={vi.fn()}
        onChooseEquationAnswer={vi.fn()}
        onCanvasSubmit={onCanvasSubmit}
      />
    );

    expect(screen.getByTestId('drawing-disabled')).toHaveTextContent('false');
  });
});

describe('TutorCanvasHost new live tutor canvases', () => {
  it('shows shared tokens alongside part-whole builder tasks', () => {
    render(
      <TutorCanvasHost
        canvas={buildCanvas({
          mode: 'part_whole_builder',
          tokens: [
            { id: 'red-1', label: 'Red', color: '#e74c3c', zoneId: null },
            { id: 'blue-1', label: 'Blue', color: '#3498db', zoneId: null },
          ],
          partWholeBuilder: {
            prompt: 'Show the more likely color.',
            totalParts: 5,
            filledParts: 0,
            correctFilledParts: 3,
            label: 'Red marbles (3) vs Blue marbles (2)',
            submitted: false,
          },
        })}
        onMoveToken={vi.fn()}
        onChooseEquationAnswer={vi.fn()}
        onCanvasSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();
  });

  it('submits hotspot selections from image hotspot mode', () => {
    const onCanvasSubmit = vi.fn();

    render(
      <TutorCanvasHost
        canvas={buildCanvas({
          mode: 'image_hotspot',
          imageHotspot: {
            prompt: 'Tap the nucleus.',
            backgroundImageUrl: 'https://example.com/cell.png',
            hotspots: [{ id: 'nucleus', label: 'Nucleus', x: 40, y: 40, radius: 12 }],
            selectedHotspotIds: [],
            submitted: false,
            allowMultiple: false,
          },
        })}
        onMoveToken={vi.fn()}
        onChooseEquationAnswer={vi.fn()}
        onCanvasSubmit={onCanvasSubmit}
      />
    );

    expect(screen.getByRole('img', { name: /tap the nucleus/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /nucleus/i }));
    fireEvent.click(screen.getByRole('button', { name: /submit hotspot/i }));

    expect(onCanvasSubmit).toHaveBeenCalledWith(
      'image_hotspot',
      expect.objectContaining({
        selectedHotspotIds: ['nucleus'],
      })
    );
  });

  it('submits timeline order from timeline mode', () => {
    const onCanvasSubmit = vi.fn();

    render(
      <TutorCanvasHost
        canvas={buildCanvas({
          mode: 'timeline',
          timeline: {
            prompt: 'Place the events in order.',
            items: [
              { id: 'event-1', label: 'Seed planted', correctPosition: 0 },
              { id: 'event-2', label: 'Shoot grows', correctPosition: 1 },
            ],
            userOrder: ['event-1', 'event-2'],
            submitted: false,
          },
        })}
        onMoveToken={vi.fn()}
        onChooseEquationAnswer={vi.fn()}
        onCanvasSubmit={onCanvasSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /check timeline/i }));

    expect(onCanvasSubmit).toHaveBeenCalledWith(
      'timeline',
      expect.objectContaining({
        userOrder: ['event-1', 'event-2'],
      })
    );
  });
});

describe('TutorCanvasHost code block mode', () => {
  it('shows real execution output for the current run and clears it for a new task', async () => {
    const onCodeSubmit = vi.fn();
    mockRunPythonCode.mockResolvedValue({
      status: 'success',
      stdout: 'hi',
      stderr: '',
    });

    const { rerender } = render(
      <TutorCanvasHost
        canvas={buildCanvas({
          mode: 'code_block',
          codeBlock: {
            prompt: 'Write a print statement.',
            language: 'python',
            starterCode: 'print("hi")',
            userCode: 'print("hi")',
            expectedOutput: 'hi',
            submitted: false,
          },
        })}
        onMoveToken={vi.fn()}
        onChooseEquationAnswer={vi.fn()}
        onCodeSubmit={onCodeSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /run code/i }));

    await waitFor(() => {
      expect(onCodeSubmit).toHaveBeenCalledWith('print("hi")', {
        status: 'success',
        stdout: 'hi',
        stderr: '',
      });
    });
    expect(screen.getByRole('button', { name: /run again/i })).toBeInTheDocument();
    expect(screen.getByText(/^output$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^hi$/i)).toHaveLength(2);

    rerender(
      <TutorCanvasHost
        canvas={buildCanvas({
          mode: 'code_block',
          codeBlock: {
            prompt: 'Write a different print statement.',
            language: 'python',
            starterCode: 'print("bye")',
            userCode: 'print("bye")',
            expectedOutput: 'bye',
            submitted: false,
          },
        })}
        onMoveToken={vi.fn()}
        onChooseEquationAnswer={vi.fn()}
        onCodeSubmit={onCodeSubmit}
      />
    );

    expect(screen.getByRole('button', { name: /run code/i })).toBeInTheDocument();
    expect(screen.queryByText(/^output$/i)).not.toBeInTheDocument();
  });

  it('keeps edited learner code on the same task and submits it again', async () => {
    const user = userEvent.setup();
    const onCodeSubmit = vi.fn();
    mockRunPythonCode.mockResolvedValue({
      status: 'success',
      stdout: '16',
      stderr: '',
    });

    render(
      <TutorCanvasHost
        canvas={buildCanvas({
          mode: 'code_block',
          codeBlock: {
            prompt: 'Square the number.',
            language: 'python',
            starterCode: 'n = 4',
            userCode: 'n = 4',
            expectedOutput: '16',
            submitted: false,
          },
        })}
        onMoveToken={vi.fn()}
        onChooseEquationAnswer={vi.fn()}
        onCodeSubmit={onCodeSubmit}
      />
    );

    const editor = screen.getByRole('textbox');
    await user.click(editor);
    await user.type(editor, '{End}{Enter}print(n * n)');
    await user.click(screen.getByRole('button', { name: /run code/i }));
    await waitFor(() => {
      expect(screen.getByText(/^output$/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /run again/i }));

    expect(onCodeSubmit).toHaveBeenLastCalledWith('n = 4\nprint(n * n)', {
      status: 'success',
      stdout: '16',
      stderr: '',
    });
    expect(mockRunPythonCode).toHaveBeenLastCalledWith('n = 4\nprint(n * n)');
    expect(screen.getAllByText(/^16$/i)).toHaveLength(2);
  });

  it('strips pure instructional starter comments from the editable code surface', () => {
    render(
      <TutorCanvasHost
        canvas={buildCanvas({
          mode: 'code_block',
          codeBlock: {
            prompt: 'Type your math below.',
            language: 'python',
            starterCode: '# Type your math here and press Enter',
            userCode: '# Type your math here and press Enter',
            submitted: false,
          },
        })}
        onMoveToken={vi.fn()}
        onChooseEquationAnswer={vi.fn()}
        onCodeSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Type your math below.')).toBeInTheDocument();
    expect(screen.queryByText(/Type your math here and press Enter/i)).not.toBeInTheDocument();
  });

  it('shows python runtime errors in an error panel', async () => {
    const onCodeSubmit = vi.fn();
    mockRunPythonCode.mockResolvedValue({
      status: 'error',
      stdout: '',
      stderr: 'NameError: name x is not defined',
    });

    render(
      <TutorCanvasHost
        canvas={buildCanvas({
          mode: 'code_block',
          codeBlock: {
            prompt: 'Run the broken code.',
            language: 'python',
            starterCode: 'print(x)',
            userCode: 'print(x)',
            submitted: false,
          },
        })}
        onMoveToken={vi.fn()}
        onChooseEquationAnswer={vi.fn()}
        onCodeSubmit={onCodeSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /run code/i }));

    await waitFor(() => {
      expect(screen.getByText(/^error$/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/nameerror: name x is not defined/i)).toBeInTheDocument();
    expect(onCodeSubmit).toHaveBeenCalledWith('print(x)', {
      status: 'error',
      stdout: '',
      stderr: 'NameError: name x is not defined',
    });
  });
});
