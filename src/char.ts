// # char.ts
//
// > Provides charater code points related operations.

import * as charClass from './char-class';
import * as legacyData from './data/legacy';
import * as unicodeData from './data/unicode';

/**
 * Measures size of `c` character code point as string length.
 */
export const size = (c: number): number => (c >= 0x10000 ? 2 : 1);

/**
 * Gets a `s[i]` charaacter code point with considering `unicode`.
 *
 * When `i` is exceeded `s` length, it returns `-1` as begin/end of string marker.
 *
 * @see https://www.ecma-international.org/ecma-262/10.0/index.html#sec-notation
 */
export const index = (s: string, i: number, unicode: boolean): number => {
  const c = unicode ? s.codePointAt(i) : s.charCodeAt(i);
  return c ?? -1;
};

/**
 * Gets a `s[i - 1]` character with considering `unicode`.
 */
export const prevIndex = (s: string, i: number, unicode: boolean): number => {
  if (!unicode) {
    return index(s, i - 1, unicode);
  }

  const c = index(s, i - 1, unicode);
  if (0xdc00 <= c && c <= 0xdfff) {
    // is low-surrogate?
    const d = index(s, i - 2, unicode);
    if (size(d) === 2) {
      return d;
    }
  }
  return c;
};

/**
 * Checks `c` is a line terminator character.
 * @see https://www.ecma-international.org/ecma-262/10.0/index.html#sec-line-terminators
 */
export const isLineTerminator = (c: number): boolean =>
  c === 0x000a || c === 0x000d || c === 0x2028 || c === 0x2029;

/**
 * Canonicalizes `c` with considering `ignoreCase` and `unicode`.
 * @see https://www.ecma-international.org/ecma-262/10.0/index.html#sec-runtime-semantics-canonicalize-ch
 */
export const canonicalize = (c: number, ignoreCase: boolean, unicode: boolean): number => {
  if (!ignoreCase) {
    return c;
  }
  if (unicode) {
    return unicodeData.foldMap.get(c) || c;
  }

  const s = String.fromCharCode(c);
  const u = s.toUpperCase();

  if (u.length >= 2) {
    return c;
  }

  const d = u.charCodeAt(0);
  if (c >= 128 && d < 128) {
    return c;
  }

  return d;
};

/**
 * Calculates reverse canonicalize `c`.
 */
export const uncanonicalize = (c: number, ignoreCase: boolean, unicode: boolean): number[] => {
  if (!ignoreCase) {
    return [c];
  }
  if (unicode) {
    return unicodeData.inverseFoldMap.get(c) || [c];
  }

  const d0 = legacyData.inverseFoldMap.get(c);
  if (d0) {
    return d0;
  }

  const s = String.fromCharCode(c);
  const u = s.toLowerCase();
  const d = u.charCodeAt(0);
  if (c !== d) {
    return [c, d];
  }
  return [d];
};

/**
 * Checks `c` is a word character.
 * @see https://www.ecma-international.org/ecma-262/10.0/index.html#sec-runtime-semantics-iswordchar-abstract-operation
 */
export const isWordChar = (c: number, ignoreCase: boolean, unicode: boolean): boolean => {
  if (c === -1) {
    return false;
  }

  if (ignoreCase && unicode) {
    return charClass.unicodeWord.has(c);
  }
  return charClass.word.has(c);
};
