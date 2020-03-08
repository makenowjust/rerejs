// # make.ts
//
// > An entry point of generators.

import { makeLegacy } from './make-legacy';
import { makeUnicode } from './make-unicode';
import { makeUnicodeCategory } from './make-unicode-category';
import { makeUnicodeProperty } from './make-unicode-property';
import { makeUnicodeScript } from './make-unicode-script';

const make = async (): Promise<void> => {
  await Promise.all([
    makeLegacy(),
    makeUnicode(),
    makeUnicodeCategory(),
    makeUnicodeProperty(),
    makeUnicodeScript()
  ]);
};

make().catch(err => console.error(err));
