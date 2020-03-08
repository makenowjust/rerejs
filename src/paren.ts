// # paren.ts
//
// > Provides `countParen` function to count parens in string.

/** Counts number of capture group parens in `s`. */
export const countParen = (s: string): number => {
  let paren = 0;
  for (let i = 0; i < s.length; i++) {
    switch (s[i]) {
      case '(':
        // Capture group.
        if (!s.startsWith('(?', i)) {
          paren++;
        }
        // Named capture group.
        if (s.startsWith('(?<', i) && !(s.startsWith('(?<=', i) || s.startsWith('(?<!', i))) {
          paren++;
        }
        break;
      case '\\':
        i++;
        break;
      case '[':
        charClass: for (; i < s.length; i++) {
          switch (s[i]) {
            case '\\':
              i++;
              break;
            case ']':
              break charClass;
          }
        }
        break;
    }
  }
  return paren;
};
