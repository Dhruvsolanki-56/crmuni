import assert from 'node:assert/strict';
import test from 'node:test';
import {
  captureRetryDelayMs,
  classifyCaptureResponse,
  nextCaptureRetry,
} from '../lib/offline-capture.ts';

test('offline capture retries use bounded exponential delay', () => {
  assert.equal(captureRetryDelayMs(1), 5_000);
  assert.equal(captureRetryDelayMs(4), 40_000);
  assert.equal(captureRetryDelayMs(20), 300_000);
  assert.deepEqual(nextCaptureRetry(2, 1_000, 'network unavailable'), {
    status: 'retrying',
    attempts: 3,
    lastAttemptAt: 1_000,
    nextAttemptAt: 21_000,
    lastError: 'network unavailable',
  });
});

test('offline capture responses distinguish retryable and reviewable failures', () => {
  assert.equal(classifyCaptureResponse(201), 'synced');
  assert.equal(classifyCaptureResponse(429), 'retry');
  assert.equal(classifyCaptureResponse(503), 'retry');
  assert.equal(classifyCaptureResponse(409), 'needs_review');
  assert.equal(classifyCaptureResponse(422), 'needs_review');
});
