// # program.ts
//
// > Provides a `Program` type which is executor of op-codes.

import assert from 'assert';

import * as char from './char';
import { escape } from './escape';
import { Match } from './match';
import * as op from './op';

/** `Proc` is a execution state on matching. */
class Proc {
  public pos: number;
  public pc: number;
  public stack: StackItem[];
  public begins: (number | undefined)[];
  public ends: (number | undefined)[];

  constructor(
    pos = 0,
    pc = 0,
    stack: StackItem[] = [],
    begins: (number | undefined)[] = [],
    ends: (number | undefined)[] = []
  ) {
    this.pos = pos;
    this.pc = pc;
    this.stack = stack;
    this.begins = begins;
    this.ends = ends;
  }

  public clone(): Proc {
    return new Proc(
      this.pos,
      this.pc,
      Array.from(this.stack),
      Array.from(this.begins),
      Array.from(this.ends)
    );
  }

  public toMatch(s: string, names: Map<string, number>, paren: number): Match {
    while (this.begins.length <= paren) {
      this.begins.push(undefined);
    }
    while (this.ends.length <= paren) {
      this.ends.push(undefined);
    }
    return new Match(s, this.begins, this.ends, names);
  }

  public toString(): string {
    const pos = (i: number): string => `@${i}`;
    const pc = (i: number): string => `#${i.toString().padStart(3, '0')}`;

    const stack = Array.from(this.stack)
      .reverse()
      .map(item => {
        if ('pos' in item) return pos(item.pos);
        if ('cnt' in item) return item.cnt.toString();
        if ('proc' in item) return item.proc.toString();
        throw new Error('unknown stack item');
      })
      .join(', ');

    return `${pc(this.pc)} ${pos(this.pos)} [${stack}]`;
  }
}

type StackPos = { readonly pos: number };
type StackCnt = { readonly cnt: number };
type StackProc = { readonly proc: number };
type StackItem = StackPos | StackCnt | StackProc;

function assertStackPos(item: StackItem | undefined): asserts item is StackPos {
  assert(item && 'pos' in item, 'BUG: the stack top item must pos');
}

function assertStackCnt(item: StackItem | undefined): asserts item is StackCnt {
  assert(item && 'cnt' in item, 'BUG: the stack top item must be cnt');
}

function assertStackProc(item: StackItem | undefined): asserts item is StackProc {
  assert(item && 'proc' in item, 'BUG: the stack top item must be proc');
}

/** `Program` is a compiled regular expression. */
export class Program {
  private readonly codes: readonly op.Code[];

  private readonly ignoreCase: boolean;
  private readonly multiline: boolean;
  private readonly unicode: boolean;
  private readonly sticky: boolean;
  private readonly dotAll: boolean;

  private readonly paren: number;
  private readonly names: Map<string, number>;

  constructor(
    codes: op.Code[],
    ignoreCase: boolean,
    multiline: boolean,
    unicode: boolean,
    sticky: boolean,
    dotAll: boolean,
    paren: number,
    names: Map<string, number>
  ) {
    this.codes = codes;
    this.ignoreCase = ignoreCase;
    this.multiline = multiline;
    this.unicode = unicode;
    this.sticky = sticky;
    this.dotAll = dotAll;
    this.paren = paren;
    this.names = names;
  }

  public toString(): string {
    const pc = (i: number): string => `#${i.toString().padStart(3, '0')}`;
    const char = (c: number): string => `'${escape(c)}'`;
    const op = (s: string): string => s.padEnd(14, ' ');

    const lines = this.codes.map((code, i) => {
      let line = `${pc(i)}: ${op(code.op)}`;

      switch (code.op) {
        case 'fork':
        case 'jump':
          line += ` ${pc(code.offset + 1 + i)}`;
          break;

        case 'jump-cnt-lt':
          line += ` ${code.value}, ${pc(code.offset + 1 + i)}`;
          break;

        case 'assert-cnt-lt':
          line += ` ${code.value}`;
          break;

        case 'cap-begin':
          line += ` ${code.index}`;
          break;

        case 'cap-end':
          line += ` ${code.index}${code.swap ? ' swap' : ''}`;
          break;

        case 'char':
          line += ` ${char(code.value)}`;
          break;

        case 'class':
          line += ` ${code.set.toRegExpString(code.invert)}`;
          break;

        case 'back-ref':
          line += ` ${code.index}${code.backward ? ' backward' : ''}`;
          break;

        case 'assert-char':
          line += ` ${code.kind}`;
          break;
      }

      return `  ${line}\n`;
    });

    return `Program{\n${lines.join('')}}`;
  }

