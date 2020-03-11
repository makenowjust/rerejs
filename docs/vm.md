# VM

## Structure

This describes the structure of the VM to execute regular expression
pattern matching. And also, `proc` is described.

The VM has four flags:

- `ignoreCase`
- `multiline`
- `unicode`
- `dotAll`

These flags are set on initialize of the VM, reflecting the pattern,
and they are never changed on execution.

Moreover, the VM has the `input` string for matching
and `codes` which is an array of op-codes compiled from the pattern.

The VM manages matching state named `proc` on excution.
It has the following fields:

- `id`: identity number of this `proc`.
- `pc`: a program counter, which is the index of `code` array.
- `pos`: a position of `input` string.
- `stack`: a stack containing repeat couters, positions and ids.
- `caps`: capturs on this `proc`.
- `fail`:  a failure continuation, which is the `id` to backtrack on failed.

Note that `id` is given by the VM on created, and it is never changed.
The VM does not take the same `id` to another `proc`, and `id` is increasing on each take.

Finally, the VM matching is shown as the below pseudo code list:

```
match() {
  create `proc` with `pc = 0`, `pos = 0` and other fields are empty
  while (true) {
    execute op-code pointed by `pc`
    if (backtrack) {
      set current `proc` to `fail`,
        or halt VM as unmatched
    }
  }
}
```

Sometimes, the VM forks `proc`. It means the VM creates the copy of the current `proc`
and set its `fail` to the current `proc`'s `fail`, then the current `proc`'s `fail` to
the new `proc`'s `id`.

## Op-codes

A list of op-codes (in alphabetical order):

- `any`
- `back`
- `cap_begin i`
- `cap_end i`
- `cap_reset i j`
- `char c`
- `class s`
- `class_not s`
- `dec`
- `empty_check`
- `fail`
- `fork_cont #next`
- `fork_next #next`
- `jump #cont`
- `line_begin`
- `line_end`
- `loop #cont`
- `match`
- `pop`
- `push n`
- `push_pos`
- `push_proc`
- `ref i`
- `ref_back i`
- `restore_pos`
- `rewind_proc`
- `word_boundary`
- `word_boundary_not`

Detailed explanations are below.

### `any`

Advance `pos` by the current character size.
However, if `dotAll` flag is `false`, don't advance `pos`.

If `pos` is not changed, do backtrack.

This op-code is corresponding to `.` in pattern.

### `back`

Go back `pos` to the previous character.

This op-code is inserted around some op-codes advancing `pos`
inside look-behind assertion `(?<=...)` and `(?!...)`.

### `cap_begin i`

Save the current `pos` as the begin position of the capture `i`.

`cap_begin` and `cap_end` surround op-codes inside capture group `(...)`.
And, it is inserted inside look-behind assertion, `cap_begin` and `cap_end` are swapped.

### `cap_end i`

Save the current `pos` as the end position of the capture `i`.

### `cap_reset i j`

Reset begin and end positions of between capture `i` and `j`.

This op-code is needed for working capture groups inside optional loop like `?` or `*`.

### `char c`

Try to match the current character with the character `c`.
If matched, advance `pos` by the current character size, or else do backtrack.

### `class s`

Try to match the current character with the character set `s`.
If matched, advance `pos` by the current character size, or else do backtrack.

### `class_not s`

Try to match the current character with the character set `s`.
If not matched, advance `pos` by the current character size, or else do backtrack.

### `dec`

Decrement `stack` top value.

This op-code is used with `push` and `loop` for repetition `{n,m}`.

### `empty_check`

Pop the old `pos` from `stack`, anc compare with the current `pos`.
If they equal, it means "no advancing in this group`, so do backtrack.

This op-code is needed for preventing infinite loop caused by nullable loop like `(a?)*`.

### `fail`

Fail the current `proc`, so do backtrack.

### `fork_cont #next`

Fork a new `proc` and set the new `proc`'s `pc` to `#next`.
And continue the current `proc`.

This op-code is used for an entry of greedy loop.

### `fork_next #next`

Fork a new `proc` and set the new `proc`'s `pc` to `#next`.
And switch to the new `proc`.
Now, the new `proc`'s `fail` refers to the current (old) `proc`'s `id`.

This op-code is used for an entry of non-greedy loop.

### `jump #cont`

Set the current `pc` to `#cont`.

### `line_begin`

If `pos` is `0`, it is matched.
Or, when `multiline` flag is `true` and the current character is a line terminator,
then it is matched.

If not matched, do backtrack.

This op-code is corresponding to line-begin assertion `^`.

### `line_end`

If `pos` is `input` size, it is matched.
Or, when `multiline` flag is `true` and the current character is a line terminator,
then it is matched.

If not matched, do backtrack.

This op-code is corresponding to line-end assertion `$`.

### `loop #cont`

If the `stack` top value is greater than `0`, set the current `pc` to `#cont`.

### `match`

Halt VM execution as matched.

### `pop`

Pop the `stack` top value from `stack`.

### `push n`

Push an integer value `n` to `stack`.

### `push_pos`

Push the current `pos` to `stack`.

### `push_proc`

Push the current `id` to `stack`.

### `ref i`

Try to match the capture `i` from the current `pos`.
If matched, advance `pos` by the capture `i` size.

If not matched, do backtrack.

Note that unmatched capture behaves like an empty string.

### `ref_back i`

Try to match the capture `i` from the current `pos` in reverse order.
If matched, go back `pos` by the capture `i` size.

If not matched, do backtrack.

Note that unmatched capture behaves like an empty string.

### `restore_pos`

Pop the old `pos` from `stack` and set it to the current `pos`.

### `rewind_proc`

Pop the `id` from `stack` and rewind `proc` to this `id`.

"Rewind" means to kill `proc`s having greater-or-equal `id` without the current `proc`.

### `word_boundary`

When the current character is word character and
the previous character is not word character or vice versa,
it is matched.

If not matched, do backtrack.

This op-code is corresponding to word boundary assertion `\b`.

### `word_boundary_not`

When the current character is word character and
the previous character is not word character or vice versa,
it is not matched.

If not matched, do backtrack.

This op-code is corresponding to not word boundary assertion `\B`.

## Reference

The VM is intended to implement ECMA-262 `RegExp` pattern matching,
so the ECMA-262 specification is good reference of course.

- <https://www.ecma-international.org/ecma-262/10.0/index.html#sec-pattern-semantics>

This VM structure and op-codes are influenced by the QuickJS's regular expression VM implementation.

- <https://github.com/ldarren/QuickJS/blob/mod/libregexp.c>
- <https://github.com/ldarren/QuickJS/blob/mod/libregexp.h>
- <https://github.com/ldarren/QuickJS/blob/mod/libregexp-opcode.h>

Thanks to QuickJS authors!
