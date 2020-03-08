import test from 'ava';

import { matchProperty, matchPropertyValue } from '../src/unicode';

test('matchProperty', t => {
  // Canonical name.
  const ascii = matchProperty('ASCII');
  t.true(ascii && ascii.has(0x41));

  // Aliases name.
  const ahex = matchProperty('AHex');
  t.true(ahex && ahex.has(0x41));

  // Unknown name.
  const unknown = matchProperty('not defined in unicode');
  t.is(unknown, null);
});

test('matchPropertyValue', t => {
  const zs = matchPropertyValue('General_Category', 'Zs');
  t.true(zs && zs.has(0x20));

  const hira = matchPropertyValue('sc', 'Hira');
  t.true(hira && hira.has(0x3042));

  const kata = matchPropertyValue('scx', 'Kana');
  t.true(kata && kata.has(0x30a2));

  const unknown =
    matchPropertyValue('not defined', 'in unicode') ||
    matchPropertyValue('General_Category', 'not defined') ||
    matchPropertyValue('Script', 'not defined') ||
    matchPropertyValue('Script_Extensions', 'not defined');
  t.is(unknown, null);
});
