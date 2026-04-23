type RetryOptions = {
  attempts?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, nextAttempt: number) => void;
};

export async function retryAsync<T>(
  operation: (attempt: number) => Promise<T> | T,
  options: RetryOptions = {}
): Promise<T> {
  const { attempts = 3, shouldRetry = () => true, onRetry } = options;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      const canRetry = attempt < attempts && shouldRetry(error, attempt);

      if (!canRetry) {
        throw error;
      }

      onRetry?.(error, attempt + 1);
    }
  }

  throw new Error('Retry operation exhausted unexpectedly');
}
