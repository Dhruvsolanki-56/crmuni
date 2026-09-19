import { performance } from 'node:perf_hooks';

const baseUrl = process.env.REVENUE_OS_BASE_URL || 'http://localhost:3000';
const requests = Number(process.env.REVENUE_OS_LOAD_REQUESTS || 60);
const concurrency = Number(process.env.REVENUE_OS_LOAD_CONCURRENCY || 6);
const paths = ['/api/workspace', '/api/events', '/api/reports'];
const timings = [];
let failures = 0;
let next = 0;

async function worker() {
  while (next < requests) {
    const index = next++;
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}${paths[index % paths.length]}`);
      if (!response.ok) failures += 1;
      await response.arrayBuffer();
    } catch {
      failures += 1;
    }
    timings.push(performance.now() - started);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
timings.sort((left, right) => left - right);
const percentile = (value) =>
  timings[
    Math.min(timings.length - 1, Math.ceil(timings.length * value) - 1)
  ] || 0;
const result = {
  baseUrl,
  requests,
  concurrency,
  failures,
  p50Ms: Math.round(percentile(0.5)),
  p95Ms: Math.round(percentile(0.95)),
  maxMs: Math.round(timings.at(-1) || 0),
};
console.log(JSON.stringify(result, null, 2));
if (failures) process.exitCode = 1;
