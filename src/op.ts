// # op.ts
//
// > Type definitions of op-codes.

import * as ast from './ast';
import { CharSet } from './char-set';

export type Code =
  | { op: 'ok' }
  | { op: 'fork'; offset: number }
  | { op: 'jump'; offset: number }
  | { op: 'save-pos' }
  | { op: 'assert-pos-ne' }
  | { op: 'restore-pos' }
  | { op: 'pop-pos' }
  | { op: 'push-cnt' }
  | { op: 'jump-cnt-lt'; value: number; offset: number }
  | { op: 'assert-cnt-lt'; value: number }
  | { op: 'inc-cnt' }
  | { op: 'pop-cnt' }
  | { op: 'save-proc' }
  | { op: 'pop-proc' }
  | { op: 'fail-look-around' }
  | { op: 'cap-begin'; index: number }
  | { op: 'cap-end'; index: number; swap: boolean }
  | { op: 'char'; value: number }
  | { op: 'class'; set: CharSet; invert: boolean }
  | { op: 'any-char' }
  | { op: 'back-ref'; index: number; backward: boolean }
  | { op: 'assert-char'; kind: ast.AssertKind }
  | { op: 'prev-char' };
