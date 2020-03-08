import test from 'ava';

import { CharSet } from '../src/char-set';

test('simple', t => {
  const set = new CharSet();
  set.add(10, 20);
  t.true(set.has(15));
  t.true(set.has(10), 'has begin value');
  t.false(set.has(20), 'not have end value');
});

test('add multiple times', t => {
  const set = new CharSet();
  // Adds two ranges.
  set.add(10, 20);
  t.deepEqual(set.ranges, [{ begin: 10, end: 20 }]);
  set.add(30, 40);
  t.deepEqual(set.ranges, [
    { begin: 10, end: 20 },
    { begin: 30, end: 40 }
  ]);

  // Adds an empty range.
  set.add(20, 20);
  t.deepEqual(set.ranges, [
    { begin: 10, end: 20 },
    { begin: 30, end: 40 }
  ]);
  set.add(30, 30);
  t.deepEqual(set.ranges, [
    { begin: 10, end: 20 },
    { begin: 30, end: 40 }
  ]);

  // Merges two ranges.
  set.add(25, 30);
  t.deepEqual(set.ranges, [
    { begin: 10, end: 20 },
    { begin: 25, end: 40 }
  ]);
  set.add(20, 25);
  t.deepEqual(set.ranges, [{ begin: 10, end: 40 }]);

  // Extends a range.
  set.add(5, 40);
  t.deepEqual(set.ranges, [{ begin: 5, end: 40 }]);
  set.add(10, 45);
  t.deepEqual(set.ranges, [{ begin: 5, end: 45 }]);
  set.add(0, 50);
  t.deepEqual(set.ranges, [{ begin: 0, end: 50 }]);
});

test('clone', t => {
  const set1 = new CharSet();
  set1.add(10, 20);
  const set2 = set1.clone();
  set2.add(20, 30);
  t.deepEqual(set1.ranges, [{ begin: 10, end: 20 }]);
  t.deepEqual(set2.ranges, [{ begin: 10, end: 30 }]);
});

test('invert', t => {
  // Inverts a set.
  const set1 = new CharSet();
  set1.add(10, 20);
  set1.add(30, 40);
  const set2 = set1.invert();

  t.not(set1, set2);
  t.true(set2.has(0));
  t.true(set2.has(25));
  t.true(set2.has(50));
  t.false(set2.has(15));
  t.false(set2.has(35));

  // Inverts an inverted set.
  const set3 = set2.invert();
  t.deepEqual(set1.ranges, set3.ranges);

  // Inverts an empty set.
  const set4 = new CharSet().invert();
  t.true(set4.has(0));
});

test('addCharSet', t => {
  const set1 = new CharSet();
  set1.add(10, 20);
  const set2 = new CharSet();
  set2.add(20, 30);
  set1.addCharSet(set2);
  t.deepEqual(set1.ranges, [{ begin: 10, end: 30 }]);
});

test('toRegExpString', t => {
  const word = new CharSet();
  word.add(0x61, 0x7a + 1); // a-z
  word.add(0x41, 0x5a + 1); // A-Z
  word.add(0x5f, 0x5f + 1); // _

  t.is(word.toRegExpString(), '[A-Z_a-z]');
  t.is(word.toRegExpString(true), '[^A-Z_a-z]');
});
