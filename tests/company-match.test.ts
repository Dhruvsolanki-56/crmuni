import assert from 'node:assert/strict';
import test from 'node:test';
import { companyMatchKey, normalizeCompany } from '../lib/accounts.ts';

test('legal-form variants of one company share a match key', () => {
  const keys = ['Acme Pvt Ltd', 'ACME Private Limited', 'Acme', 'The Acme Co.'].map(companyMatchKey);
  assert.deepEqual(new Set(keys), new Set(['acme']));
});

test('different companies never share a match key', () => {
  assert.notEqual(companyMatchKey('Acme Packaging'), companyMatchKey('Acme Pharma'));
  assert.notEqual(companyMatchKey('Pioneer Energy 142'), companyMatchKey('Pioneer Energy 143'));
});

test('a name made only of legal words keeps a distinct non-empty identity path', () => {
  assert.equal(companyMatchKey('Co Ltd'), '');
  assert.equal(normalizeCompany('Co Ltd'), 'co ltd');
});

import { accountIdentity } from '../lib/accounts.ts';

function fakeDb(existingId: string | null) {
  return {
    prepare: () => ({
      bind: () => ({ first: async () => (existingId ? { id: existingId } : null) }),
    }),
  } as unknown as D1Database;
}

test('an existing account keeps its own id instead of the derived one', async () => {
  const legacy = await accountIdentity('ws1', 'Pioneer Energy 142', fakeDb('e5e44043-legacy-uuid'));
  assert.equal(legacy.id, 'e5e44043-legacy-uuid');
  assert.equal(legacy.normalized, 'pioneer energy 142');
});

test('a new company gets the stable derived id, with or without a database', async () => {
  const withDb = await accountIdentity('ws1', 'Brand New Co', fakeDb(null));
  const without = await accountIdentity('ws1', 'Brand New Co');
  assert.equal(withDb.id, without.id);
  assert.match(withDb.id, /^acct_[0-9a-f]{24}$/);
});
