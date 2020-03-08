// # make-unicode.ts
//
// > A generator for `src/data/unicode.ts` data.
//
// This script generates `foldMap`, `extraWordCharacters`, and `extraWhiteSpace`.
// Also, a generated `unicode.js` contains `inverseFoldMap` calculation.
// These data are used in `unicode` mode matching. Each data meaning are described
// below.
//
// - `foldMap` is a `Map` to associate a code point to another code point,
//   which ignore-case matching uses.
//   (See https://www.ecma-international.org/ecma-262/10.0/index.html#sec-runtime-semantics-canonicalize-ch)
// - `inverseFoldMap` is inversed `Map` of `foldMap`.
// - `extraWordCharacters` is a `Set` contains characters added to **WordCharacters**
//   on ignore-case and `unicode` mode combination.
//   (See https://www.ecma-international.org/ecma-262/10.0/index.html#sec-runtime-semantics-wordcharacters-abstract-operation)
// - `extraWhiteSpace` is a `Set` contains characters categorized by `Zs` (`Space_Separator`).
//   These characters matches to `\s` in `RegExp`.

/* eslint-disable @typescript-eslint/no-var-requires */

import assert from 'assert';
import { promises as fs } from 'fs';
import * as path from 'path';

import { hex, DATA_DIR } from './util';

const makeExtraWordCharacters = (foldMap: Map<number, number>): string => {
  const wordCharacters = new Set(
    Array.from('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_').map(c =>
      c.charCodeAt(0)
    )
  );

  // Calculates `extraWordCharacters`.
  const extraWordCharacters: number[] = [];
  for (const [c, d] of foldMap) {
    if (!wordCharacters.has(c) && wordCharacters.has(d)) {
      extraWordCharacters.push(c);
    }
  }

  return `export const extraWordCharacters: Set<number> = new Set([${extraWordCharacters
    .map(hex)
    .join(', ')}]);\n`;
};

const makeFoldMap = (): string => {
  const common: Map<number, number> = require('unicode-12.0.0/Case_Folding/C/code-points.js');
  const simple: Map<number, number> = require('unicode-12.0.0/Case_Folding/S/code-points.js');

  // Merges C and S mappings.
  const foldMap = new Map<number, number>();
  for (const [c, d] of common) {
    foldMap.set(c, d);
  }
  for (const [c, d] of simple) {
    assert(!foldMap.has(c));
    foldMap.set(c, d);
  }

  // Generates output data.
  let src = `export const foldMap: Map<number, number> = new Map([\n`;
  for (const [c, d] of foldMap) {
    src += `  [${hex(c)}, ${hex(d)}],\n`;
  }
  src += ']);\n\n';

  // Appends `inverseFoldMap` calculation.
  src += `export const inverseFoldMap: Map<number, number[]> = new Map();\n`;
  src += `for (const [c, d] of foldMap) {\n`;
  src += `  if (!inverseFoldMap.has(d)) {\n`;
  src += `    inverseFoldMap.set(d, [d]);\n`;
  src += `  }\n`;
  src += `  inverseFoldMap.get(d)!.push(c);\n`;
  src += `}\n\n`;

  src += makeExtraWordCharacters(foldMap);

  return src;
};

const makeExtraWhiteSpace = (): string => {
  const data: number[] = require('unicode-12.0.0/General_Category/Space_Separator/code-points.js');

  return `export const extraWhiteSpace: Set<number> = new Set([${data.map(hex).join(', ')}]);\n`;
};

export const makeUnicode = async (): Promise<void> => {
  let src = '';

  src += makeFoldMap();
  src += makeExtraWhiteSpace();

  await fs.writeFile(path.join(DATA_DIR, 'unicode.ts'), src);
  console.log('==> src/data/unicode.ts');
};
