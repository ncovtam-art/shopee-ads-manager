import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPath } from '../src/lib/route-access.ts';

test('Only exact login/assets and Next internal paths bypass authentication', () => {
  for (const path of ['/login', '/favicon.ico', '/file.svg', '/_next/static/fixture.js'])
    assert.equal(isPublicPath(path), true);
});
test('Dynamic image/dotted paths and login-prefix lookalikes remain protected', () => {
  for (const path of ['/employees', '/api/create-user', '/pages/report.csv', '/pages/report.png', '/pages/report.svg', '/login-extra', '/api/auth-extra'])
    assert.equal(isPublicPath(path), false);
});
