import test from 'ava';

import { RegExpSyntaxError } from '../src/error';
import { Parser } from '../src/parser';
import { patternToString } from '../src/pattern';

test('count capture parens', t => {
  const parse = (s: string): number => new Parser(s).parse().captureParens;

  t.is(parse(''), 0);
  t.is(parse('(())()'), 3);
  t.is(parse('(?:())(?:)'), 1);
  t.is(parse('([\\]()])'), 1);
});

test('collect named captures', t => {
  const parse = (s: string): Map<string, number> => new Parser(s).parse().names;

  t.deepEqual(parse(''), new Map());
  t.deepEqual(parse('(?<foo>)'), new Map([['foo', 1]]));
  t.deepEqual(parse('(?<\\u0061>)'), new Map([['a', 1]]));
  t.deepEqual(
    parse('(?<foo>(?<bar>))(?<baz>)'),
    new Map([
      ['foo', 1],
      ['bar', 2],
      ['baz', 3]
    ])
  );
});

const sources = [
  '',
  '.',
  'abc|def|ghi',
  'a*a+a?a*?a+?a??',
  'a{1,2}a{1,}a{1}',
  '(?:(?:a)(?:b))',
  '(abc|def)*fhi',
  '(?=a)(?!a)(?<=a)(?<!a)',
  String.raw`\f\n\r\t\v`,
  String.raw`\b\B^$`,
  String.raw`\d\D\w\W\s\S`,
  String.raw`()\1`,
  String.raw`(?<abc>)\k<abc>`
];

for (const s of sources) {
  test(`can parse ${JSON.stringify(s)}`, t => {
    const parser = new Parser(s);
    const pattern = parser.parse();
    t.snapshot(pattern);
    t.is(patternToString(pattern), `/${s}/`);
  });
}

const invalids = [
  '(xxx',
  '(?:xxx',
  '(?=xxx',
  '(?<=xxx',
  '(?<!xxx',
  '(?<x>xx',
  'xxx)',
  '[xxx',
  '*',
  '+',
  '?',
  '{1,2}',
  '(?<=x)*',
  '(?<!x)*',
  String.raw`\b*`,
  String.raw`\B*`
];

for (const s of invalids) {
  test(`cause an error on parsing ${JSON.stringify(s)}`, t => {
    t.throws(() => new Parser(s).parse(), { instanceOf: RegExpSyntaxError });
  });
}
