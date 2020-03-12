import { inverseFoldMap as legacyFoldMap } from './data/legacy';
import { foldMap as unicodeFoldMap, inverseFoldMap as unicodeInverseFoldMap } from './data/unicode';

/** Return case-folded code point for ignore-case comparison. */
export const canonicalize = (c: number, unicode: boolean): number => {
  if (unicode) {
    return unicodeFoldMap.get(c) || c;
  }

  const s = String.fromCharCode(c);
  const u = s.toUpperCase();
  if (u.length >= 2) {
    return c;
  }
  const d = u.charCodeAt(0);
  if (c >= 0x80 && d < 0x80) {
    return c;
  }
  return d;
};

/**
 * Inverse function of `canonicalize`.
 *
 * It is used for character class matching on ignore-case.
 */
export const uncanonicalize = (c: number, unicode: boolean): number[] => {
  if (unicode) {
    return unicodeInverseFoldMap.get(c) ?? [];
  }

  const d = legacyFoldMap.get(c);
  if (d !== undefined) {
    return d;
  }
  const s = String.fromCharCode(c);
  return [s.toLowerCase().charCodeAt(0)];
};
