import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const expectedLines = [
  'API_PREFIX=api/v1',
  'NEXT_PUBLIC_API_URL=http://localhost:4000',
  'EXPO_PUBLIC_API_URL=http://localhost:4000',
];

function assertRawDeclarations(content) {
  const lines = content.split(/\r\n|\r|\n/);
  // Validate raw declarations before constructing any key/value object.
  for (const expected of expectedLines) {
    const prefix = expected.slice(0, expected.indexOf('=') + 1);
    const declarations = lines.filter((line) => line.startsWith(prefix));
    assert.equal(declarations.length, 1, prefix + ' must occur exactly once');
    assert.equal(declarations[0], expected);
  }
  for (const key of ['NEXT_PUBLIC_API_URL', 'EXPO_PUBLIC_API_URL']) {
    assert.equal(lines.includes(key + '=http://localhost:4000/api/v1'), false);
  }
  return Object.fromEntries(expectedLines.map((expected) => {
    const separator = expected.indexOf('=');
    const actual = lines.find((line) => line.startsWith(expected.slice(0, separator + 1)));
    return [actual.slice(0, separator), actual.slice(separator + 1)];
  }));
}

describe('Environment template raw declarations', () => {
  it('requires unique exact declarations and composes each health URL without duplicate prefix', () => {
    const content = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    const env = assertRawDeclarations(content);
    for (const key of ['NEXT_PUBLIC_API_URL', 'EXPO_PUBLIC_API_URL']) {
      const combined = env[key] + '/api/v1/health';
      assert.equal(combined, 'http://localhost:4000/api/v1/health');
      assert.notEqual(combined, 'http://localhost:4000/api/v1/api/v1/health');
    }
  });

  for (const expected of expectedLines) {
    const key = expected.slice(0, expected.indexOf('='));
    it(key + ': rejects missing, incorrect, and duplicate raw declarations', () => {
      const others = expectedLines.filter((line) => line !== expected);
      assert.throws(() => assertRawDeclarations(others.join('\n')));
      assert.throws(() => assertRawDeclarations([...others, expected + '/wrong'].join('\n')));
      assert.throws(() => assertRawDeclarations([...expectedLines, expected].join('\n')));
    });
  }

  for (const key of ['NEXT_PUBLIC_API_URL', 'EXPO_PUBLIC_API_URL']) {
    it(key + ': rejects a correct declaration appended after an obsolete declaration', () => {
      const obsolete = key + '=http://localhost:4000/api/v1';
      const correct = key + '=http://localhost:4000';
      const fixture = [...expectedLines.filter((line) => line !== correct), obsolete, correct];
      assert.throws(() => assertRawDeclarations(fixture.join('\n')));
    });
  }
});
