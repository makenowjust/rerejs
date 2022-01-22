/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

// TODO: respect the specification more (e.g. throw `TypeError` if `this` is not `RegExp`).
// TODO: add `matchAll` support.

import { Compiler } from '../engine/compiler';
import { Program } from '../engine/program';
import { Parser } from '../syntax/parser';
import { Pattern, nodeToString, flagSetToString, patternToString } from '../syntax/pattern';

const isRegExp = (argument: unknown): boolean => {
  if (argument && typeof argument === 'object') {
    return !!(argument as { [Symbol.match]?: unknown })[Symbol.match];
  }
  return false;
};

const advance = (s: string, i: number, unicode: boolean): number => {
  if (!unicode || i + 1 >= s.length) {
    return i + 1;
  }
  const c = s.codePointAt(i) ?? 0;
  if (0x10000 <= c) {
    return i + 2;
  }
  return i + 1;
};

export const RegExpCompat = ((): typeof RegExp => {
  interface RegExpCompat extends RegExp {
    pattern: Pattern;
    program: Program;
  }

  const klass = function RegExpCompat(this: RegExpCompat, source: any, flags?: string): RegExp {
    if (new.target === undefined) {
      if (isRegExp(source) && flags === undefined) {
        if (source.constructor === RegExpCompat) {
          return source;
        }
      }
      return new (klass as any)(source, flags);
    }

    if (source instanceof RegExp || source instanceof RegExpCompat) {
      if (flags === undefined) {
        flags = (source as RegExp).flags;
      }
      source = (source as RegExp).source;
    }
    source = String(source);

    const parser = new Parser(source, flags, true);
    this.pattern = parser.parse();
    const compiler = new Compiler(this.pattern);
    this.program = compiler.compile();
    return this;
  };

  for (const name of ['$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8', '$9', 'lastMatch']) {
    Object.defineProperty(klass, name, {
      get(): any {
        throw new Error(`RegExpCompat does not support old RegExp.${name} method`);
      },
    });
  }

  (klass as any)[Symbol.species] = klass;

  Object.defineProperty(klass.prototype, 'source', {
    get(this: RegExpCompat): string {
      const n = nodeToString(this.pattern.child);
      return n === '' ? '(?:)' : n;
    },
  });

  Object.defineProperty(klass.prototype, 'flags', {
    get(this: RegExpCompat): string {
      return flagSetToString(this.pattern.flagSet);
    },
  });

  for (const flag of [
    'global',
    'ignoreCase',
    'multiline',
    'dotAll',
    'unicode',
    'sticky',
  ] as const) {
    Object.defineProperty(klass.prototype, flag, {
      get(this: RegExpCompat): boolean {
        return this.pattern.flagSet[flag];
      },
    });
  }

  klass.prototype.compile = function compile(this: RegExpCompat): RegExpCompat {
    return this;
  };

  klass.prototype.toString = function toString(this: RegExpCompat): string {
    return patternToString(this.pattern);
  };

  klass.prototype.exec = function exec(this: RegExpCompat, string: string): RegExpExecArray | null {
    const update = this.global || this.sticky;

    let pos = 0;
    if (update) {
      pos = this.lastIndex;
    }
    const match = this.program.exec(string, pos);
    if (update) {
      this.lastIndex = match?.lastIndex ?? 0;
    }

    return match?.toArray() ?? null;
  };

  klass.prototype.test = function test(this: RegExpCompat, string: string): boolean {
    return !!this.exec(string);
  };

  klass.prototype[Symbol.match] = function (
    this: RegExpCompat,
    string: string
  ): RegExpMatchArray | null {
    if (this.global) {
      this.lastIndex = 0;
      const result: string[] = [];
      for (; ;) {
        const r = this.exec(string);
        if (r) {
          result.push(r[0]);
          if (r[0] === '') {
            this.lastIndex = advance(string, this.lastIndex, this.unicode);
          }
        } else {
          break;
        }
      }
      return result.length === 0 ? null : result;
    }
    return this.exec(string);
  };

  klass.prototype[Symbol.replace] = function (
    this: RegExpCompat,
    string: string,
    replacer: string | ((substring: string, ...args: any[]) => string)
  ): string {
    const matches: RegExpMatchArray[] = [];
    if (this.global) {
      this.lastIndex = 0;
    }

    // Collect matches to replace.
    // It must be done before building result string because
    // the replacer function calls `this.exec` and changes `this.lastIndex` maybe.
    for (; ;) {
      const match = this.exec(string);
      if (!match) {
        break;
      }
      matches.push(match);
      if (!this.global) {
        break;
      }
      if (match[0] === '') {
        this.lastIndex = advance(string, this.lastIndex, this.unicode);
      }
    }

    // Build a result string.
    let pos = 0;
    let result = '';
    for (const match of matches) {
      result += string.slice(pos, match.index);
      pos = match.index! + match[0].length;
      if (typeof replacer === 'function') {
        const args: [string, ...any[]] = [match[0], ...match.slice(1), match.index, string] as any;
        if (match.groups) {
          args.push(match.groups);
        }
        result += String(replacer(...args));
      } else {
        let i = 0;
        for (; ;) {
          const j = replacer.indexOf('$', i);
          result += replacer.slice(i, j === -1 ? string.length : j);
          if (j === -1) {
            break;
          }
          const c = replacer[j + 1];
          switch (c) {
            case '$':
              i = j + 2;
              result += '$';
              break;
            case '&':
              i = j + 2;
              result += match[0];
              break;
            case '`':
              i = j + 2;
              result += string.slice(0, match.index);
              break;
            case "'":
              i = j + 2;
              result += string.slice(pos);
              break;
            case '<': {
              const k = replacer.indexOf('>', j + 2);
              if (this.pattern.names.size === 0 || k === -1) {
                i = j + 2;
                result += '$<';
                break;
              }
              const name = replacer.slice(j + 2, k);
              result += (match.groups && match.groups[name]) ?? '';
              i = k + 1;
              break;
            }
            default: {
              if ('0' <= c && c <= '9') {
                const d = replacer[j + 2];
                const s = '0' <= d && d <= '9' ? c + d : c;
                let n = Number.parseInt(s, 10);
                if (0 < n && n < match.length) {
                  result += match[n] ?? '';
                  i = j + 1 + s.length;
                  break;
                }
                n = Math.floor(n / 10);
                if (0 < n && n < match.length) {
                  result += match[n] ?? '';
                  i = j + s.length;
                  break;
                }
              }
              result += '$';
              i = j + 1;
              break;
            }
          }
        }
      }
    }

    result += string.slice(pos);
    return result;
  };

  klass.prototype[Symbol.search] = function (this: RegExpCompat, string: string): number {
    const prevLastIndex = this.lastIndex;
    this.lastIndex = 0;
    const m = this.exec(string);
    this.lastIndex = prevLastIndex;
    return (m && m.index) ?? -1;
  };

  klass.prototype[Symbol.split] = function (
    this: RegExpCompat,
    string: string,
    limit?: number
  ): string[] {
    const flags = this.sticky ? this.flags : this.flags + 'y';
    const constructor: any = this.constructor;
    const species = (constructor && constructor[Symbol.species]) ?? klass;
    const splitter: RegExp = new species(this.source, flags);
    limit = (limit ?? 2 ** 32 - 1) >>> 0;

    const result: string[] = [];
    if (limit === 0) {
      return result;
    }

    // Special case for empty string.
    if (string.length === 0) {
      const match = splitter.exec(string);
      if (match === null) {
        result.push(string);
      }
      return result;
    }

    let p = 0;
    let q = p;
    while (q < string.length) {
      splitter.lastIndex = q;
      const match = splitter.exec(string);
      if (match === null) {
        q = advance(string, q, this.unicode);
        continue;
      }

      const e = Math.min(splitter.lastIndex, string.length);
      if (e === p) {
        q = advance(string, q, this.unicode);
        continue;
      }

      const t = string.slice(p, q);
      result.push(t);
      if (limit === result.length) {
        return result;
      }
      p = e;
      for (let i = 1; i < match.length; i++) {
        result.push(match[i]);
        if (limit === result.length) {
          return result;
        }
      }

      q = p;
    }

    const t = string.slice(p);
    result.push(t);
    return result;
  };

  return klass as any;
})();
