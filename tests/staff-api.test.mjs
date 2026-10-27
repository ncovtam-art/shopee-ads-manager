import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleCreateUser } from '../src/lib/create-user-handler.ts';

const origin = 'https://fixture.example';
const input = { email: 'Staff@fixture.example', password: 'fixture-password-123', name: 'Staff', role: 'EMPLOYEE' };
function fixture(options = {}) {
  const calls = [];
  const deps = {
    configurationReady: true,
    resolveActor: async () => ({ id: 'actor', role: 'ADMIN', status: 'ACTIVE' }),
    createAccount: async value => { calls.push(['create', value]); return 'new-account'; },
    updateProfile: async id => { calls.push(['profile', id]); return true; },
    removeNewAccount: async id => { calls.push(['cleanup', id]); return true; },
    ...options,
  };
  const request = (body = input, headers = {}) => new Request(origin + '/api/create-user', {
    method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { deps, calls, request };
}

test('Administrator creates a staff account only after confirmed profile update', async () => {
  const f = fixture();
  const response = await handleCreateUser(f.request(), f.deps, origin);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, userId: 'new-account' });
  assert.deepEqual(f.calls.map(c => c[0]), ['create', 'profile']);
  assert.equal(f.calls[0][1].email, 'staff@fixture.example');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

for (const role of ['LEADER', 'ADMIN']) test(`Leader cannot grant ${role}`, async () => {
  const f = fixture({ resolveActor: async () => ({ id: 'leader', role: 'LEADER', status: 'ACTIVE' }) });
  assert.equal((await handleCreateUser(f.request({ ...input, role }), f.deps, origin)).status, 403);
  assert.equal(f.calls.length, 0);
});

test('Leader can create EMPLOYEE', async () => {
  const f = fixture({ resolveActor: async () => ({ id: 'leader', role: 'LEADER', status: 'ACTIVE' }) });
  assert.equal((await handleCreateUser(f.request(), f.deps, origin)).status, 200);
});

for (const [label, actor, status] of [
  ['anonymous', null, 401], ['employee', { id: 'employee', role: 'EMPLOYEE', status: 'ACTIVE' }, 403],
  ['inactive admin', { id: 'admin', role: 'ADMIN', status: 'INACTIVE' }, 403],
  ['suspended leader', { id: 'leader', role: 'LEADER', status: 'SUSPENDED' }, 403],
]) test(`${label} cannot create staff`, async () => {
  const f = fixture({ resolveActor: async () => actor });
  assert.equal((await handleCreateUser(f.request(), f.deps, origin)).status, status);
  assert.equal(f.calls.length, 0);
});

for (const value of ['https://attacker.example', 'null', '']) test(`Origin rejected: ${value || 'missing'}`, async () => {
  const f = fixture();
  const req = f.request(input, { origin: value });
  if (!value) req.headers.delete('origin');
  assert.equal((await handleCreateUser(req, f.deps, origin)).status, 403);
  assert.equal(f.calls.length, 0);
});

test('Missing/noncanonical server Origin fails closed', async () => {
  for (const configured of [undefined, origin + '/', 'invalid', 'http://public.example']) {
    const f = fixture();
    assert.equal((await handleCreateUser(f.request(), f.deps, configured)).status, 503);
    assert.equal(f.calls.length, 0);
  }
});

for (const [label, body] of [
  ['malformed JSON', '{'], ['array', []], ['empty', {}], ['weak password', { ...input, password: 'short' }],
  ['extra privilege field', { ...input, status: 'ACTIVE' }], ['unknown role', { ...input, role: 'OWNER' }],
  ['invalid email', { ...input, email: 'not-email' }], ['long phone', { ...input, phone: '1'.repeat(33) }],
  ['array role', { ...input, role: ['ADMIN'] }],
]) test(`Invalid input rejected: ${label}`, async () => {
  const f = fixture();
  assert.equal((await handleCreateUser(f.request(body), f.deps, origin)).status, 400);
  assert.equal(f.calls.length, 0);
});

test('Oversized body is rejected without trusting Content-Length', async () => {
  const f = fixture();
  assert.equal((await handleCreateUser(f.request({ ...input, name: 'x'.repeat(9000) }), f.deps, origin)).status, 413);
  assert.equal(f.calls.length, 0);
});

test('Wrong content type is rejected', async () => {
  const f = fixture();
  assert.equal((await handleCreateUser(f.request(input, { 'content-type': 'text/plain' }), f.deps, origin)).status, 415);
});

test('Missing privileged configuration never falls back to public signup', async () => {
  const f = fixture({ configurationReady: false });
  assert.equal((await handleCreateUser(f.request(), f.deps, origin)).status, 503);
  assert.equal(f.calls.length, 0);
});

test('Failed profile update cleans up only the newly created account and never reports success', async () => {
  const f = fixture({ updateProfile: async () => false });
  const response = await handleCreateUser(f.request(), f.deps, origin);
  assert.equal(response.status, 503);
  assert.deepEqual(f.calls.map(c => c[0]), ['create', 'cleanup']);
  assert.equal(f.calls[1][1], 'new-account');
  assert.equal((await response.json()).success, undefined);
});

test('Upstream exceptions and failed cleanup do not disclose credentials or claim success', async () => {
  const secret = 'fixture-private-upstream-token';
  for (const options of [
    { createAccount: async () => { throw Error(secret); } },
    { updateProfile: async () => { throw Error(secret); }, removeNewAccount: async () => { throw Error(secret); } },
  ]) {
    const f = fixture(options);
    const response = await handleCreateUser(f.request(), f.deps, origin);
    assert(response.status >= 500);
    const body = await response.text();
    assert(!body.includes(secret));
    assert(!body.includes(input.password));
    assert(!body.includes('"success":true'));
  }
});
