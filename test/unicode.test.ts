import test from 'ava';

import { loadProperty, loadPropertyValue } from '../src/unicode';

test('loadProperty', t => {
  const ascii = loadProperty('ASCII');
  t.true(ascii && ascii.has(0x41));

  const ahex = loadProperty('AHex');
  t.true(ahex && ahex.has(0x41));

  const unknown = loadProperty('not defined in unicode');
  t.is(unknown, null);
});

test('loadPropertyValue', t => {
  const zs = loadPropertyValue('General_Category', 'Zs');
  t.true(zs && zs.has(0x20));

  const hira = loadPropertyValue('sc', 'Hira');
  t.true(hira && hira.has(0x3042));

  const kata = loadPropertyValue('scx', 'Kana');
  t.true(kata && kata.has(0x30a2));

  const unknown =
    loadPropertyValue('not defined', 'in unicode') ??
    loadPropertyValue('General_Category', 'not defined') ??
    loadPropertyValue('Script', 'not defined') ??
    loadPropertyValue('Script_Extensions', 'not defined');
  t.is(unknown, null);
});
