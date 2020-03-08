// # make-unicode-category.ts
//
// > A generator for `src/data/unicode-categeory.ts` data.

/* eslint-disable @typescript-eslint/no-var-requires */

import { promises as fs } from 'fs';
import * as path from 'path';

import matchPropertyValue from 'unicode-match-property-value-ecmascript';

import { CharSet } from '../src/char-set';
import { toArray, DATA_DIR } from './util';

// Link https://www.ecma-international.org/ecma-262/10.0/index.html#table-unicode-general-category-values.
const categories = [
  'LC',
  'Pe',
  'Pc',
  'Cc',
  'Sc',
  'Pd',
  'Nd',
  'Me',
  'Pf',
  'Cf',
  'Pi',
  'L',
  'Nl',
  'Zl',
  'Ll',
  'M',
  'Sm',
  'Lm',
  'Sk',
  'Mn',
  'N',
  'Ps',
  'C',
  'Lo',
  'No',
  'Po',
  'So',
  'Zp',
  'Co',
  'P',
  'Z',
  'Zs',
  'Mc',
  'Cs',
  'S',
  'Lt',
  'Cn',
  'Lu'
];

const makeData = (canonical: string): string => {
  const data: number[] = require(`unicode-12.0.0/General_Category/${canonical}/code-points.js`);

  const set = new CharSet();
  for (const c of data) {
    set.add(c, c + 1);
  }

  let src = '';
  src += `category.set(${JSON.stringify(canonical)}, ${JSON.stringify(toArray(set))});\n`;

  return src;
};

export const makeUnicodeCategory = async (): Promise<void> => {
  let src = '';

  src += `export const category: Map<string, number[][]> = new Map();\n\n`;

  for (const name of categories) {
    const canonical = matchPropertyValue('General_Category', name);
    src += makeData(canonical);
  }

  await fs.writeFile(path.join(DATA_DIR, 'unicode-category.ts'), src);
  console.log('==> src/data/unicode-category.ts');
};
