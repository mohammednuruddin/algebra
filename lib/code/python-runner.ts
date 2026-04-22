import type { PyodideInterface } from 'pyodide';

export interface PythonRunResult {
  status: 'success' | 'error';
  stdout: string;
  stderr: string;
}

const PYODIDE_VERSION = '0.29.3';
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`;

let pyodidePromise: Promise<PyodideInterface> | null = null;
let pyodideLoaderPromise: Promise<NonNullable<Window['loadPyodide']>> | null =
  null;
let executionQueue: Promise<void> = Promise.resolve();

declare global {
  interface Window {
    loadPyodide?: (options: {
      indexURL: string;
      fullStdLib: boolean;
    }) => Promise<PyodideInterface>;
  }
}

function readPromptInput() {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
    return null;
  }

  return window.prompt() ?? null;
}

function loadPyodideBridge() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(
      new Error('Python runtime is only available in the browser.')
    );
  }

  if (typeof window.loadPyodide === 'function') {
    return Promise.resolve(window.loadPyodide);
  }

  if (!pyodideLoaderPromise) {
    pyodideLoaderPromise = new Promise((resolve, reject) => {
      let settled = false;
      let script = document.querySelector<HTMLScriptElement>(
        'script[data-pyodide-runtime="true"]'
      );

      const cleanup = () => {
        script?.removeEventListener('load', handleLoad);
        script?.removeEventListener('error', handleError);
      };

      const resolveOnce = (loadPyodide: NonNullable<Window['loadPyodide']>) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve(loadPyodide);
      };

      const rejectOnce = (error: Error) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        pyodideLoaderPromise = null;
        reject(error);
      };

      const handleLoad = () => {
        if (typeof window.loadPyodide === 'function') {
          resolveOnce(window.loadPyodide);
          return;
        }

        rejectOnce(
          new Error('Python runtime loaded without exposing loadPyodide.')
        );
      };

      const handleError = () => {
        rejectOnce(new Error('Python runtime failed to load.'));
      };

      if (!script) {
        script = document.createElement('script');
        script.src = PYODIDE_SCRIPT_URL;
        script.async = true;
        script.dataset.pyodideRuntime = 'true';
        document.head.appendChild(script);
      }

      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });

      if (typeof window.loadPyodide === 'function') {
        queueMicrotask(handleLoad);
      }
    });
  }

  return pyodideLoaderPromise;
}

async function loadRuntime() {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodideBridge()
      .then((loadPyodide) =>
        loadPyodide({
          indexURL: PYODIDE_INDEX_URL,
          fullStdLib: false,
        })
      )
      .catch((error) => {
        pyodidePromise = null;
        throw error;
      });
  }

  return pyodidePromise;
}

function normalizeCapturedOutput(chunks: string[]) {
  return chunks.join('\n').replace(/\n+$/u, '');
}

async function executePython(code: string): Promise<PythonRunResult> {
  let pyodide: PyodideInterface;

  try {
    pyodide = await loadRuntime();
  } catch (error) {
    return {
      status: 'error',
      stdout: '',
      stderr:
        error instanceof Error
          ? error.message
          : 'Python runtime failed to load.',
    };
  }

  const stdout: string[] = [];
  const stderr: string[] = [];

  pyodide.setStdout({
    batched: (output) => {
      stdout.push(output);
    },
  });
  pyodide.setStderr({
    batched: (output) => {
      stderr.push(output);
    },
  });
  pyodide.setStdin({
    stdin: readPromptInput,
  });

  try {
    await pyodide.loadPackagesFromImports(code);

    const scope = pyodide.toPy({});
    let executionResult: unknown;

    try {
      executionResult = await pyodide.runPythonAsync(code, {
        globals: scope,
        locals: scope,
        filename: '<learner_code>',
      });
    } finally {
      scope.destroy();
    }

    const output = normalizeCapturedOutput(stdout);
    const errors = normalizeCapturedOutput(stderr);

    if (executionResult && typeof executionResult === 'object' && 'destroy' in executionResult && typeof executionResult.destroy === 'function') {
      executionResult.destroy();
    }

    return {
      status: 'success',
      stdout: output || 'No output.',
      stderr: errors,
    };
  } catch (error) {
    const capturedErrors = normalizeCapturedOutput(stderr);
    const message =
      error instanceof Error ? error.message : 'Python execution failed.';

    return {
      status: 'error',
      stdout: normalizeCapturedOutput(stdout),
      stderr: [capturedErrors, message].filter(Boolean).join('\n'),
    };
  } finally {
    pyodide.setStdout();
    pyodide.setStderr();
    pyodide.setStdin({
      stdin: readPromptInput,
    });
  }
}

export async function runPythonCode(code: string): Promise<PythonRunResult> {
  const nextExecution = executionQueue.then(async () => {
    return executePython(code);
  });

  executionQueue = nextExecution.then(
    () => undefined,
    () => undefined
  );

  return nextExecution;
}
