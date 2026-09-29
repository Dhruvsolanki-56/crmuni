import assert from 'node:assert/strict';
import test from 'node:test';
import { hasContactIdentity, resolveContact } from '../lib/contacts.ts';

type Row = { id: string } | undefined;

function fakeDatabase(rows: Row[]) {
  let call = 0;
  return {
    prepare() {
      const result = rows[call++];
      return {
        bind() {
          return {
            async first() {
              return result;
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

test('an exact email attaches a new event capture to the existing contact', async () => {
  const result = await resolveContact(fakeDatabase([{ id: 'contact-rajesh' }]), 'w1', {
    fullName: 'Rajesh Mehta',
    email: 'rajesh@abc.example',
    accountId: 'account-abc',
  });

  assert.deepEqual(result, {
    contactId: 'contact-rajesh',
    isNew: false,
    matchedOn: 'email',
    suggestedContactId: null,
    suggestedReason: null,
  });
});

test('same company and name is a suggestion, never a silent contact merge', async () => {
  // Email and phone find nothing. The third lookup finds an existing person
  // at the account, so the capture must retain a new contact ID and surface a
  // reviewable suggestion instead of attaching their histories together.
  const result = await resolveContact(
    fakeDatabase([undefined, undefined, { id: 'contact-existing-rajesh' }]),
    'w1',
    {
      fullName: 'Rajesh Mehta',
      email: 'new.rajesh@abc.example',
      phone: '+91 9000000000',
      accountId: 'account-abc',
    },
  );

  assert.equal(result.isNew, true);
  assert.equal(result.matchedOn, null);
  assert.equal(result.suggestedContactId, 'contact-existing-rajesh');
  assert.equal(result.suggestedReason, 'account_and_name');
  assert.notEqual(result.contactId, 'contact-existing-rajesh');
});

test('a company alone is an account encounter, not a fabricated contact', () => {
  assert.equal(hasContactIdentity({ fullName: '', email: '', phone: '' }), false);
  assert.equal(hasContactIdentity({ fullName: '  ' }), false);
  assert.equal(hasContactIdentity({ email: 'procurement@abc.example' }), true);
  assert.equal(hasContactIdentity({ phone: '+91 9000000000' }), true);
  assert.equal(hasContactIdentity({ fullName: 'Neha Shah' }), true);
});

test('an email that belongs to a merged contact resolves to the person it was merged into', async () => {
  // Lookup 1 finds the merged-away record; lookup 2 follows it to the survivor.
  const result = await resolveContact(
    fakeDatabase([
      { id: 'contact-source', mergedIntoId: 'contact-target' } as never,
      { id: 'contact-target' },
    ]),
    'w1',
    { fullName: 'Dana Dup', email: 'dana.two@dupco.test', accountId: 'account-dupco' },
  );
  assert.equal(result.contactId, 'contact-target');
  assert.equal(result.isNew, false);
  assert.equal(result.matchedOn, 'email');
});
