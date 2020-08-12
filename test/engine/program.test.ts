import test from 'ava';

import { Compiler } from '../../src/engine/compiler';
import { Program } from '../../src/engine/program';
import { Parser } from '../../src/syntax/parser';

const compile = (source: string, flags: string): Program => {
  const parser = new Parser(source, flags);
  const pattern = parser.parse();
  const compiler = new Compiler(pattern);
  return compiler.compile();
};

type TestCase = {
  source: string;
  flags: string;
  pos?: number; // default: `0`
  matches?: string[]; // default: `[]`
  unmatches?: string[]; // default: `[]`
};

const testCases: TestCase[] = [
  {
    source: '',
    flags: '',
    matches: ['', 'a'],
  },
  {
    source: '.',
    flags: '',
    matches: ['a', 'あ'],
    unmatches: ['', '\n'],
  },
  {
    source: '^.$',
    flags: '',
    matches: ['a', 'あ', '\uD800'],
    unmatches: ['', '\n', '\uD800\uDC00'],
  },
  {
    source: '^.$',
    flags: 'u',
    matches: ['a', 'あ', '\uD800', '\uD800\uDC00'],
    unmatches: ['', '\n'],
  },
  {
    source: 'a',
    flags: '',
    matches: ['a'],
    unmatches: ['b', 'A'],
  },
  {
    source: 'a',
    flags: 'i',
    matches: ['a', 'A'],
    unmatches: ['b'],
  },
  {
    source: 'ß',
    flags: 'i',
    matches: ['ß'],
    unmatches: ['SS', 'ẞ'],
  },
  {
    source: 'ß',
    flags: 'iu',
    matches: ['ß', 'ẞ'],
    unmatches: ['SS'],
  },
  {
    source: 'ſ',
    flags: 'i',
    matches: ['ſ'],
    unmatches: ['s', 'S'],
  },
  {
    source: 'a*',
    flags: '',
    matches: ['', 'a', 'aa'],
    unmatches: [],
  },
  {
    source: 'a{0,}',
    flags: '',
    matches: ['', 'a', 'aa'],
    unmatches: [],
  },
  {
    source: 'a{1,}',
    flags: '',
    matches: ['a', 'aa'],
    unmatches: [''],
  },
  {
    source: '(a?)*',
    flags: '',
    matches: ['', 'a', 'aa'],
    unmatches: [],
  },
  {
    source: '^(?:ab)*$',
    flags: '',
    matches: ['', 'ab', 'abab'],
    unmatches: ['bb', 'bab'],
  },
  {
    source: 'a*',
    flags: 'i',
    matches: ['', 'a', 'aA', 'A', 'Aa'],
    unmatches: [],
  },
  {
    source: String.raw`\w`,
    flags: '',
    matches: ['a', '0', 'A'],
    unmatches: ['-', '\u212A'],
  },
  {
    source: String.raw`\w`,
    flags: 'iu',
    matches: ['a', '0', 'A', '\u212A'],
    unmatches: ['-'],
  },
  {
    source: String.raw`\W`,
    flags: '',
    matches: ['\u212A', '-'],
    unmatches: ['a', '0', 'A'],
  },
  {
    source: String.raw`\W`,
    flags: 'iu',
    matches: ['-'],
    unmatches: ['a', '0', 'A', '\u212A'],
  },
  {
    source: String.raw`\d\s\D\S`,
    flags: '',
    matches: ['0  0'],
    unmatches: ['A  B', '0AB0'],
  },
  {
    source: String.raw`\u212A`,
    flags: 'iu',
    matches: ['k', '\u212A', 'K'],
    unmatches: ['q', '-'],
  },
  {
    source: String.raw`[\u212A]`,
    flags: 'iu',
    matches: ['k', '\u212A', 'K'],
    unmatches: ['q', '-'],
  },
  {
    source: String.raw`[^\u212A]`,
    flags: 'iu',
    matches: ['q', '-'],
    unmatches: ['k', '\u212A', 'K'],
  },
  {
    source: String.raw`[a-z]`,
    flags: '',
    matches: ['a', 'b', 'z'],
    unmatches: ['', 'あ'],
  },
  {
    source: String.raw`\u{10000}`,
    flags: 'u',
    matches: ['\u{10000}'],
    unmatches: ['\\u{10000}'],
  },
  {
    source: String.raw`[\uD800\uDC00]`,
    flags: 'u',
    matches: ['\u{10000}'],
    unmatches: ['\uD800'],
  },
  {
    source: String.raw`\u{ABCD}`,
    flags: '',
    matches: ['u{ABCD}'],
    unmatches: ['\u{ABCD}'],
  },
  {
    source: String.raw`^[\uD800\uDC00]$`,
    flags: '',
    matches: ['\uD800'],
    unmatches: ['\u{10000}'],
  },
  {
    source: '[a-z]',
    flags: 'i',
    matches: ['a', 'z', 'A', 'Z'],
    unmatches: ['ſ'],
  },
  {
    source: '[ǳ]',
    flags: 'i',
    matches: ['ǳ', 'ǲ', 'Ǳ'],
    unmatches: ['DZ'],
  },
  {
    source: '[ǳ]',
    flags: 'iu',
    matches: ['ǳ', 'ǲ', 'Ǳ'],
    unmatches: ['DZ'],
  },
  {
    source: '^abc$',
    flags: '',
    matches: ['abc'],
    unmatches: ['abcd', '\nabc\n'],
  },
  {
    source: '^abc$',
    flags: 'm',
    matches: ['abc', '\nabc\n'],
    unmatches: ['abcd'],
  },
  {
    source: 'a{2,3}',
    flags: '',
    matches: ['aa', 'aaa'],
    unmatches: ['', 'a'],
  },
  {
    source: '^a{2,3}$',
    flags: '',
    matches: ['aa', 'aaa'],
    unmatches: ['', 'a', 'aaaa'],
  },
  {
    source: '^a{2,4}$',
    flags: '',
    matches: ['aa', 'aaa', 'aaaa'],
    unmatches: ['', 'a', 'aaaaa'],
  },
  {
    source: String.raw`\p{sc=Hira}`,
    flags: 'u',
    matches: ['あ'],
    unmatches: ['a'],
  },
  {
    source: String.raw`\p{sc=Hira}`,
    flags: '',
    matches: ['p{sc=Hira}'],
    unmatches: ['あ', 'a'],
  },
  {
    source: String.raw`\P{sc=Hira}`,
    flags: 'u',
    matches: ['a'],
    unmatches: ['あ'],
  },
  {
    source: String.raw`\p{scx=Hira}`,
    flags: 'u',
    matches: ['あ'],
    unmatches: ['a'],
  },
  {
    source: String.raw`\p{scx=Hira}`,
    flags: '',
    matches: ['p{scx=Hira}'],
    unmatches: ['あ', 'a'],
  },
  {
    source: String.raw`\P{scx=Hira}`,
    flags: 'u',
    matches: ['a'],
    unmatches: ['あ'],
  },
  {
    source: String.raw`\p{ASCII}`,
    flags: 'u',
    matches: ['a'],
    unmatches: ['\u212A', 'あ'],
  },
  {
    source: String.raw`\P{ASCII}`,
    flags: 'u',
    matches: ['\u212A', 'あ'],
    unmatches: ['a'],
  },
  {
    source: String.raw`[^\p{ASCII}]`,
    flags: 'ui',
    matches: ['あ'],
    unmatches: ['a', '\u212A'],
  },
  {
    source: String.raw`\p{Lu}`,
    flags: 'u',
    matches: ['A'],
    unmatches: ['/'],
  },
  {
    source: String.raw`\P{Lu}`,
    flags: 'u',
    matches: ['/'],
    unmatches: ['A'],
  },
  {
    source: '^(?=ab).+$',
    flags: '',
    matches: ['ab', 'abc'],
    unmatches: ['aab', 'ba'],
  },
  {
    source: '^(?!ab).+$',
    flags: '',
    matches: ['aab', 'ba'],
    unmatches: ['ab', 'abc'],
  },
  {
    source: '^.+(?<=ab)$',
    flags: '',
    matches: ['ab', 'xab'],
    unmatches: ['a', 'b', 'ba', 'xba'],
  },
  {
    source: '^.+(?<!ab)$',
    flags: '',
    matches: ['a', 'b', 'ba', 'xba'],
    unmatches: ['ab', 'xab'],
  },
  {
    source: String.raw`(a|b)\1{2}`,
    flags: '',
    matches: ['aaa', 'bbb'],
    unmatches: ['aba', 'bab'],
  },
  {
    source: String.raw`^\1(a)$`,
    flags: '',
    matches: ['a'],
    unmatches: ['aa'],
  },
  {
    source: String.raw`^.*(?<=\1(ab))$`,
    flags: '',
    matches: ['abab', 'xabab'],
    unmatches: ['a', 'b', 'ba', 'ab'],
  },
  {
    source: String.raw`^.*(?<=\1(ab))$`,
    flags: 'i',
    matches: ['abab', 'xabab', 'abAB', 'aBAb'],
    unmatches: ['a', 'b', 'ba', 'ab', 'abBa'],
  },
  {
    source: String.raw`^.*(?<=.{2})$`,
    flags: '',
    matches: ['aa', 'ab', '\uD800\uDC00'],
    unmatches: ['', 'a', 'b'],
  },
  {
    source: String.raw`^.*(?<=.{2})$`,
    flags: 'u',
    matches: ['aa', 'ab', '\uD800\uD800'],
    unmatches: ['', 'a', 'b', '\uD800\uDC00'],
  },
  {
    source: String.raw`(a|b)\1{2}`,
    flags: 'i',
    matches: ['aaa', 'aAa', 'bbb', 'BbB'],
    unmatches: ['aba', 'bab'],
  },
  {
    source: String.raw`(?<ch>a|b)\k<ch>{2}`,
    flags: '',
    matches: ['aaa', 'bbb'],
    unmatches: ['aba', 'bab'],
  },
  {
    source: String.raw`\babc\b`,
    flags: '',
    matches: ['abc', ' abc ', ' abc', 'abc '],
    unmatches: ['xabcx'],
  },
  {
    source: String.raw`\Babc\B`,
    flags: '',
    matches: ['xabcx'],
    unmatches: ['abc'],
  },
  {
    source: 'a',
    flags: 'y',
    matches: ['a', 'abc'],
    unmatches: ['xa', 'cba'],
  },
  {
    source: 'a',
    flags: 'y',
    pos: 1,
    matches: ['xa', 'aa'],
    unmatches: ['cba', 'abc'],
  },
  {
    source: String.raw`^(?=(a+))\1$`,
    flags: '',
    matches: ['a', 'aa'],
    unmatches: ['aab'],
  },
  {
    source: String.raw`^.*(?<=\k<\u3042>(?<あ>a))$`,
    flags: '',
    matches: ['aa', 'baa'],
    unmatches: ['aab'],
  },
  {
    source: String.raw`^(?=(a+?))\1{2}$`,
    flags: '',
    matches: ['aa'],
    unmatches: ['aaaa', 'aaab'],
  },
  {
    source: String.raw`^(?:(a)|(b))*\1$`,
    flags: '',
    matches: ['', 'aa', 'aaa', 'aab', 'b', 'bb', 'baa'],
    unmatches: ['a'],
  },
];

