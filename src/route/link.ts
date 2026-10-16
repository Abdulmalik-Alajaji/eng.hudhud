/**
 * البداية والوجهة كنص في الرابط بعد #، لمشاركة الطريق ولزر الرجوع في المتصفح:
 * from=B1-G-EN1 (مكان) أو from=tap:B1-G:400:470 (نقرة على الخريطة)، وto=B1-F215 أو to=doctor:d1.
 */
import type { Start, Target } from './route';

export function parseStart(value: string): Start | null {
  if (value.startsWith('tap:')) {
    const [, floor, x, y] = value.split(':');
    if (!floor || !x || !y || Number.isNaN(Number(x)) || Number.isNaN(Number(y))) return null;
    return { floor, x: Number(x), y: Number(y) };
  }
  return value ? { place: value } : null;
}

export function parseTarget(value: string): Target | null {
  if (value.startsWith('doctor:')) return { doctor: value.slice('doctor:'.length) };
  return value ? { place: value } : null;
}

export const encodeTap = (floor: string, x: number, y: number): string => `tap:${floor}:${x}:${y}`;
