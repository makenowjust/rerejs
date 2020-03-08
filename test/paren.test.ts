import test from 'ava';

import { countParen } from '../src/paren';

test('count number of capture parens', t => {
  t.is(countParen(''), 0);
  t.is(countParen('()'), 1);
  t.is(countParen('(?:)(?=)(?!)(?<=)(?<!)'), 0);
  t.is(countParen('\\('), 0);
  t.is(countParen('[\\]()]'), 0);
  t.is(countParen('test()()test(())test'), 4);
  t.is(countParen('(?<test>)'), 1);
  t.is(countParen('(?:())'), 1);
});