for (const testCase of testCases) {
  const { source, flags, pos, matches, unmatches } = testCase;

  test(`exec /${source}/${flags}${pos ? ` (pos=${pos})` : ''}`, (t) => {
    const program = compile(source, flags);

    for (const s of matches ?? []) {
      t.not(program.exec(s, pos), null, s);
    }

    for (const s of unmatches ?? []) {
      t.is(program.exec(s, pos), null, s);
    }
  });
}

test('toString', (t) => {
  const program = compile('^(?:(a)|([b-z]))*\\1$', '');
  let expected = '';
  expected += 'Program {\n';
  expected += '  pattern: /^(?:(a)|([b-z]))*\\1$/,\n';
  expected += '  codes:\n';
  expected += '    #000: cap_begin    0\n';
  expected += '    #001: line_begin   \n';
  expected += '    #002: fork_cont    #013\n';
  expected += '    #003: cap_reset    1 3\n';
  expected += '    #004: fork_cont    #009\n';
  expected += '    #005: cap_begin    1\n';
  expected += "    #006: char         'a'\n";
  expected += '    #007: cap_end      1\n';
  expected += '    #008: jump         #012\n';
  expected += '    #009: cap_begin    2\n';
  expected += '    #010: class        [b-z]\n';
  expected += '    #011: cap_end      2\n';
  expected += '    #012: jump         #002\n';
  expected += '    #013: ref          1\n';
  expected += '    #014: line_end     \n';
  expected += '    #015: cap_end      0\n';
  expected += '    #016: match        \n';
  expected += '}';

  t.is(program.toString(), expected);
});