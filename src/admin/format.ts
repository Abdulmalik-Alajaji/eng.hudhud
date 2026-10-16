/**
 * كتابة ملفات data/ بالتنسيق نفسه الموجود في المستودع: الكائن الذي قيمه بسيطة في سطر واحد
 * (نقطة، ممر، مكان، دكتور)، وغيره على أسطر. فيُظهر GitHub في طلب الدمج ما تغيّر فعلاً فقط.
 */

const isPrimitive = (value: unknown): boolean => value === null || typeof value !== 'object';

function format(value: unknown, indent: string): string {
  if (isPrimitive(value)) return JSON.stringify(value);
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every(isPrimitive)) return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
    return `[\n${value.map((v) => inner + format(v, inner)).join(',\n')}\n${indent}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '{}';
  if (entries.every(([, v]) => isPrimitive(v))) {
    return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`;
  }
  return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${format(v, inner)}`).join(',\n')}\n${indent}}`;
}

/** نص الملف كما يُحفظ في المستودع، بسطر فارغ في آخره. */
export function formatDataFile(value: unknown): string {
  return `${format(value, '')}\n`;
}
