/* eslint-disable @typescript-eslint/no-var-requires */

import matchPropertyValue from 'unicode-match-property-value-ecmascript';

import { CharSet } from '../src/char-class/char-set';

// Link https://www.ecma-international.org/ecma-262/10.0/index.html#table-unicode-general-category-values.
export const CATEGORY = [
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
  'Lu',
];

export const makeCategoryData = (name: string): string => {
  const canonical = matchPropertyValue('General_Category', name);
  const data: number[] = require(`unicode-12.0.0/General_Category/${canonical}/code-points.js`);

  const set = new CharSet();
  for (const c of data) {
    set.add(c, c + 1);
  }

  let src = '';
  src += `category.set(${JSON.stringify(canonical)}, ${JSON.stringify(set.data)});\n`;

  return src;
};
