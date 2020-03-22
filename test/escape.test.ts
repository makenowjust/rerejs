import test from 'ava';

import { escape } from '../src/escape';

test('`c <= 0xFFFF`, then `new RegExp(escape(c)).test(String.fromCodePoint(c))` is always true', (t) => {
  for (let c = 0; c <= 0xffff; c++) {
    t.true(
      new RegExp(escape(c)).test(String.fromCodePoint(c)),
      `new RegExp(escape(${c})).test(String.fromCodePoint(${c}))`
    );
  }
});

test('`c <= 0xFFFF`, then `new RegExp("[" + escape(c, true) + "]").test(String.fromCodePoint(c))` is always true', (t) => {
  for (let c = 0; c <= 0xffff; c++) {
    t.true(
      new RegExp('[' + escape(c, true) + ']').test(String.fromCodePoint(c)),
      `new RegExp("[" + escape(${c}, true) + "]").test(String.fromCodePoint(${c}))`
    );
  }
});

test('`new RegExp(escape(0x10000),  "u").test(String.fromCodePoint(0x10000))` is true', (t) => {
  t.true(new RegExp(escape(0x10000), 'u').test(String.fromCodePoint(0x10000)));
});
