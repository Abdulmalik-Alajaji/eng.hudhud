import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatDataFile } from './format';

const DATA = resolve(import.meta.dirname, '../../data');
const files = [
  ...readdirSync(DATA).filter((f) => f.endsWith('.json')),
  ...readdirSync(resolve(DATA, 'floors')).map((f) => `floors/${f}`),
];

describe('formatDataFile', () => {
  it.each(files)('يعيد data/%s حرفاً بحرف', (file) => {
    const text = readFileSync(resolve(DATA, file), 'utf8');
    expect(formatDataFile(JSON.parse(text))).toBe(text);
  });

  it('القوائم الفارغة والقيم البسيطة', () => {
    expect(formatDataFile({ a: [], b: null, c: [1, 'x'] })).toBe('{\n  "a": [],\n  "b": null,\n  "c": [1, "x"]\n}\n');
    expect(formatDataFile({ a: 1, b: undefined })).toBe('{ "a": 1 }\n');
  });
});
