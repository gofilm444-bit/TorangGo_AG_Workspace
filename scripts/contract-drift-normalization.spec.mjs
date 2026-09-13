import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeComparableText } from './contract-drift-check.mjs';

describe('Contract comparison newline normalization', () => {
  const fixtures = [
    ['OpenAPI', '{\n  "openapi": "3.0.0",\n  "paths": {}\n}\n'],
    ['TypeScript schema', 'export interface paths {\n  "/health": unknown;\n}\n'],
  ];

  for (const [name, lf] of fixtures) {
    it(`${name}: treats LF and CRLF as equal`, () => {
      assert.equal(normalizeComparableText(lf.replace(/\n/g, '\r\n')), normalizeComparableText(lf));
    });

    it(`${name}: treats LF and CR as equal`, () => {
      assert.equal(normalizeComparableText(lf.replace(/\n/g, '\r')), normalizeComparableText(lf));
    });

    it(`${name}: preserves real content drift after normalization`, () => {
      const changed = lf.replace(/\n/g, '\r\n') + '// real change\r\n';
      assert.notEqual(normalizeComparableText(changed), normalizeComparableText(lf));
    });

    it(`${name}: preserves existing trim semantics for trailing newlines`, () => {
      for (const ending of ['', '\n', '\r\n', '\r', '\r\n\n\r']) {
        assert.equal(normalizeComparableText(lf.trim() + ending), lf.trim());
      }
      assert.equal(normalizeComparableText(' \t\r\n' + lf + '\t '), lf.trim());
    });
  }

  it('normalizes mixed line endings', () => {
    assert.equal(normalizeComparableText('a\r\nb\rc\nd'), 'a\nb\nc\nd');
  });

  it('does not ignore internal whitespace or ordering differences', () => {
    for (const changed of ['a\n b', 'a\n\nb', 'b\na']) {
      assert.notEqual(normalizeComparableText(changed), normalizeComparableText('a\r\nb'));
    }
    assert.notEqual(normalizeComparableText('{"a":1,"b":2}'), normalizeComparableText('{"b":2,"a":1}'));
    assert.notEqual(normalizeComparableText('[1,2]'), normalizeComparableText('[2,1]'));
  });
});
