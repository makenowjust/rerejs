import test from 'ava';

import { RENode } from '../../src/node/types';

test('match', (t) => {
  const root = RENode.load('ab|(cd)?', 'i');
  for (const query of [
    'Pattern',
    '*',
    '[flagSet.ignoreCase]',
    ':not(Node)',
    ':not([flagSet.multiline])',
    ':not(:char)',
  ]) {
    t.assert(root.match(query), query);
  }

  const child = root?.firstChild()?.firstChild();
  for (const query of [
    'Sequence',
    'Disjunction, Sequence',
    '*',
    '[range.0=0][range.1=2]',
    '[range=type(object)]',
    ':has(Disjunction, :char)',
    ':has(> :char)',
    ':has(:char[raw="a"])',
    ':has(:char[raw="\\x61"])',
    ':has(:char[raw="\\u0061"])',
    ':has(:char[raw="\\u{61}"])',
    ':has(:char[raw=/a/])',
    ':has(+ Optional)',
    ':has(~ Optional)',
    'Disjunction > Sequence:first-child',
    'Disjunction > Sequence:nth-child(1)',
    'Disjunction > Sequence:not(:nth-child(2n+0))',
    'Disjunction > Sequence:not(:last-child)',
  ]) {
    t.assert(child?.match(query), query);
  }
});
