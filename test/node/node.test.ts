import test from 'ava';

import { RENode } from '../../src/node/types';
import { patternToString } from '../../src/syntax/pattern';

test('getters and assertions', (t) => {
  const root = RENode.load('ab|(cd)?', 'i');

  t.is(root.attribute('flagSet').ignoreCase, true);
  t.is(root.attribute('flagSet').multiline, false);
  t.is(root.attribute('flagSet', 'ignoreCase'), true);
  t.is(root.childIndex(), null);
  t.assert(root.is('Pattern'));
  t.assert(!root.is('Node'));
  t.notThrows(() => root.assert('Pattern'));
  t.throws(() => root.assert('Node'));

  const child = root.firstChild();
  t.assert(child);
  t.is(child?.root(), root);
  t.is(child?.attribute('type'), 'Disjunction');
  t.is(child?.childIndex(), 0);
  t.is(child?.children().length, 2);
  t.assert(child?.is('Node'));

  t.assert(child?.firstChild()?.is('Sequence'));
  t.assert(child?.lastChild()?.is('Optional'));
  t.deepEqual(child?.firstChild()?.nextSibling()?.node(), child?.lastChild()?.node());
  t.deepEqual(child?.lastChild()?.prevSibling()?.node(), child?.firstChild()?.node());
});

test('mutators', (t) => {
  const root = RENode.load('ab|(cd)?', 'i');

  t.throws(() => root.remove());
  t.throws(() => root.before({ type: 'Sequence', children: [], range: [-1, -1] }));
  t.throws(() => root.after({ type: 'Sequence', children: [], range: [-1, -1] }));

  root
    ?.firstChild()
    ?.firstChild()
    ?.before({
      type: 'Char',
      value: 0x7a,
      raw: 'z',
      range: [-1, -1],
    });
  t.is(patternToString(root.node()), '/z|ab|(cd)?/i');

  root
    ?.firstChild()
    ?.lastChild()
    ?.after({
      type: 'Char',
      value: 0x65,
      raw: 'e',
      range: [-1, -1],
    });
  t.is(patternToString(root.node()), '/z|ab|(cd)?|e/i');

  const child = root?.firstChild()?.children()?.[1];
  t.assert(!child?.isRemoved());
  child?.remove();
  t.is(patternToString(root.node()), '/z|(cd)?|e/i');
  t.assert(child?.isRemoved());
  t.deepEqual(child?.prevSibling()?.node(), root.firstChild()?.firstChild()?.node());
});
