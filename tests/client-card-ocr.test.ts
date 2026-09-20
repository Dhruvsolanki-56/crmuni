import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractContactCandidates,
  extractEncodedContact,
  mergeContactCandidates,
} from '../lib/client-card-ocr.ts';

test('card OCR candidates extract common contact fields without inventing values', () => {
  assert.deepEqual(
    extractContactCandidates(`
      MAYA KAPOOR
      Procurement Director
      ACME PHARMA LTD
      maya.kapoor@example.com
      +91 98765 43210
    `),
    {
      fullName: 'Maya Kapoor',
      company: 'Acme Pharma Ltd',
      role: 'Procurement Director',
      email: 'maya.kapoor@example.com',
      phone: '+91 98765 43210',
    },
  );
});

test('vCard QR data takes priority while OCR fills missing fields', () => {
  const qr = extractEncodedContact(`BEGIN:VCARD\nVERSION:3.0\nFN:Viya Anderson\nORG:Viya for Google\nEMAIL:viya@example.com\nTEL:+15550129\nEND:VCARD`);
  const combined = mergeContactCandidates(
    qr,
    extractContactCandidates('Viya Anderson\nFounder\nViya for Google'),
  );
  assert.deepEqual(combined, {
    fullName: 'Viya Anderson',
    company: 'Viya for Google',
    role: 'Founder',
    email: 'viya@example.com',
    phone: '+15550129',
  });
});

test('card OCR candidates leave absent details blank', () => {
  assert.deepEqual(extractContactCandidates('VISIT OUR BOOTH\nwww.example.com'), {
    fullName: '',
    company: '',
    role: '',
    email: '',
    phone: '',
  });
});
