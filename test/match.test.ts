import util from 'util';

import test from 'ava';

import { Match } from '../src/match';

test('getters', (t) => {
  const m = new Match('test', [0, 4, -1, -1, 1, 3], new Map([['x', 2]]));
  t.is(m.input, 'test');
  t.is(m.index, 0);
  t.is(m.lastIndex, 4);
  t.is(m.length, 3);
  t.is(m.get(0), 'test');
  t.is(m.get(1), undefined);
  t.is(m.get(2), 'es');
  t.is(m.get('x'), 'es');
  t.is(m.get(3), undefined);
  t.is(m.get('y'), undefined);
  t.is(m.begin(0), 0);
  t.is(m.end(0), 4);
  t.is(m.begin(1), undefined);
  t.is(m.end(1), undefined);
  t.is(m.begin(2), 1);
  t.is(m.end(2), 3);
  t.is(m.begin('x'), 1);
  t.is(m.end('x'), 3);
});

test('toArray', (t) => {
  const m = new Match('test', [0, 4, -1, -1, 1, 3], new Map([['x', 2]]));
  const a = m.toArray();

  const b: RegExpMatchArray = [];
  b[0] = 'test';
  b[2] = 'es';
  b.input = 'test';
  b.index = 0;
  const groups: { [key: string]: string } = Object.create(null);
  groups['x'] = 'es';
  b.groups = groups;

  t.deepEqual(a, b);
});

test('toString', (t) => {
  const m = new Match('test', [0, 4, -1, -1, 1, 3], new Map([['x', 2]]));
  t.is(m.toString(), 'Match["test", undefined, "es"]');
});

test('util.inspect.custom', (t) => {
  const m = new Match('test', [0, 4, -1, -1, 1, 3], new Map([['x', 2]]));
  let s = '';
  s += 'Match [\n';
  s += "  0 [0:4] => 'test',\n";
  s += '  1 => undefined,\n';
  s += "  'x' [1:3] => 'es',\n";
  s += ']';

  t.is(util.inspect(m, { colors: false }), s);
});
