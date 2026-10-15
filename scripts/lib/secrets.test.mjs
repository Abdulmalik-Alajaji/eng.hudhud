import { describe, expect, it } from 'vitest';
import { findSecrets, isForbiddenFile } from './secrets.mjs';

// الأمثلة تُركّب وقت التشغيل حتى لا يبدو ملف الاختبار نفسه وكأنه يحوي سراً.
const fakeGithub = 'ghp_' + 'a1B2c3D4e5'.repeat(4);
const fakeAws = 'AKIA' + 'ABCDEFGHIJKLMNOP';
const fakeKey = '-----BEGIN ' + 'RSA PRIVATE KEY-----';

describe('findSecrets', () => {
  it('يكتشف رموز الدخول والمفاتيح مع رقم السطر', () => {
    const text = ['const a = 1;', `token = "${fakeGithub}"`, fakeAws, fakeKey].join('\n');
    const lines = findSecrets(text).map((f) => f.line);
    expect(lines).toEqual([2, 3, 4]);
  });

  it('لا ينذر على نص عادي', () => {
    expect(findSecrets('const room = "A-101"; // قاعة')).toEqual([]);
    expect(findSecrets('sha512-abc123XYZ== ghp_short')).toEqual([]);
  });
});

describe('isForbiddenFile', () => {
  it('يمنع ملفات الأسرار', () => {
    expect(isForbiddenFile('.env')).toBe(true);
    expect(isForbiddenFile('admin/.env.local')).toBe(true);
    expect(isForbiddenFile('certs/server.pem')).toBe(true);
  });

  it('يسمح بملف المثال وبالملفات العادية', () => {
    expect(isForbiddenFile('.env.example')).toBe(false);
    expect(isForbiddenFile('src/main.ts')).toBe(false);
  });
});
