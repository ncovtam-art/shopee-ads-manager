import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell } from '../src/lib/csv.ts';

test('CSV preserves quotes, commas, newlines and Vietnamese labels', () => {
  assert.equal(csvCell('Page "Tâm", nội bộ\nDòng 2'), '"Page ""Tâm"", nội bộ\nDòng 2"');
});
test('CSV neutralizes formulas including leading control characters', () => {
  for (const text of ['=1+1', '+cmd', '-cmd', '@SUM(A1)', '\t=cmd', ' \r\n+cmd'])
    assert(csvCell(text).startsWith('"\''));
});
test('CSV retains numeric losses and normal text as data', () => {
  assert.equal(csvCell(-123), '"-123"');
  assert.equal(csvCell('Minh Tâm'), '"Minh Tâm"');
});
