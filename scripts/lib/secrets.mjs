// أشكال المفاتيح ورموز الدخول المعروفة. أي تطابق يوقف الفحص.
export const SECRET_PATTERNS = [
  { name: 'رمز دخول GitHub', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/ },
  { name: 'رمز دخول GitHub (fine-grained)', re: /\bgithub_pat_[A-Za-z0-9_]{50,}/ },
  { name: 'مفتاح AWS', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'مفتاح Google API', re: /\bAIza[0-9A-Za-z_-]{35}/ },
  { name: 'رمز Slack', re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/ },
  { name: 'رمز npm', re: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { name: 'مفتاح Anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'مفتاح OpenAI', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}/ },
  { name: 'مفتاح Stripe', re: /\b[rs]k_live_[A-Za-z0-9]{20,}/ },
  { name: 'مفتاح خاص (Private key)', re: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/ },
];

// ملفات لا يجوز رفعها أصلاً مهما كان محتواها.
const FORBIDDEN_FILES = [
  /(^|\/)\.env(\..+)?$/,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/,
];
const ALLOWED_FILES = [/(^|\/)\.env\.example$/];

export function isForbiddenFile(path) {
  if (ALLOWED_FILES.some((re) => re.test(path))) return false;
  return FORBIDDEN_FILES.some((re) => re.test(path));
}

/** يعيد قائمة بالأسرار الموجودة في النص مع رقم السطر. */
export function findSecrets(text) {
  const found = [];
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    for (const { name, re } of SECRET_PATTERNS) {
      if (re.test(line)) found.push({ name, line: index + 1 });
    }
  });
  return found;
}
