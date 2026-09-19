import assert from 'node:assert/strict';
import test from 'node:test';
import { qualificationStateForScore } from '../lib/qualification.ts';

test('qualification score thresholds are explicit and stable',()=>{
  assert.equal(qualificationStateForScore(100),'hot'); assert.equal(qualificationStateForScore(80),'hot');
  assert.equal(qualificationStateForScore(79),'warm'); assert.equal(qualificationStateForScore(60),'warm');
  assert.equal(qualificationStateForScore(59),'cold'); assert.equal(qualificationStateForScore(30),'cold');
  assert.equal(qualificationStateForScore(29),'unqualified'); assert.equal(qualificationStateForScore(0),'unqualified');
});
