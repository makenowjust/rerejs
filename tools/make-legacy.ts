// # make-legacry.ts:
//
// > A generator for `src/data/legacy.ts` data.
//
// This script generates `inverseFoldMap` table. This table is utility
// to calculate inverse of `canonicalize` function for character class
// ignore-case matching on legacy (non-`unicode`) mode. In almost all
// cases, `String.prototype.toLowerCase()` works for this purpose,
// however some characters need special treatment. (e.g. both of
// `canonicalize('ǳ')` and `canonicalize('ǲ')` returns the same `'Ǳ'`,
// so inverse of `canonicalize` for `'Ǳ'` must be `'ǳ'` and `'ǲ'`.)

import { promises as fs } from 'fs';
import * as path from 'path';

import { upper, lower, fromCharCode, hex, DATA_DIR } from './util';

const canonicalize = (c: number): number => {
  const u = upper(c);
  if (u.length >= 2) {
    return c;
  }
  const d = u.charCodeAt(0);
  if (c >= 0x80 && d < 0x80) {
    return c;
  }
  return d;
};

export const makeLegacy = async (): Promise<void> => {
  // Builds `foldMap` table which is map from a character to its canonicalized.
  const foldMap = new Map<number, number>();
  for (let c = 0; c < 0xffff; c++) {
    const d = canonicalize(c);
    if (c !== d) {
      foldMap.set(c, d);
    }
  }

  // Calculates a simple version of `inverseFoldMap` and its domain.
  const simpleInverseFoldMap = new Map<number, number[]>();
  const rangeOfFoldMap = new Set<number>(); // means domainOfInverseFoldMap
  for (const [c, d] of foldMap) {
    let array = simpleInverseFoldMap.get(d);
    if (!array) {
      array = [d];
      simpleInverseFoldMap.set(d, array);
    }
    array.push(c);
    rangeOfFoldMap.add(d);
  }

  // Calculates `inverseFoldMap`.
  const inverseFoldMap = new Map<number, number[]>();
  for (const c of rangeOfFoldMap) {
    const d = simpleInverseFoldMap.get(c);
    if (!d) {
      throw new Error('BUG: unexpected undefined');
    }
    if (d.length === 1 && lower(c) === fromCharCode(d[0])) {
      // Ignores this case because `String.prototype.toLowerCase()` seems good.
      continue;
    } else {
      inverseFoldMap.set(c, d);
    }
  }

  // Generates output data.
  let src = 'export const inverseFoldMap: Map<number, number[]> = new Map([\n';
  for (const [c, d] of inverseFoldMap) {
    src += `  [${hex(c)}, [${d.map(hex).join(', ')}]],\n`;
  }
  src += ']);\n\n';

  await fs.writeFile(path.join(DATA_DIR, 'legacy.ts'), src);
  console.log('==> src/data/legecy.ts');
};
