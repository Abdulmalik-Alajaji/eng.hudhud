/**
 * ألوان الهدهد وصواعقه كمتغيرات CSS تتبدل مع المظهر. hudhud.ts يقرؤها من الصفحة، فأي عنصر
 * (أو المظهر كله تحت [data-theme]) يغيّرها بتعريف المتغيرات نفسها.
 *
 * الداكن (الهوية المعتمدة) هو القيم الافتراضية هنا، وهي القيم نفسها التي كانت مكتوبة في الكود،
 * فلا يتغير شكله. ألوان أجزاء الهدهد والخطوط اختيارية: إن لم تُعرَّف فالهدهد كله بلون --hudhud-color.
 */
import type { PartName } from './rig';

export interface HudhudPalette {
  /** لون الهدهد (وكل جزء لم يُحدَّد له لون). */
  bird: string;
  /** لون جزء بعينه، إن اختلف عن bird. */
  parts?: Partial<Record<PartName, string>>;
  /** خطوط عرضية على الذيل (مثل ذيل الهدهد الحقيقي)، أو لا شيء. */
  stripes?: string;
  /** قلب الصاعقة. */
  bolt: string;
  /** أنصع لون في الصاعقة: الإطار الخارجي والقلب الرفيع ومركز التوهج. */
  halo: string;
  /** الطبقة الوسطى من الصاعقة. */
  haze: string;
  /** حلقة التوهج عند نقطة الضربة. */
  glow: string;
  /** الوميض حول الهدهد. */
  ambient: string;
  /** الشرارات «البيضاء» (والبقية بلون bolt). */
  spark: string;
  /** اللون الذي يميل إليه الهدهد لحظة الضربة (بنسبة STRIKE_LIGHT كحد أقصى). */
  lit: string;
}

/** أقصى ميل للون الهدهد نحو palette.lit لحظة الضربة. */
export const STRIKE_LIGHT = 0.3;

/** الداكن المعتمد: أزرق سماوي، وصواعق زرقاء بتوهج أبيض، وشرر أبيض. */
export const DARK_PALETTE: HudhudPalette = {
  bird: '#4fc3f7',
  bolt: '#4d9dff',
  halo: '#ffffff',
  haze: '#a0cdff',
  glow: '#aad2ff',
  ambient: '#c8e1ff',
  spark: '#ffffff',
  lit: '#ffffff',
};

/**
 * صواعق ذهبية كهرمانية على البيج (للخيارين المقترحين). لحظة الضربة يميل الهدهد إلى الذهبي لا إلى
 * الأبيض، فلا يبهت على البيج.
 */
const GOLD_BOLTS = {
  bolt: '#a86a12',
  halo: '#fff4d6',
  haze: '#e0a93a',
  glow: '#f0c46a',
  ambient: '#ffd98a',
  spark: '#c98a1c',
  lit: '#c98a1c',
} as const;

/**
 * المظهر الفاتح، الخيار (أ): ألوان الهدهد الطبيعية. هدهد قرفي برتقالي دافئ، وخطوط بنية داكنة
 * على الذيل (كذيل الهدهد الحقيقي)، وساقان بنيتان.
 */
export const LIGHT_NATURAL: HudhudPalette = {
  bird: '#b5652b',
  parts: { legs: '#5a4636' },
  stripes: '#3b2716',
  ...GOLD_BOLTS,
};

/** المظهر الفاتح، الخيار (ب): كحلي داكن هادئ مع صواعق ذهبية. لحظة الضربة يفتح إلى كحلي أفتح لا إلى الرمادي. */
export const LIGHT_NAVY: HudhudPalette = {
  bird: '#1f3a5f',
  ...GOLD_BOLTS,
  lit: '#4a78b0',
};

/** خلفية المظهر الفاتح (--bg في main.css)، لحساب التباين. */
export const BEIGE = '#f4ecdc';

const PART_VARS: Record<PartName, string> = {
  legs: '--hudhud-legs',
  tail: '--hudhud-tail',
  body: '--hudhud-body',
  head: '--hudhud-head',
  crest: '--hudhud-crest',
};

/** المتغيرات للوحة (لتطبيقها على عنصر، مثل بطاقات المعاينة). */
export function paletteVars(palette: HudhudPalette): Record<string, string> {
  const vars: Record<string, string> = {
    '--hudhud-color': palette.bird,
    '--bolt-color': palette.bolt,
    '--bolt-halo': palette.halo,
    '--bolt-haze': palette.haze,
    '--bolt-glow-tint': palette.glow,
    '--bolt-ambient': palette.ambient,
    '--bolt-spark': palette.spark,
    '--hudhud-lit': palette.lit,
    '--hudhud-stripes': palette.stripes ?? '',
  };
  for (const [part, name] of Object.entries(PART_VARS) as [PartName, string][]) {
    vars[name] = palette.parts?.[part] ?? '';
  }
  return vars;
}

/** اللوحة كما تحددها متغيرات CSS على عنصر، وما لم يُعرَّف يأخذ قيمة الداكن. */
export function readPalette(style: Pick<CSSStyleDeclaration, 'getPropertyValue'>): HudhudPalette {
  const get = (name: string): string => style.getPropertyValue(name).trim();
  const parts: Partial<Record<PartName, string>> = {};
  for (const [part, name] of Object.entries(PART_VARS) as [PartName, string][]) {
    const value = get(name);
    if (value) parts[part] = value;
  }
  return {
    bird: get('--hudhud-color') || DARK_PALETTE.bird,
    parts,
    stripes: get('--hudhud-stripes') || undefined,
    bolt: get('--bolt-color') || DARK_PALETTE.bolt,
    halo: get('--bolt-halo') || DARK_PALETTE.halo,
    haze: get('--bolt-haze') || DARK_PALETTE.haze,
    glow: get('--bolt-glow-tint') || DARK_PALETTE.glow,
    ambient: get('--bolt-ambient') || DARK_PALETTE.ambient,
    spark: get('--bolt-spark') || DARK_PALETTE.spark,
    lit: get('--hudhud-lit') || DARK_PALETTE.lit,
  };
}

// ---------- الألوان والتباين (WCAG) ----------

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1] as string, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** اللون مائلاً إلى toward بنسبة amount (0 إلى 1)، بصيغة #rrggbb. */
export function mix(hex: string, toward: string, amount: number): string {
  const from = hexToRgb(hex);
  const to = hexToRgb(toward);
  if (!from || !to || amount <= 0) return hex;
  const k = Math.min(1, amount);
  return `#${from.map((c, i) => Math.round(c + ((to[i] as number) - c) * k).toString(16).padStart(2, '0')).join('')}`;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex) ?? [0, 0, 0];
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** نسبة التباين بين لونين (1 إلى 21). الرسوم والعناصر الكبيرة تحتاج 3 على الأقل. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
