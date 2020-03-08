// # make-unicode-property.js
//
// > A generator for `src/data/unicode-property.js` data.

/* eslint-disable @typescript-eslint/no-var-requires */

import { promises as fs } from 'fs';
import * as path from 'path';

import propertyAlias from 'unicode-property-aliases-ecmascript';

import { CharSet } from '../src/char-set';
import { toArray, DATA_DIR } from './util';

// Link https://www.ecma-international.org/ecma-262/10.0/index.html#table-unicode-general-category-values.
const properties = [
  'ASCII',
  'AHex',
  'Alpha',
  'Any',
  'Assigned',
  'Bidi_C',
  'Bidi_M',
  'CI',
  'Cased',
  'CWCF',
  'CWCM',
  'CWL',
  'CWKCF',
  'CWT',
  'CWU',
  'Dash',
  'DI',
  'Dep',
  'Dia',
  'Emoji',
  'Emoji_Component',
  'Emoji_Modifier',
  'Emoji_Modifier_Base',
  'Emoji_Presentation',
  'Extended_Pictographic',
  'Ext',
  'Gr_Base',
  'Gr_Ext',
  'Hex',
  'IDSB',
  'IDST',
  'IDC',
  'IDS',
  'Ideo',
  'Join_C',
  'LOE',
  'Lower',
  'Math',
  'NChar',
  'Pat_Syn',
  'Pat_WS',
  'QMark',
  'Radical',
  'RI',
  'STerm',
  'SD',
  'Term',
  'UIdeo',
  'Upper',
  'VS',
  'space',
  'XIDC',
  'XIDS'
];

const makeData = (canonical: string): string => {
  const data: number[] = require(`unicode-12.0.0/Binary_Property/${canonical}/code-points.js`);

  const set = new CharSet();
  for (const c of data) {
    set.add(c, c + 1);
  }

  let src = '';
  src += `property.set(${JSON.stringify(canonical)}, ${JSON.stringify(toArray(set))});\n`;

  return src;
};

export const makeUnicodeProperty = async (): Promise<void> => {
  let src = '';

  src += `export const property: Map<string, number[][]> = new Map();\n\n`;

  for (const name of properties) {
    const canonical = propertyAlias.get(name) || name;
    src += makeData(canonical);
  }

  await fs.writeFile(path.join(DATA_DIR, 'unicode-property.ts'), src);
  console.log('==> src/data/unicode-property.ts');
};
