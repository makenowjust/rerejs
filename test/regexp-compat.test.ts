import test from 'ava';

import { RegExpCompat } from '../src/regexp-compat';

test('legacy methods', (t) => {
  t.throws(() => RegExpCompat.$1);
  t.throws(() => RegExpCompat.$2);
  t.throws(() => RegExpCompat.$3);
  t.throws(() => RegExpCompat.$4);
  t.throws(() => RegExpCompat.$5);
  t.throws(() => RegExpCompat.$6);
  t.throws(() => RegExpCompat.$7);
  t.throws(() => RegExpCompat.$8);
  t.throws(() => RegExpCompat.$9);
  t.throws(() => RegExpCompat.lastMatch);

  const re = new RegExpCompat('');
  t.is(re.compile(), re);
});

test('constructor', (t) => {
  const r0 = new RegExpCompat('a');
  t.is(r0.source, 'a');
  t.is(r0.flags, '');

  t.is(RegExpCompat(r0), r0);

  const r1 = new RegExpCompat(r0);
  t.not(r1, r0);
  t.is(r1.source, 'a');
  t.is(r1.flags, '');

  const r2 = new RegExpCompat(r0, 'ims');
  t.is(r2.source, 'a');
  t.is(r2.flags, 'ims');

  const r3 = RegExpCompat(r0, 'ims');
  t.is(r3.source, 'a');
  t.is(r3.flags, 'ims');

  const r4 = new RegExpCompat(/a/u);
  t.is(r4.source, 'a');
  t.is(r4.flags, 'u');

  const r5 = RegExpCompat(/a/u);
  t.is(r5.source, 'a');
  t.is(r5.flags, 'u');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t.is(RegExpCompat(1 as any).source, '1');
});

type TestCase = {
  source: string;
  flags: string;
  strings: string[];
};

const testCases: TestCase[] = [
  {
    source: '',
    flags: '',
    strings: ['', 'a'],
  },
  {
    source: '.',
    flags: 'g',
    strings: ['', 'a', '\ud800\udc00'],
  },
  {
    source: '.',
    flags: 'ug',
    strings: ['', 'a', '\ud800\udc00'],
  },
  {
    source: 'a',
    flags: 'ug',
    strings: ['', 'a', 'abcd', '\ud800\udc00', '\ud800'],
  },
  {
    source: 'a*',
    flags: 'g',
    strings: ['bb', 'aba', 'bbbab', 'babaab'],
  },
  {
    source: 'a*',
    flags: 'gy',
    strings: ['bb', 'aba', 'bbbab', 'babaab'],
  },
  {
    source: '$',
    flags: 'm',
    strings: ['abc', 'abc\n'],
  },
  {
    source: '(a)|(bb)',
    flags: '',
    strings: ['a', 'bb', 'bab', 'bba'],
  },
  {
    source: '(?:(?<a>a)|(?<b>bb))*',
    flags: '',
    strings: ['a', 'bb', 'bab', 'bba', 'abb'],
  },
  {
    source: 'a|bb',
    flags: 'y',
    strings: ['a', 'bb', 'bab'],
  },
];

for (const testCase of testCases) {
  test(`compat /${testCase.source}/${testCase.flags}`, (t) => {
    const r0 = new RegExp(testCase.source, testCase.flags);
    const r1 = new RegExpCompat(testCase.source, testCase.flags);

    for (const s of testCase.strings) {
      r0.lastIndex = r1.lastIndex = 0;
      const m0 = r0.exec(s);
      const m1 = r1.exec(s);
      t.deepEqual(m1, m0, `exec ${JSON.stringify(s)}`);
      t.is(r1.lastIndex, r0.lastIndex, `exec ${JSON.stringify(s)}`);
    }

    for (const s of testCase.strings) {
      r0.lastIndex = r1.lastIndex = 0;
      const b0 = r0.test(s);
      const b1 = r1.test(s);
      t.is(b1, b0, `test ${JSON.stringify(s)}`);
      t.is(r1.lastIndex, r0.lastIndex, `test ${JSON.stringify(s)}`);
    }

    for (const s of testCase.strings) {
      r0.lastIndex = r1.lastIndex = 0;
      const a0 = s.match(r0);
      const a1 = s.match(r1);
      t.deepEqual(a1, a0, `match ${JSON.stringify(s)}`);
      t.is(r1.lastIndex, r0.lastIndex, `match ${JSON.stringify(s)}`);
    }

    for (const s of testCase.strings) {
      const i0 = s.search(r0);
      const i1 = s.search(r1);
      t.deepEqual(i1, i0, `search ${JSON.stringify(s)}`);
    }

    for (const s of testCase.strings) {
      for (const limit of [undefined, 0, 2, 5]) {
        const a0 = s.split(r0, limit);
        const a1 = s.split(r1, limit);
        t.deepEqual(a1, a0, `split ${JSON.stringify(s)}, limit ${limit}`);
      }
    }
  });
}

type ReplaceTestCase = {
  source: string;
  flags: string;
  string: string;
  replacer: string;
};

const replaceTestCases: ReplaceTestCase[] = [
  {
    source: ' ',
    flags: '',
    string: 'hello world',
    replacer: 'xxx',
  },
  {
    source: ' ',
    flags: 'g',
    string: ' hello world ',
    replacer: 'xxx',
  },
  {
    source: '',
    flags: 'g',
    string: 'hello world',
    replacer: 'x',
  },
  {
    source: 'x',
    flags: 'y',
    string: 'xxx',
    replacer: 'a',
  },
  {
    source: 'x',
    flags: 'y',
    string: 'axx',
    replacer: 'a',
  },
  {
    source: ' ',
    flags: 'g',
    string: ' hello world ',
    replacer: '$',
  },
  {
    source: ' ',
    flags: 'g',
    string: ' hello world ',
    replacer: '$$',
  },
  {
    source: ' ',
    flags: 'g',
    string: ' hello world ',
    replacer: '$0',
  },
  {
    source: ' ',
    flags: 'g',
    string: ' hello world ',
    replacer: '$<x>',
  },
  {
    source: ' ',
    flags: 'g',
    string: ' hello world ',
    replacer: "$`$&$'",
  },
  {
    source: '([l])\\1',
    flags: 'g',
    string: 'hello world',
    replacer: '$&$1$2',
  },
  {
    source: '()'.repeat(9) + '([l])\\10',
    flags: 'g',
    string: 'hello world',
    replacer: '$&$10$11',
  },
  {
    source: '(?<l>[l])',
    flags: 'g',
    string: 'hello world',
    replacer: '$<x>$<l>',
  },
];

for (const testCase of replaceTestCases) {
  const { source, flags, string, replacer } = testCase;
  test(`replace /${source}/${flags} against ${JSON.stringify(string)} by ${replacer}`, (t) => {
    const r0 = new RegExp(source, flags);
    const r1 = new RegExpCompat(source, flags);

    const s0 = string.replace(r0, replacer);
    const s1 = string.replace(r1, replacer);
    t.is(s1, s0);

    const as0: unknown[][] = [];
    const as1: unknown[][] = [];
    string.replace(r0, (...args: unknown[]) => {
      as0.push(args);
      return '';
    });
    string.replace(r1, (...args: unknown[]) => {
      as1.push(args);
      return '';
    });
    t.deepEqual(as1, as0);
  });
}
