export type OfflineRetryDisposition = 'synced' | 'retry' | 'needs_review';

export function captureRetryDelayMs(attempt: number) {
  const boundedAttempt = Math.max(1, Math.min(10, Math.floor(attempt)));
  return Math.min(5 * 60_000, 5_000 * 2 ** (boundedAttempt - 1));
}

export function classifyCaptureResponse(
  status: number,
): OfflineRetryDisposition {
  if (status >= 200 && status < 300) return 'synced';
  if ([408, 425, 429].includes(status) || status >= 500) return 'retry';
  return 'needs_review';
}

export function nextCaptureRetry(attempts: number, now: number, error: string) {
  const nextAttempts = Math.max(0, attempts) + 1;
  return {
    status: 'retrying' as const,
    attempts: nextAttempts,
    lastAttemptAt: now,
    nextAttemptAt: now + captureRetryDelayMs(nextAttempts),
    lastError: error.slice(0, 300),
  };
}
