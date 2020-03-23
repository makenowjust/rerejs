import { CharSet } from '../char-class/char-set';
import { escape } from '../char-class/escape';

/** `OpCode` is a type of op-codes. */
export type OpCode =
  | { op: 'any' }
  | { op: 'back' }
  | { op: 'cap_begin'; index: number }
  | { op: 'cap_end'; index: number }
  | { op: 'cap_reset'; from: number; to: number }
  | { op: 'char'; value: number }
  | { op: 'class'; set: CharSet }
  | { op: 'class_not'; set: CharSet }
  | { op: 'dec' }
  | { op: 'empty_check' }
  | { op: 'fail' }
  | { op: 'fork_cont'; next: number }
  | { op: 'fork_next'; next: number }
  | { op: 'jump'; cont: number }
  | { op: 'line_begin' }
  | { op: 'line_end' }
  | { op: 'loop'; cont: number }
  | { op: 'match' }
  | { op: 'pop' }
  | { op: 'push'; value: number }
  | { op: 'push_pos' }
  | { op: 'push_proc' }
  | { op: 'ref'; index: number }
  | { op: 'ref_back'; index: number }
  | { op: 'restore_pos' }
  | { op: 'rewind_proc' }
  | { op: 'word_boundary' }
  | { op: 'word_boundary_not' };

/** Show op-codes as string. */
export const codesToString = (codes: OpCode[]): string => {
  const pc = (i: number): string => `#${i.toString().padStart(3, '0')}`;
  const op = (s: string): string => s.padEnd(13, ' ');

  const lines = codes.map((code, lineno) => {
    let line = `${pc(lineno)}: ${op(code.op)}`;

    switch (code.op) {
      case 'cap_begin':
      case 'cap_end':
        line += `${code.index}`;
        break;
      case 'cap_reset':
        line += `${code.from} ${code.to}`;
        break;
      case 'char':
        line += `'${escape(code.value)}'`;
        break;
      case 'class':
      case 'class_not':
        line += `${code.set.toRegExpPattern(code.op === 'class_not')}`;
        break;
      case 'fork_cont':
      case 'fork_next':
        line += `${pc(lineno + 1 + code.next)}`;
        break;
      case 'jump':
      case 'loop':
        line += `${pc(lineno + 1 + code.cont)}`;
        break;
      case 'push':
        line += `${code.value}`;
        break;
      case 'ref':
      case 'ref_back':
        line += `${code.index}`;
        break;
    }

    return line;
  });

  return lines.join('\n');
};
