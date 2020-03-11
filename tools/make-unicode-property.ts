/* eslint-disable @typescript-eslint/no-var-requires */

import propertyAliases from 'unicode-property-aliases-ecmascript';

import { CharSet } from '../src/char-set';

// Link https://www.ecma-international.org/ecma-262/10.0/index.html#table-unicode-general-category-values.
export const PROPERTY = [
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

export const makePropertyData = (name: string): string => {
  const canonical = propertyAliases.get(name) ?? name;
  const data: number[] = require(`unicode-12.0.0/Binary_Property/${canonical}/code-points.js`);

  const set = new CharSet();
  for (const c of data) {
    set.add(c, c + 1);
  }

  let src = '';
  src += `property.set(${JSON.stringify(canonical)}, ${JSON.stringify(set.data)});\n`;

  return src;
};
