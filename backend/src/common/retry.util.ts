import { Logger } from '@nestjs/common';

const logger = new Logger('withRetry');

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  label?: string;
}

/** True for network errors, 429, and 5xx — the classes of failure worth retrying. */
function isRetryable(error: any): boolean {
  if (!error.response) return true; // network/timeout error, no HTTP response at all
  const status = error.response.status;
  return status === 429 || status >= 500;
}

function retryDelayMs(
  error: any,
  attempt: number,
  baseDelayMs: number,
): number {
  const retryAfter = error.response?.headers?.['retry-after'];
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  const exponential = baseDelayMs * 2 ** attempt;
  const jitter = Math.random() * baseDelayMs;
  return exponential + jitter;
}

/**
 * Retries an async operation with exponential backoff + jitter.
 * Only retries network errors, 429s, and 5xx — 4xx auth/validation errors fail immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { attempts = 3, baseDelayMs = 500, label = 'operation' } = options;

  let lastError: any;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === attempts - 1;
      if (isLastAttempt || !isRetryable(error)) {
        throw error;
      }
      const delay = retryDelayMs(error, attempt, baseDelayMs);
      logger.warn(
        `${label} failed (attempt ${attempt + 1}/${attempts}): ${error.message}. Retrying in ${Math.round(delay)}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
