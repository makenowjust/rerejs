import test from 'ava';

import { countCaptureParens } from '../src/parser';

test('countCaptureParens', t => {
  t.is(countCaptureParens(''), 0);
  t.is(countCaptureParens('()'), 1);
  t.is(countCaptureParens('(?:)(?=)(?!)(?<=)(?<!)'), 0);
  t.is(countCaptureParens('\\('), 0);
  t.is(countCaptureParens('[\\]()]'), 0);
  t.is(countCaptureParens('test()()test(())test'), 4);
  t.is(countCaptureParens('(?<test>)'), 1);
  t.is(countCaptureParens('(?:())'), 1);
});
