# v0.1.3

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
