/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

// TODO: respect the specification more (e.g. throw `TypeError` if `this` is not `RegExp`).
// TODO: add `matchAll` support.

import { Compiler } from './compiler';
import { Parser } from './parser';
import { Pattern, flagSetToString } from './pattern';
import { Program } from './program';

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

class RegExpCompat implements RegExp {
  public static get $1(): string {
    throw new Error('RegExpCompat does not support old-style RegExp.$N methods');
  }

  public static get $2(): string {
    throw new Error('RegExpCompat does not support old-style RegExp.$N methods');
  }

  public static get $3(): string {
    throw new Error('RegExpCompat does not support old-style RegExp.$N methods');
  }

  public static get $4(): string {
    throw new Error('RegExpCompat does not support old-style RegExp.$N methods');
  }

  public static get $5(): string {
    throw new Error('RegExpCompat does not support old-style RegExp.$N methods');
  }

  public static get $6(): string {
    throw new Error('RegExpCompat does not support old-style RegExp.$N methods');
  }

  public static get $7(): string {
    throw new Error('RegExpCompat does not support old-style RegExp.$N methods');
  }

  public static get $8(): string {
    throw new Error('RegExpCompat does not support old-style RegExp.$N methods');
  }

  public static get $9(): string {
    throw new Error('RegExpCompat does not support old-style RegExp.$N methods');
  }

  public static get lastMatch(): string {
    throw new Error('RegExpCompat does not support old-style RegExp.lastMatch');
  }

  public static [Symbol.species] = RegExpCompat;

  public readonly source!: string;

  public lastIndex = 0;

  private pattern!: Pattern;
  private program!: Program;

  public get flags(): string {
    return flagSetToString(this.pattern.flagSet);
  }

  public get global(): boolean {
    return this.pattern.flagSet.global;
  }

  public get ignoreCase(): boolean {
    return this.pattern.flagSet.ignoreCase;
  }

  public get multiline(): boolean {
    return this.pattern.flagSet.multiline;
  }

  public get unicode(): boolean {
    return this.pattern.flagSet.unicode;
  }

  public get dotAll(): boolean {
    return this.pattern.flagSet.dotAll;
  }

  public get sticky(): boolean {
    return this.pattern.flagSet.sticky;
  }

  constructor(pattern: RegExp | string);
  constructor(pattern: string, flags?: string);
  constructor(source: any, flags?: string) {
    if (new.target === undefined) {
      if (isRegExp(source) && flags === undefined) {
        if (source.constructor === RegExpCompat) {
          return source;
        }
      }
      return new RegExpCompat(source, flags);
    }

    if (source instanceof RegExp || source instanceof RegExpCompat) {
      source = source.source;
      if (flags === undefined) {
        flags = source.flags;
      }
    }

    this.source = String(source);

    const parser = new Parser(this.source, flags, true);
    this.pattern = parser.parse();
    const compiler = new Compiler(this.pattern);
    this.program = compiler.compile();
  }

  public exec(string: string): RegExpExecArray | null {
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
  }

  public test(string: string): boolean {
    return !!this.exec(string);
  }

  public compile(): this {
    return this;
  }

  public [Symbol.match](string: string): RegExpMatchArray | null {
    if (this.global) {
      this.lastIndex = 0;
      const result: string[] = [];
      for (;;) {
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
  }

  public [Symbol.replace](
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
    for (;;) {
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
        const args: [string, ...any[]] = [match[0], ...match.slice(1), match.index] as any;
        if (match.groups) {
          args.push(match.groups);
        }
        result += String(replacer(...args));
      } else {
        let i = 0;
        for (;;) {
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
                const n = Number.parseInt(s, 10);
                if (0 < n && n < match.length) {
                  result += match[n] ?? '';
                  i = j + 1 + s.length;
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
  }

  public [Symbol.search](string: string): number {
    const prevLastIndex = this.lastIndex;
    this.lastIndex = 0;
    const m = this.exec(string);
    this.lastIndex = prevLastIndex;
    return (m && m.index) ?? -1;
  }

  public [Symbol.split](string: string, limit?: number): string[] {
    const flags = this.sticky ? this.flags : this.flags + 'y';
    const splitter = new RegExpCompat(this.source, flags);
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
      if (limit === t.length) {
        return result;
      }
      p = e;
      for (let i = 1; i < match.length; i++) {
        result.push(match[i]);
        if (limit === t.length) {
          return result;
        }
      }
    }

    const t = string.slice(p);
    result.push(t);
    return result;
  }
}

// Make `RegExpCompat` as `global.RegExp` assinable.
// It is hard because `class` cannot implement call signatures,
// however `typeof RegExp` has call signatures.
// So this hack is needed.
const _RegExpCompat: typeof RegExp = RegExpCompat as any;
export { _RegExpCompat as RegExpCompat };
