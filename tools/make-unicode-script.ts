// # make-unicode-script.js
//
// > A generator for `src/data/unicode-script.js` data.

/* eslint-disable @typescript-eslint/no-var-requires */

import { promises as fs } from 'fs';
import * as path from 'path';

import matchPropertyValue from 'unicode-match-property-value-ecmascript';

import { CharSet } from '../src/char-set';
import { toArray, DATA_DIR } from './util';

// Link https://www.ecma-international.org/ecma-262/10.0/index.html#table-unicode-script-values.
const scripts = [
  'Adlm',
  'Ahom',
  'Hluw',
  'Arab',
  'Armn',
  'Avst',
  'Bali',
  'Bamu',
  'Bass',
  'Batk',
  'Beng',
  'Bhks',
  'Bopo',
  'Brah',
  'Brai',
  'Bugi',
  'Buhd',
  'Cans',
  'Cari',
  'Aghb',
  'Cakm',
  'Cham',
  'Cher',
  'Zyyy',
  'Qaac',
  'Xsux',
  'Cprt',
  'Cyrl',
  'Dsrt',
  'Deva',
  'Dogr',
  'Dupl',
  'Egyp',
  'Elba',
  'Ethi',
  'Geor',
  'Glag',
  'Goth',
  'Gran',
  'Grek',
  'Gujr',
  'Gong',
  'Guru',
  'Hani',
  'Hang',
  'Rohg',
  'Hano',
  'Hatr',
  'Hebr',
  'Hira',
  'Armi',
  'Qaai',
  'Phli',
  'Prti',
  'Java',
  'Kthi',
  'Knda',
  'Kana',
  'Kali',
  'Khar',
  'Khmr',
  'Khoj',
  'Sind',
  'Laoo',
  'Latn',
  'Lepc',
  'Limb',
  'Lina',
  'Linb',
  'Lisu',
  'Lyci',
  'Lydi',
  'Mahj',
  'Maka',
  'Mlym',
  'Mand',
  'Mani',
  'Marc',
  'Medf',
  'Gonm',
  'Mtei',
  'Mend',
  'Merc',
  'Mero',
  'Plrd',
  'Modi',
  'Mong',
  'Mroo',
  'Mult',
  'Mymr',
  'Nbat',
  'Talu',
  'Newa',
  'Nkoo',
  'Nshu',
  'Ogam',
  'Olck',
  'Hung',
  'Ital',
  'Narb',
  'Perm',
  'Xpeo',
  'Sogo',
  'Sarb',
  'Orkh',
  'Orya',
  'Osge',
  'Osma',
  'Hmng',
  'Palm',
  'Pauc',
  'Phag',
  'Phnx',
  'Phlp',
  'Rjng',
  'Runr',
  'Samr',
  'Saur',
  'Shrd',
  'Shaw',
  'Sidd',
  'Sgnw',
  'Sinh',
  'Sogd',
  'Sora',
  'Soyo',
  'Sund',
  'Sylo',
  'Syrc',
  'Tglg',
  'Tagb',
  'Tale',
  'Lana',
  'Tavt',
  'Takr',
  'Taml',
  'Tang',
  'Telu',
  'Thaa',
  'Thai',
  'Tibt',
  'Tfng',
  'Tirh',
  'Ugar',
  'Vaii',
  'Wara',
  'Yiii',
  'Zanb'
  // 'Zzzz' (alias for 'Unknown') is commented out because it is not listed in the table.
  // However V8 accepts this... (e.g. `/\p{Script=Zzzz}/u.exec('\uFFFF')` matches.)
];

const makeData = (canonical: string): string => {
  const base: number[] = require(`unicode-12.0.0/Script/${canonical}/code-points.js`);
  const ext: number[] = require(`unicode-12.0.0/Script_Extensions/${canonical}/code-points.js`);

  const baseSet = new CharSet();
  for (const c of base) {
    baseSet.add(c, c + 1);
  }

  const extSet = new CharSet();
  for (const c of ext) {
    if (!baseSet.has(c)) {
      extSet.add(c, c + 1);
    }
  }

  let src = '';
  src += `script.set(${JSON.stringify(canonical)}, ${JSON.stringify(toArray(baseSet))});\n`;
  src += `scriptExtensions.set(${JSON.stringify(canonical)}, ${JSON.stringify(
    toArray(extSet)
  )});\n`;

  return src;
};

export const makeUnicodeScript = async (): Promise<void> => {
  let src = '';

  src += `export const script: Map<string, number[][]> = new Map();\n`;
  src += `export const scriptExtensions: Map<string, number[][]> = new Map();\n\n`;

  for (const name of scripts) {
    const canonical = matchPropertyValue('Script', name);
    src += makeData(canonical);
  }

  await fs.writeFile(path.join(DATA_DIR, 'unicode-script.ts'), src);
  console.log('==> src/data/unicode-script.ts');
};
