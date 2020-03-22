import test from 'ava';

import { codesToString } from '../src/op-code';

test('codesToString', (t) => {
  let s = '';
  s += '#000: push         5\n';
  s += "#001: char         'a'\n";
  s += '#002: dec          \n';
  s += '#003: loop         #002\n';
  s += '#004: pop          \n';
  s += '#005: push         5\n';
  s += '#006: fork_next    #013\n';
  s += '#007: push_pos     \n';
  s += '#008: fork_next    #010\n';
  s += "#009: char         'b'\n";
  s += '#010: empty_check  \n';
  s += '#011: dec          \n';
  s += '#012: loop         #007\n';
  s += '#013: pop          \n';
  s += '#014: match        ';

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
      { op: 'match' },
    ]),
    s
  );
});
