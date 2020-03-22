// See https://www.ecma-international.org/ecma-262/10.0/index.html#sec-characterclassescape.

import { CharSet } from './char-set';
import { extraWordCharacters, category } from './data/unicode';

/** A `CharSet` which contains ASCII digits. */
export const digit: CharSet = new CharSet();
digit.add(0x30, 0x39 + 1); // 0..9

/** A `CharSet` which does not contain ASCII digits. */
export const invertDigit: CharSet = digit.clone().invert();

/** A `CharSet` which contains ASCII word characters. */
export const word: CharSet = new CharSet();
word.add(0x30, 0x39 + 1); // 0..9
word.add(0x41, 0x5a + 1); // A..Z
word.add(0x61, 0x7a + 1); // a..z
word.add(0x5f, 0x5f + 1); // _

/** A `CharSet` which does not contain ASCII word characters. */
export const invertWord: CharSet = word.clone().invert();

/**
 * A `CharSet` which contains Unicode word characters.
 *
 * See https://www.ecma-international.org/ecma-262/10.0/index.html#sec-runtime-semantics-wordcharacters-abstract-operation.
 */
export const unicodeWord = word.clone();
for (const c of extraWordCharacters) {
  unicodeWord.add(c, c + 1);
}

/** A `CharSet` which does not contain Unicode word characters. */
export const invertUnicodeWord: CharSet = unicodeWord.clone().invert();

/**
 * A `CharSet` which contains space characters.
 *
 * See https://www.ecma-international.org/ecma-262/10.0/index.html#prod-WhiteSpace
 * and https://www.ecma-international.org/ecma-262/10.0/index.html#prod-LineTerminator.
 */
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const space: CharSet = new CharSet(category.get('Space_Separator')!);
space.add(0x09, 0x0d + 1); // <TAB>, <LF>, <VT>, <FF>, <CR>
space.add(0xa0, 0xa0 + 1); // <NBSP>
space.add(0xfeff, 0xfeff + 1); // <ZWNBSP>

/** A `CharSet` which does not contain space characters. */
export const invertSpace: CharSet = space.clone().invert();
