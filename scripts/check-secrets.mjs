// يفحص كل ملفات المستودع (المرفوعة والجديدة غير المستثناة) بحثاً عن أسرار.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { findSecrets, isForbiddenFile } from './lib/secrets.mjs';

const MAX_SCAN_BYTES = 2 * 1024 * 1024;

const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);

const problems = [];

for (const file of files) {
  if (isForbiddenFile(file)) {
    problems.push(`${file}: ملف أسرار لا يجوز رفعه`);
    continue;
  }
  let stats;
  try {
    stats = statSync(file);
  } catch {
    continue; // ملف محذوف من القرص ولم يُحذف من git بعد
  }
  if (!stats.isFile() || stats.size > MAX_SCAN_BYTES) continue;
  const buffer = readFileSync(file);
  if (buffer.subarray(0, 8000).includes(0)) continue; // ملف ثنائي (صورة أو خط)
  for (const { name, line } of findSecrets(buffer.toString('utf8'))) {
    problems.push(`${file}:${line}: يبدو أنه ${name}`);
  }
}

if (problems.length > 0) {
  console.error('✗ فحص الأسرار فشل:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('احذف السر من الملف، وإن كان قد رُفع سابقاً فألغِه من الجهة التي أصدرته فوراً.');
  process.exit(1);
}

console.log(`✓ فحص الأسرار: لا أسرار في ${files.length} ملف.`);
