import type { PyodideInterface } from 'pyodide';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type BrowserWindow = Window &
  typeof globalThis & {
    loadPyodide?: (options: {
      indexURL: string;
      fullStdLib: boolean;
    }) => Promise<unknown>;
  };

describe('runPythonCode', () => {
  const browserWindow = window as BrowserWindow;
  const originalLoadPyodide = browserWindow.loadPyodide;
  const originalPrompt = window.prompt;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    document.head.innerHTML = '';
    delete browserWindow.loadPyodide;
    window.prompt = vi.fn(() => 'Nuru');
  });

  afterEach(() => {
    document.head.innerHTML = '';
    window.prompt = originalPrompt;

    if (originalLoadPyodide) {
      browserWindow.loadPyodide = originalLoadPyodide;
    } else {
      delete browserWindow.loadPyodide;
    }
  });

  it('loads the browser pyodide bridge and wires stdin to prompt-backed input', async () => {
    let stdoutWriter: ((output: string) => void) | undefined;
    let stdinReader: (() => string | null | undefined) | undefined;

    const destroyScope = vi.fn();
    const destroyResult = vi.fn();
    const fakePyodide = {
      setStdout: vi.fn((options?: { batched?: (output: string) => void }) => {
        stdoutWriter = options?.batched;
      }),
      setStderr: vi.fn(),
      setStdin: vi.fn(
        (options?: { stdin?: () => string | null | undefined }) => {
          stdinReader = options?.stdin;
        }
      ),
      loadPackagesFromImports: vi.fn(async () => undefined),
      toPy: vi.fn(() => ({
        destroy: destroyScope,
      })),
      runPythonAsync: vi.fn(async () => {
        stdoutWriter?.(stdinReader?.() ?? '');
        return {
          destroy: destroyResult,
        };
      }),
    };

    const loadPyodide = vi.fn(
      async (options: { indexURL: string; fullStdLib: boolean }) => {
        void options;
        return fakePyodide as unknown as PyodideInterface;
      }
    );
    const appendChild = vi.spyOn(document.head, 'appendChild');
    appendChild.mockImplementation((node) => {
      const script = node as HTMLScriptElement;
      browserWindow.loadPyodide = loadPyodide;
      queueMicrotask(() => {
        script.dispatchEvent(new Event('load'));
      });
      return node;
    });

    const { runPythonCode } = await import('./python-runner');
    const result = await runPythonCode('name = input("What is your name? ")');

    expect(appendChild).toHaveBeenCalledTimes(1);
    const appendedScript = appendChild.mock.calls[0]?.[0] as HTMLScriptElement;
    expect(appendedScript.src).toBe(
      'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/pyodide.js'
    );
    expect(loadPyodide).toHaveBeenCalledWith(
      expect.objectContaining({
        fullStdLib: false,
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/',
      })
    );
    expect(fakePyodide.setStdin).toHaveBeenCalledWith(
      expect.objectContaining({
        stdin: expect.any(Function),
      })
    );
    expect(window.prompt).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'success',
      stdout: 'Nuru',
      stderr: '',
    });
    expect(destroyScope).toHaveBeenCalledTimes(1);
    expect(destroyResult).toHaveBeenCalledTimes(1);
  });
});
