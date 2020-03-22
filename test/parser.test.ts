import test from 'ava';

import { RegExpSyntaxError } from '../src/error';
import { Parser } from '../src/parser';
import { Pattern, patternToString } from '../src/pattern';

type TestCase =
  | {
      source: string;
      result: 'ok';
      unicode?: 'same' | 'diff' | 'error'; // default: `'same'`
      strict?: 'same' | 'diff' | 'error'; // default: `'same'
      patternToString?: boolean; // default: `true`
    }
  | {
      source: string;
      result: 'error';
      unicode?: 'ok' | 'error'; // default: `'error'`
      strict?: 'ok' | 'error'; // default: `'error'`
    };

const testCases: TestCase[] = [
  {
    source: '',
    result: 'ok',
  },
  {
    source: 'a',
    result: 'ok',
  },
  {
    source: 'a|b|c',
    result: 'ok',
  },
  {
    source: 'abc',
    result: 'ok',
  },
  {
    source: 'a*a+a?a{1}a{1,}a{1,2}a*?a+?a??a{1}?a{1,}?a{1,2}?',
    result: 'ok',
  },
  {
    source: String.raw`\b*`,
    result: 'error',
  },
  {
    source: '(?=)*',
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: '*',
    result: 'error',
  },
  {
    source: '+',
    result: 'error',
  },
  {
    source: '?',
    result: 'error',
  },
  {
    source: '{',
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: '{1,2}',
    result: 'error',
  },
  {
    source: 'a{1',
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: 'a{1,b',
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: 'a{2,1}',
    result: 'error',
  },
  {
    source: '}',
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: '[]',
    result: 'ok',
  },
  {
    source: '[^]',
    result: 'ok',
  },
  {
    source: '[-]',
    result: 'ok',
    patternToString: false,
  },
  {
    source: '[a-]',
    result: 'ok',
    patternToString: false,
  },
  {
    source: '[-z]',
    result: 'ok',
    patternToString: false,
  },
  {
    source: '[a-zA-Z0-9_]',
    result: 'ok',
  },
  {
    source: '[z-a]',
    result: 'error',
  },
  {
    source: String.raw`[\b]`,
    result: 'ok',
  },
  {
    source: String.raw`[\--\-]`,
    result: 'ok',
  },
  {
    source: String.raw`[\u1234]`,
    result: 'ok',
  },
  {
    source: String.raw`[\a]`,
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: String.raw`[\w\d]`,
    result: 'ok',
  },
  {
    source: String.raw`[\w-\d]`,
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: String.raw`[w-\w]`,
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: '[',
    result: 'error',
  },
  {
    source: ']',
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: '|',
    result: 'ok',
  },
  {
    source: '.^$',
    result: 'ok',
  },
  {
    source: '\\',
    result: 'error',
  },
  {
    source: String.raw`\d\D\w\W\s\S`,
    result: 'ok',
  },
  {
    source: String.raw`\p{Lu}\P{Lu}`,
    result: 'ok',
    unicode: 'diff',
    strict: 'error',
    patternToString: false,
  },
  {
    source: String.raw`\p{sc=Hira}\P{sc=Hira}`,
    result: 'ok',
    unicode: 'diff',
    strict: 'error',
    patternToString: false,
  },
  {
    source: String.raw`\p{}`,
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: String.raw`\p{sc=}`,
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: String.raw`\p{sc|`,
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: String.raw`\p{sc=Hira|`,
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: String.raw`\p`,
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: String.raw`\b\B`,
    result: 'ok',
  },
  {
    source: String.raw`\0`,
    result: 'ok',
    patternToString: false,
  },
  {
    source: String.raw`\1`,
    result: 'ok',
    unicode: 'diff',
    strict: 'diff',
    patternToString: false,
  },
  {
    source: String.raw`()\1`,
    result: 'ok',
  },
  {
    source: String.raw`\1()`,
    result: 'ok',
  },
  {
    source: String.raw`\01`,
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: String.raw`\012\43`,
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: String.raw`\k<abc>`,
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: String.raw`(?<abc>)\k`,
    result: 'error',
  },
  {
    source: String.raw`(?<abc>)\k<abc>`,
    result: 'ok',
  },
  {
    source: String.raw`\k<abc>(?<abc>)`,
    result: 'ok',
  },
  {
    source: String.raw`\t\n\v\f\r\\\/\^\$\.\[\]\(\)\{\}\*\+\?\|`,
    result: 'ok',
  },
  {
    source: String.raw`\%`,
    result: 'ok',
    unicode: 'error',
    strict: 'same',
    patternToString: false,
  },
  {
    source: String.raw`\cA\ca`,
    result: 'ok',
    patternToString: false,
  },
  {
    source: String.raw`\c`,
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: String.raw`\x11`,
    result: 'ok',
    patternToString: true,
  },
  {
    source: '\\x',
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: String.raw`\u1234`,
    result: 'ok',
  },
  {
    source: String.raw`\uD800\uDC00`,
    result: 'ok',
    unicode: 'diff',
    strict: 'same',
    patternToString: false,
  },
  {
    source: String.raw`\ud800 \udc00`,
    result: 'ok',
  },
  {
    source: String.raw`\ud800\u1234`,
    result: 'ok',
  },
  {
    source: String.raw`\ud800\u{DC00}`,
    result: 'ok',
    unicode: 'diff',
    strict: 'error',
    patternToString: false,
  },
  {
    source: String.raw`\u{10000}`,
    result: 'ok',
    unicode: 'diff',
    strict: 'error',
    patternToString: false,
  },
  {
    source: '\\u{}',
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: '\\u{FFFFFF}',
    result: 'ok',
    unicode: 'error',
    strict: 'error',
    patternToString: false,
  },
  {
    source: '()(?:)(?<foo>)(?=)(?!)(?<=)(?<!)',
    result: 'ok',
  },
  {
    source: '(',
    result: 'error',
  },
  {
    source: '(?:',
    result: 'error',
  },
  {
    source: '(?<abc>',
    result: 'error',
  },
  {
    source: '(?=',
    result: 'error',
  },
  {
    source: '(?!',
    result: 'error',
  },
  {
    source: '(?<=',
    result: 'error',
  },
  {
    source: '(?<!',
    result: 'error',
  },
  {
    source: '(?%',
    result: 'error',
  },
];

