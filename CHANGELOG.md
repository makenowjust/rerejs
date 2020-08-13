# v0.2.0 (2020-08-13)

Changes:

  - Rename AST property names for consistency.
    - `ClassRange#begin` and `#end` to `#children`
    - `Class#items` to `#children`
  - Rename `Select` AST node to `Disjunction` to follow ECMA-262.
  - Add `Element` type as alias of `Pattern | Node | ClassItem`.
  - Bundle `mjs` file.
  - Fix up an internal directory structure.
  - Allow to call `CharSet#add` for adding one value.
  - Remove `util` module dependency. ([#182](https://github.com/MakeNowJust/rerejs/issues/182))

# v0.1.4 (2020-03-23)

Changes:

  - Keep the source string through `patternToString(new Parser(source).parse)`.
  - Add `RegExpCompat#toString`.

Fixes:

  - Recognize `\u2029` as line terminator character on matching.
  - Use `nodeToString` to get `RegExpCompat#source` string.

# v0.1.3 (2020-03-19)

I mistook publishing `v0.1.2`.
This version is quick fix to this.

# v0.1.2 (2020-03-19)

Fixes:

  - Allow calling `RegExpCompat` without `new`.
  - Fix `RegExpCompat#split` correctly.
  - Fix `RegExpCompat#replace` replacer pattern like `$11` for working `$1` and `1` also.

# v0.1.1 (2020-03-16)

Changes:

  - `patternToString` for `[\b]` pattern returns itself instead `[\x08]` now.
  - Optimize one-more repetition pattern like `a{2,3}`.

Fixes:

  - Fix the compiler for working `{N,}` repetition pattern correctly.
  - Fix the compiler for working `{N,M}` repetition pattern correctly.
  - Fix the compiler for working sequence in look-behind correctly.
  - Fix the compiler for working capture in look-behind correctly.
  - Fix the compiler for working negative look-around pattern correctly.

# v0.1.0 (2020-03-14)

The first release.
