export function retryDelayMs(attempts: number) {
  return Math.min(24 * 60 * 60 * 1000, 60_000 * 2 ** Math.max(0, attempts - 1));
}
