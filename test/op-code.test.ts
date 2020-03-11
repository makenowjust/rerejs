import test from 'ava';

import { calculateMaxStackSize, codesToString } from '../src/op-code';

test('calculateMaxStackSize', t => {
  t.is(calculateMaxStackSize([]), 0);
  t.is(
    calculateMaxStackSize([
      { op: 'push', value: 1 },
      { op: 'pop' },
      { op: 'push_pos' },
      { op: 'pop' },
      { op: 'push_proc' },
      { op: 'pop' }
    ]),
    1
  );
  t.is(
    calculateMaxStackSize([
      // Op-codes for /a{5}(b?){0,5}/
      { op: 'push', value: 5 },
      { op: 'char', value: 0x61 },
      { op: 'dec' },
      { op: 'loop', cont: -2 },
      { op: 'pop' },
      { op: 'push', value: 5 },
      { op: 'fork_next', next: 6 },
      { op: 'push_pos' },
      { op: 'fork_next', next: 1 },
      { op: 'char', value: 0x62 },
      { op: 'empty_check' },
      { op: 'dec' },
      { op: 'loop', cont: -6 },
      { op: 'pop' },
      { op: 'match' }
    ]),
    2
  );
});

test('codesToString', t => {
  let s = '';
  s += '  #000: push         5\n';
  s += "  #001: char         'a'\n";
  s += '  #002: dec          \n';
  s += '  #003: loop         #001\n';
  s += '  #004: pop          \n';
  s += '  #005: push         5\n';
  s += '  #006: fork_next    #013\n';
  s += '  #007: push_pos     \n';
  s += '  #008: fork_next    #010\n';
  s += "  #009: char         'b'\n";
  s += '  #010: empty_check  \n';
  s += '  #011: dec          \n';
  s += '  #012: loop         #006\n';
  s += '  #013: pop          \n';
  s += '  #014: match        ';

  t.is(
    codesToString([
      // Op-codes for /a{5}(b?){0,5}/
      { op: 'push', value: 5 },
      { op: 'char', value: 0x61 },
      { op: 'dec' },
      { op: 'loop', cont: -2 },
      { op: 'pop' },
      { op: 'push', value: 5 },
      { op: 'fork_next', next: 6 },
      { op: 'push_pos' },
      { op: 'fork_next', next: 1 },
      { op: 'char', value: 0x62 },
      { op: 'empty_check' },
      { op: 'dec' },
      { op: 'loop', cont: -6 },
      { op: 'pop' },
      { op: 'match' }
    ]),
    s
  );
});