  /**
   * Executes matching against an input string `s`.
   */
  public exec(s: string, pos = 0): Match | null {
    for (let i = pos; i <= s.length; i++) {
      const procs = [];
      procs.push(new Proc(i));

      while (procs.length > 0) {
        const proc: Proc = procs[procs.length - 1];
        const code = this.codes[proc.pc];
        let backtrack = false;
        proc.pc++;

        switch (code.op) {
          case 'ok':
            return proc.toMatch(s, this.names, this.paren);

          case 'fork':
            {
              const [oldProc, newProc] = [proc, proc.clone()];
              procs.push(newProc);
              oldProc.pc += code.offset;
            }
            break;

          case 'jump':
            proc.pc += code.offset;
            break;

          case 'save-pos':
            proc.stack.push({ pos: proc.pos });
            break;

          case 'assert-pos-ne':
            {
              const item = proc.stack[proc.stack.length - 1];
              assertStackPos(item);
              if (item.pos === proc.pos) {
                backtrack = true;
              }
            }
            break;

          case 'restore-pos':
            {
              const item = proc.stack.pop();
              assertStackPos(item);
              proc.pos = item.pos;
            }
            break;

          case 'pop-pos':
            assertStackPos(proc.stack.pop());
            break;

          case 'push-cnt':
            proc.stack.push({ cnt: 0 });
            break;

          case 'jump-cnt-lt':
            {
              const item = proc.stack[proc.stack.length - 1];
              assertStackCnt(item);
              if (item.cnt < code.value) {
                proc.pc += code.offset;
              }
            }
            break;

          case 'assert-cnt-lt':
            {
              const item = proc.stack[proc.stack.length - 1];
              assertStackCnt(item);
              if (item.cnt >= code.value) {
                backtrack = true;
              }
            }
            break;

          case 'inc-cnt':
            {
              const item = proc.stack[proc.stack.length - 1];
              assertStackCnt(item);
              proc.stack[proc.stack.length - 1] = { cnt: item.cnt + 1 };
            }
            break;

          case 'pop-cnt':
            proc.stack.pop();
            break;

          case 'save-proc':
            proc.stack.push({ proc: procs.length });
            break;

          case 'fail-look-around':
            {
              const item = proc.stack.pop();
              assertStackProc(item);
              proc.stack.length = item.proc;
              backtrack = true;
            }
            break;

          case 'pop-proc':
            assertStackProc(proc.stack.pop());
            break;

          case 'cap-begin':
            proc.begins[code.index] = proc.pos;
            proc.ends[code.index] = undefined;
            break;

          case 'cap-end':
            if (code.swap) {
              proc.ends[code.index] = proc.begins[code.index];
              proc.begins[code.index] = proc.pos;
            } else {
              proc.ends[code.index] = proc.pos;
            }
            break;

          case 'char':
            {
              const c = char.index(s, proc.pos, this.unicode);
              if (c !== -1 && char.canonicalize(c, this.ignoreCase, this.unicode) === code.value) {
                proc.pos += char.size(c);
              } else {
                backtrack = true;
              }
            }
            break;

          case 'class':
            {
              const c = char.index(s, proc.pos, this.unicode);
              if (c === -1) {
                backtrack = true;
              } else {
                const d = char.canonicalize(c, this.ignoreCase, this.unicode);
                const ok = !code.invert;
                if (
                  ok ===
                  char.uncanonicalize(d, this.ignoreCase, this.unicode).some(d => code.set.has(d))
                ) {
                  proc.pos += char.size(c);
                } else {
                  backtrack = true;
                }
              }
            }
            break;

          case 'any-char':
            {
              const c = char.index(s, proc.pos, this.unicode);
              if (c !== -1 && (this.dotAll || char.isLineTerminator(c))) {
                proc.pos += char.size(c);
              } else {
                backtrack = true;
              }
            }
            break;

          case 'back-ref':
            {
              const i = proc.begins[code.index];
              const j = proc.ends[code.index];
              if (i !== undefined && j !== undefined) {
                const t = s.slice(i, j);
                if (code.backward) {
                  if (s.endsWith(t, proc.pos)) {
                    proc.pos -= t.length;
                  } else {
                    backtrack = true;
                  }
                } else {
                  if (s.startsWith(t, proc.pos)) {
                    proc.pos += t.length;
                  } else {
                    backtrack = true;
                  }
                }
              }
              // When capture is invalid, it must be success.
            }
            break;

          case 'assert-char':
            switch (code.kind) {
              case 'begin':
                {
                  let ok = proc.pos === 0;
                  // It is not needed to get a character by using `char.index`,
                  // because all line terminator characters are less than U+10000
                  // and it is not need to calculate a character size for updates.
                  if (!ok && this.multiline) {
                    ok = char.isLineTerminator(s.charCodeAt(proc.pos - 1));
                  }
                  if (!ok) {
                    backtrack = true;
                  }
                }
                break;

              case 'end':
                {
                  let ok = proc.pos === s.length;
                  if (!ok && this.multiline) {
                    ok = char.isLineTerminator(s.charCodeAt(proc.pos));
                  }
                  if (!ok) {
                    backtrack = true;
                  }
                }
                break;

              case 'word-boundary':
              case 'not-word-boundary':
                {
                  const c = s.charCodeAt(proc.pos - 1) ?? -1;
                  const d = s.charCodeAt(proc.pos) ?? -1;
                  const a = char.isWordChar(c, this.ignoreCase, this.unicode);
                  const b = char.isWordChar(d, this.ignoreCase, this.unicode);
                  if ((a === b) === (code.kind === 'word-boundary')) {
                    backtrack = true;
                  }
                }
                break;
            }
            break;

          case 'prev-char':
            {
              const c = char.prevIndex(s, proc.pos, this.unicode);
              proc.pos -= char.size(c);
            }
            break;
        }

        if (backtrack) {
          procs.pop();
        }
      }

      if (this.sticky) {
        return null;
      }
    }

    return null;
  }
}
