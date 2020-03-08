// # char-class.ts
//
// > Defines pre-calculated character classes.

import { CharSet } from './char-set';
import * as unicodeData from './data/unicode';

export const digit: CharSet = new CharSet();
digit.add(0x30, 0x39 + 1); // 0..9

export const invertDigit: CharSet = digit.invert();

export const word: CharSet = new CharSet();
word.add(0x30, 0x39 + 1); // 0..9
word.add(0x41, 0x5a + 1); // A..Z
word.add(0x61, 0x7a + 1); // a..z
word.add(0x5f, 0x5f + 1); // _

export const invertWord: CharSet = word.invert();

export const unicodeWord = word.clone();
for (const c of unicodeData.extraWordCharacters) {
  unicodeWord.add(c, c + 1);
}

export const invertUnicodeWord: CharSet = unicodeWord.invert();

export const space: CharSet = new CharSet();
space.add(0x09, 0x0d + 1); // <TAB>, <LF>, <VT>, <FF>, <CR>
space.add(0xa0, 0xa0 + 1); // <NBSP>
space.add(0xfeff, 0xfeff + 1); // <ZWNBSP>
for (const ws of unicodeData.extraWhiteSpace) {
  space.add(ws, ws + 1);
}

export const invertSpace: CharSet = space.invert();
