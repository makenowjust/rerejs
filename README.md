# ReRE.js

<p>
  <b>Re</b>-implementation of ECMA-262 (JavaScript) <code><b>R</b>eg<b>E</b>xp</code>.
</p>

[![codecov](https://codecov.io/gh/MakeNowJust/rerejs/branch/master/graph/badge.svg)](https://codecov.io/gh/MakeNowJust/rerejs)
[![GitHub Actions status](https://github.com/MakeNowJust/rerejs/workflows/test/badge.svg)](https://github.com/MakeNowJust/rerejs/actions)
[![NPM version](https://img.shields.io/npm/v/rerejs)](https://www.npmjs.com/package/rerejs)

## About

ReRE.js is a framework for processing [ECMA-262][] (JavaScript standard) `RegExp`.
It provides:

- **parser** which constructs AST nodes from a `RegExp` pattern string,
- **engine** which executes `RegExp` matching against an input string, and
- **ponyfill** (or **shim**) which is complete and full-featured alternative of `RegExp` class.

ReRE.js supports the latest `RegExp` features:

- look-behind assertion (`(?<=...)`),
- named capture group, named back reference (`(?<foo>...)` and `\k<foo>`), and
- Unicode property class (`\p{ASCII}`).

Moreover, ReRE.js supports ["Additional ECMAScript Features for Web Browsers"][] for `RegExp`.
It means robust, so it can parse some terrible real-world `RegExp` patterns correctly.

[ECMA-262]: https://www.ecma-international.org/ecma-262/10.0/index.html
["Additional ECMAScript Features for Web Browsers"]: https://www.ecma-international.org/ecma-262/10.0/index.html#sec-regular-expressions-patterns

## Getting Started

Install ReRE.js as dependency:

```console
$ npm install rerejs
```

Then, you can start:

```javascript
import {
  // A parser for `RegExp` pattern.
  Parser,
  // A compiler for parsed `RegExp` pattern node.
  Compiler,
  // A ponyfill of `RegExp`.
  RegExpCompat
} from './index';

/*
 * Usage of `Parser`.
 */

// `new Parser` with parsing pattern source and flags,
// then call `parse` method to execute parsing.
const parser = new Parser('a+', 'u');
const pattern = parser.parse();

console.log(pattern);
// => {
//     type: 'Pattern',
//     flagSet: {
//       global: false,
//       ignoreCase: false,
//       multiline: false,
//       unicode: true,
//       dotAll: false,
//       sticky: false
//     },
//     captureParens: 0,
//     names: Map(0) {},
//     child: {
//       type: 'Some',
//       nonGreedy: false,
//       child: { type: 'Char', value: 97, raw: 'a', range: [ 0, 1 ] },
//       range: [ 0, 2 ]
//     },
//     range: [ 0, 2 ]
//   }

/*
 * Usage of `Compiler`.
 */

// `new Compiler` with pattern node, then call `compile` to get `program`.
const compiler = new Compiler(pattern);
const program = compiler.compile();

// `program` is compiled regular expression pattern.
// To execute matching, invoke `exec` method.
// Note that `program` is not `RegExpCompat` instance,
// and `exec` method result is not the same as `RegExp.prototype.exec`.
console.log(program.exec('bbaaabb'));
// => Match [
//      0 [0:0] => '',
//    ]

/*
 * Usage of `RegExpCompat`.
 */

// You cau use `RegExpCompat` like `RegExp` very.
const re = new RegExpCompat('a+', 'u');

console.log(re.exec('bbaaabb'));
// => [ 'aaa', index: 2, input: 'bbaaabb', groups: undefined ]

// Also, you can pass `RegExpCompat` instance to
// `String.prototype.match`, `String.prototype.replace`
// and other methods accepts `RegExp` instance.
console.log('bbaaabb'.match(re));
// => [ 'aaa', index: 2, input: 'bbaaabb', groups: undefined ]
console.log('bbaaabb'.replace(re, 'ccc'));
// => bbcccbb

// You can write `global.RegExp = RegExpCompat;`,
// however it does not work as you expected because
// it does not override `RegExp` literals construction.
```

## Contributing

ReRE.js is *alpha quality* project for now, so there are many bugs and problems.
If you found something, please open an issue.

Especially such reports are needed:

- "There is a different behavior between the browser and ReRE.js."
- "`RegExp` matching goes on infinite-loop. VM Bug?"
- "A typo in comment or  error message is found."

Pull Requests are also welcome.

However I concentrate improving ReRE.js ECMA-262 compatibility for now.
So, I cannot accept a feature request as soon.
Notably, it is out of targets of this project that extending `RegExp` syntax.
(e.g. support `x` flag like  `Perl` regular expression)

## Documents for Developer

There are few documents for now. Sorry.

- [docs/canonicalize.md](docs/canonicalize.md): the explanation of `src/canonicalize.ts`.
- [docs/vm.md](docs/vm.md): the explanation for the VM using ReRE.js on matching.

## License

ReRE.js is licensed under MIT license.

(C) 2020 TSUYUSATO "[MakeNowJust][]" Kitsune

[MakeNowJust]: https://github.com/MakeNowJust
