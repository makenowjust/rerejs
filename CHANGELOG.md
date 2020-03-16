# v0.1.1 (dev)

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
