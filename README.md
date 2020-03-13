# ReRE.js

> ECMA-262 standard `RegExp` parser and executor.

## About

ReRE.js is a framework for processing ECMA-262 (JavaScript standard) `RegExp`.
It provides:

- **parser** which constructs AST nodes from a `RegExp` pattern string, and
- **executor** which executes `RegExp` matching against an input string.

ReRE.js supports the latest `RegExp` features:

- look-behind assertion (`(?<=...)`),
- named capture group, named back reference (`(?<foo>...)` and `\k<foo>`), and
- Unicode property class (`\p{ASCII}`).

Moreover, ReRE.js supports ["Additional ECMAScript Features for Web Browsers"](https://www.ecma-international.org/ecma-262/10.0/index.html#sec-regular-expressions-patterns) for `RegExp`.
So, it can parse some broken `RegExp` pattern correctly.

## License

ReRE.js is licensed under MIT license.

(C) 2020 TSUYUSATO "[MakeNowJust][]" Kitsune

[MakeNowJust]: https://github.com/MakeNowJust
