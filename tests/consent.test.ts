import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeContactIdentifier, suppressionIdentifier } from '../lib/consent.ts';

test('contact identifiers normalize consistently for suppression checks',()=>{
  assert.equal(normalizeContactIdentifier('email',' Person@Example.COM '),'person@example.com');
  assert.equal(normalizeContactIdentifier('whatsapp','+91 (98765) 43210'),'919876543210');
  assert.equal(normalizeContactIdentifier('whatsapp','123'),'');
});

test('suppression identifiers are deterministic hashes rather than contact data',async()=>{
  const first=await suppressionIdentifier('email','Person@example.com'); const second=await suppressionIdentifier('email',' person@EXAMPLE.com ');
  assert.equal(first,second); assert.equal(first.length,64); assert.equal(first.includes('person'),false);
});