const parse = (source: string, flags: string, additional: boolean): Pattern => {
  const parser = new Parser(source, flags, additional);
  return parser.parse();
};

for (const testCase of testCases) {
  test(`parse ${JSON.stringify(testCase.source)}`, (t) => {
    switch (testCase.result) {
      case 'ok': {
        const pattern0 = parse(testCase.source, '', true);
        t.snapshot(pattern0, 'default');
        if (testCase.patternToString ?? true) {
          t.is(patternToString(pattern0), `/${testCase.source}/`);
        } else {
          t.not(patternToString(pattern0), `/${testCase.source}/`);
        }
        for (const variant of ['unicode', 'strict'] as const) {
          const flags = variant === 'unicode' ? 'u' : '';
          const additional = variant !== 'strict';
          switch (testCase[variant]) {
            case 'same':
            case 'diff':
            case undefined: {
              const pattern1 = parse(testCase.source, flags, additional);
              t.snapshot(pattern1, variant);
              if (testCase[variant] === 'diff') {
                t.notDeepEqual(pattern1.child, pattern0.child);
              } else {
                t.deepEqual(pattern1.child, pattern0.child);
              }
              break;
            }
            case 'error': {
              const err = t.throws(
                () => {
                  return parse(testCase.source, flags, additional);
                },
                { instanceOf: RegExpSyntaxError }
              );
              t.snapshot(err, variant);
              break;
            }
          }
        }
        break;
      }
      case 'error': {
        const err0 = t.throws(
          () => {
            return parse(testCase.source, '', true);
          },
          { instanceOf: RegExpSyntaxError }
        );
        t.snapshot(err0, 'default');
        for (const variant of ['unicode', 'strict'] as const) {
          const flags = variant === 'unicode' ? 'u' : '';
          const additional = variant !== 'strict';
          switch (testCase[variant]) {
            case 'error':
            case undefined: {
              const err1 = t.throws(
                () => {
                  return parse(testCase.source, flags, additional);
                },
                { instanceOf: RegExpSyntaxError }
              );
              t.snapshot(err1, variant);
              break;
            }
            case 'ok': {
              const pattern = parse(testCase.source, flags, additional);
              t.snapshot(pattern, variant);
            }
          }
        }
        break;
      }
    }
  });
}

test('flags', (t) => {
  t.deepEqual(parse('', 'gimsuy', true).flagSet, {
    global: true,
    ignoreCase: true,
    multiline: true,
    unicode: true,
    dotAll: true,
    sticky: true,
  });

  for (const c of 'gimsuy') {
    t.throws(() => parse('', c.repeat(2), true), {
      instanceOf: RegExpSyntaxError,
      message: /duplicated/,
    });
  }

  t.throws(() => parse('', 'x', true), { instanceOf: RegExpSyntaxError, message: /unknown flag/ });
});
