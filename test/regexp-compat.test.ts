import test from 'ava';

import { RegExpCompat } from '../src/regexp-compat';

test('exec', t => {
  const re0 = new RegExpCompat('(a)+', '');
  const result0 = re0.exec('aaa');
  t.deepEqual(Array.from(result0 ?? []), ['aaa', 'a']);
  t.is(result0?.index, 0);
  t.is(result0?.groups, undefined);
  t.is(re0.lastIndex, 0);

  const re1 = new RegExpCompat('(a)+', 'g');
  const result1 = re1.exec('aaa');
  t.deepEqual(Array.from(result0 ?? []), ['aaa', 'a']);
  t.is(result1?.index, 0);
  t.is(result1?.groups, undefined);
  t.is(re1.lastIndex, 3);

  const re2 = new RegExpCompat('(?<a>a)+', 'g');
  const result2 = re2.exec('aaa');
  t.deepEqual(Array.from(result0 ?? []), ['aaa', 'a']);
  t.deepEqual(result2?.groups, { a: 'a' });
  t.is(result1?.index, 0);
  t.is(result1?.groups, undefined);
  t.is(re1.lastIndex, 3);
});

test('@@match', t => {
  const re0 = new RegExp('(?<a>a)(b)', '');
  const result0 = 'ab'.match(re0);
  t.deepEqual(Array.from(result0 ?? []), ['ab', 'a', 'b']);
  t.deepEqual(result0?.groups, { a: 'a' });

  const re1 = new RegExp('(?<a>a)(b)', '');
  const result1 = 'bc'.match(re1);
  t.is(result1, null);
});

test('@@split', t => {
  const re0 = new RegExp('b', '');
  const result0 = 'ababa'.split(re0);
  t.deepEqual(result0, ['a', 'a', 'a']);

  const re1 = new RegExp('(b)', '');
  const result1 = 'ababa'.split(re1);
  t.deepEqual(result1, ['a', 'b', 'a', 'b', 'a']);
});
