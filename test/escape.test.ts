import test from 'ava';

import { escape } from '../src/escape';

test('escape', (t) => {
  t.true(new RegExp(escape(0)).test(String.fromCodePoint(0)));
  t.true(new RegExp(escape(0x09)).test(String.fromCodePoint(0x09)));
  t.true(new RegExp(escape(0x0a)).test(String.fromCodePoint(0x0a)));
  t.true(new RegExp(escape(0x0b)).test(String.fromCodePoint(0x0b)));
  t.true(new RegExp(escape(0x0c)).test(String.fromCodePoint(0x0c)));
  t.true(new RegExp(escape(0x0d)).test(String.fromCodePoint(0x0d)));
  t.true(new RegExp(escape(0x5c)).test(String.fromCodePoint(0x5c)));
  t.true(new RegExp(escape(0x5e)).test(String.fromCodePoint(0x5e)));
  t.true(new RegExp(escape(0x5d)).test(String.fromCodePoint(0x5d)));
  t.true(new RegExp(escape(0x24)).test(String.fromCodePoint(0x24)));
  t.true(new RegExp(escape(0x28)).test(String.fromCodePoint(0x28)));
  t.true(new RegExp(escape(0x29)).test(String.fromCodePoint(0x29)));
  t.true(new RegExp(escape(0x2a)).test(String.fromCodePoint(0x2a)));
  t.true(new RegExp(escape(0x2b)).test(String.fromCodePoint(0x2b)));
  t.true(new RegExp(escape(0x2e)).test(String.fromCodePoint(0x2e)));
  t.true(new RegExp(escape(0x2f)).test(String.fromCodePoint(0x2f)));
  t.true(new RegExp(escape(0x3f)).test(String.fromCodePoint(0x3f)));
  t.true(new RegExp(escape(0x5b)).test(String.fromCodePoint(0x5b)));
  t.true(new RegExp(escape(0x60)).test(String.fromCodePoint(0x60)));
  t.true(new RegExp(escape(0x7b)).test(String.fromCodePoint(0x7b)));
  t.true(new RegExp(escape(0x7c)).test(String.fromCodePoint(0x7c)));
  t.true(new RegExp(escape(0x7d)).test(String.fromCodePoint(0x7d)));
  t.true(new RegExp(escape(0x7f)).test(String.fromCodePoint(0x7f)));
  t.true(new RegExp(escape(0xffff)).test(String.fromCodePoint(0xffff)));
  t.true(new RegExp(escape(0x10000), 'u').test(String.fromCodePoint(0x10000)));
  t.true(new RegExp('[' + escape(0x08, true) + ']').test(String.fromCodePoint(0x08)));
  t.true(new RegExp('[' + escape(0x2d, true) + ']').test(String.fromCodePoint(0x2d)));
});
