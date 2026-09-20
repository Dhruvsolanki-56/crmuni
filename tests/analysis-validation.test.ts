import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groundConversationAnalysis,
  validateConversationAnalysis,
} from '../lib/analysis-validation.ts';

const valid = {
  summary: 'Customer needs machine monitoring.',
  fields: [
    {
      key: 'requirement',
      label: 'Requirement',
      value: 'machine monitoring',
      confidence: 0.9,
      evidence: 'needs machine monitoring',
    },
  ],
  commitments: [
    {
      title: 'Send architecture',
      due_date: '2026-09-22',
      owner_party: 'salesperson',
      confidence: 0.9,
      evidence: 'send the architecture Tuesday',
    },
  ],
  score: { value: 80, rationale: 'Clear need.' },
  risks: [],
};

test('analysis validation rejects malformed provider output', () => {
  assert.equal(validateConversationAnalysis(null), null);
  assert.equal(
    validateConversationAnalysis({ ...valid, fields: 'wrong' }),
    null,
  );
  assert.equal(
    validateConversationAnalysis({
      ...valid,
      fields: [{ ...valid.fields[0], confidence: 9 }],
    }),
    null,
  );
  assert.equal(
    validateConversationAnalysis({ ...valid, score: { value: 101 } }),
    null,
  );
});

test('grounding removes facts and commitments without exact source evidence', () => {
  const parsed = validateConversationAnalysis(valid);
  assert.ok(parsed);
  const grounded = groundConversationAnalysis(
    parsed,
    'Raj says the team needs machine monitoring. No promises were made.',
  );
  assert.equal(grounded.fields[0].value, 'machine monitoring');
  assert.equal(grounded.commitments.length, 0);
  const unsupported = groundConversationAnalysis(
    parsed,
    'The customer asked for a general product overview.',
  );
  assert.equal(unsupported.fields[0].value, null);
  assert.equal(unsupported.fields[0].confidence, 0);
});
