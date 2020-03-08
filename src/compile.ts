// # compile.ts
//
// > Provides a compiler from regular expression AST nodes to `Program`.

import * as ast from './ast';
import * as char from './char';
import * as charClass from './char-class';
import { CharSet } from './char-set';
import * as op from './op';
import { Program } from './program';
import * as unicode from './unicode';

class Compiler {
  private readonly ignoreCase: boolean;
  private readonly unicode: boolean;

  private readonly paren: number;
  private readonly names: Map<string, number>;

  private direction: 'forward' | 'backward' = 'forward';

  constructor(ignoreCase: boolean, unicode: boolean, paren: number, names: Map<string, number>) {
    this.ignoreCase = ignoreCase;
    this.unicode = unicode;
    this.paren = paren;
    this.names = names;
  }

  public compile(re: ast.Root): op.Code[] {
    return [...this.capture(this.compileChild(re.child), 0), { op: 'ok' }];
  }

  private compileChild(node: ast.Node): op.Code[] {
    switch (node.type) {
      case 'sequence':
        return this.sequence(...this.compileChildren(node.children, true));
      case 'select':
        return this.select(...(this.compileChildren(node.children) as [op.Code[], ...op.Code[][]]));
      case 'repeat':
        return this.repeat(this.compileChild(node.child), node.min, node.max, node.greedy);
      case 'many':
        return this.many(this.compileChild(node.child), node.greedy);
      case 'some':
        return this.some(this.compileChild(node.child), node.greedy);
      case 'optional':
        return this.optional(this.compileChild(node.child), node.greedy);
      case 'capture':
        return this.capture(this.compileChild(node.child), node.index);
      case 'char':
      case 'escape':
        return this.char(node.value);
      case 'escape-class':
        return this.escapeClass(node);
      case 'class':
        return this.class(node.items, node.invert);
      case 'any-char':
        return this.anyChar();
      case 'back-ref':
        return this.backRef(node.key);
      case 'assert':
        return this.assert(node.kind);
      case 'look-ahead':
        return this.lookAhead(this.compileChildWithDirection(node.child, 'forward'), node.invert);
      case 'look-behind':
        return this.lookBehind(this.compileChildWithDirection(node.child, 'backward'), node.invert);
    }
  }

  private compileChildWithDirection(node: ast.Node, direction: 'forward' | 'backward'): op.Code[] {
    const oldDirection = this.direction;
    this.direction = direction;
    const r = this.compileChild(node);
    this.direction = oldDirection;
    return r;
  }

  private compileChildren(nodes: ast.Node[], reverseOnBackward = false): op.Code[][] {
    if (reverseOnBackward && this.direction === 'backward') {
      nodes = Array.from(nodes).reverse();
    }
    return nodes.map(node => this.compileChild(node));
  }

  private sequence(...rs: op.Code[][]): op.Code[] {
    return rs.flat();
  }

  private select(r0: op.Code[], ...rs: op.Code[][]): op.Code[] {
    if (rs.length === 0) {
      return r0;
    }

    const r1 = this.select(...(rs as [op.Code[], ...op.Code[][]]));
    return [
      // fork  o-+
      // ...r0   |
      // jump    | o-+
      // ...r1 <-+   |
      // ...   <-----+
      { op: 'fork', offset: r0.length + 1 },
      ...r0,
      { op: 'jump', offset: r1.length },
      ...r1
    ];
  }

  private repeat(r: op.Code[], min: number, max: number, greedy: boolean): op.Code[] {
    if (min === 0 && max === Infinity) {
      return this.many(r, greedy);
    }
    if (min === 1 && max === Infinity) {
      return this.some(r, greedy);
    }
    if (min === 0 && max === 1) {
      return this.optional(r, greedy);
    }

    const rmin: op.Code[] = [];
    if (min === 1) {
      rmin.push(...r);
    } else if (min > 1) {
      // push-cnt
      // ...r        <-+
      // inc-cnt       |
      // jump-cnt-lt o-+
      // pop-cnt
      rmin.push(
        { op: 'push-cnt' },
        ...r,
        { op: 'inc-cnt' },
        { op: 'jump-cnt-lt', value: min, offset: -r.length - 2 },
        { op: 'pop-cnt' }
      );
    }

    const rmax: op.Code[] = [];
    if (max === Infinity) {
      rmax.push(...this.many(r, greedy));
    } else {
      const n = max - min;
      if (n > 0) {
        if (greedy) {
          // push-cnt
          // fork          <-+ o-+
          // save-pos        |   |
          // ...r            |   |
          // assert-cnt-lt   |   |
          // inc-cnt         |   |
          // jump          o-+   |
          // pop-cnt       <-----+
          rmax.push(
            { op: 'push-cnt' },
            { op: 'fork', offset: r.length + 6 },
            { op: 'save-pos' },
            ...r,
            { op: 'assert-pos-ne' },
            { op: 'pop-pos' },
            { op: 'assert-cnt-lt', value: n },
            { op: 'inc-cnt' },
            { op: 'jump', offset: -r.length - 7 },
            { op: 'pop-cnt' }
          );
        } else {
          // push-cnt
          // fork          o-+ <-+
          // jump            |   | o-+
          // save-pos      <-+   |   |
          // ...r                |   |
          // assert-pos-ne       |   |
          // pop-pos             |   |
          // assert-cnt-lt       |   |
          // inc-cnt             |   |
          // jump          o-----+   |
          // pop-cnt       <---------+
          rmax.push(
            { op: 'push-cnt' },
            { op: 'fork', offset: 1 },
            { op: 'jump', offset: r.length + 6 },
            { op: 'save-pos' },
            ...r,
            { op: 'assert-pos-ne' },
            { op: 'pop-pos' },
            { op: 'assert-cnt-lt', value: n },
            { op: 'inc-cnt' },
            { op: 'jump', offset: -r.length - 8 },
            { op: 'pop-cnt' }
          );
        }
      }
    }

    return [...rmin, ...rmax];
  }

  private many(r: op.Code[], greedy: boolean): op.Code[] {
    if (greedy) {
      // fork          <-+ o-+
      // save-pos        |   |
      // ...r            |   |
      // assert-pos-ne   |   |
      // pop-pos         |   |
      // jump          o-+   |
      //               <-----+
      return [
        { op: 'fork', offset: r.length + 4 },
        { op: 'save-pos' },
        ...r,
        { op: 'assert-pos-ne' },
        { op: 'pop-pos' },
        { op: 'jump', offset: -r.length - 5 }
      ];
    } else {
      // fork          o-+ <-+
      // jump            |   | o-+
      // save-pos      <-+   |   |
      // ...r                |   |
      // assert-pos-ne       |   |
      // pop-pos             |   |
      // jump          o-----+   |
      //               <---------+
      return [
        { op: 'fork', offset: 1 },
        { op: 'jump', offset: r.length + 4 },
        { op: 'save-pos' },
        ...r,
        { op: 'assert-pos-ne' },
        { op: 'pop-pos' },
        { op: 'jump', offset: -r.length - 6 }
      ];
    }
  }

  private some(r: op.Code[], greedy: boolean): op.Code[] {
    return this.sequence(r, this.many(r, greedy));
  }

  private optional(r: op.Code[], greedy: boolean): op.Code[] {
    if (greedy) {
      // fork o-+
      // ...r   |
      //      <-+
      return [{ op: 'fork', offset: r.length }, ...r];
    } else {
      // fork o-+
      // jump   | o-+
      // ...r <-+   |
      //      <-----+
      return [{ op: 'fork', offset: 1 }, { op: 'jump', offset: r.length }, ...r];
    }
  }

  private capture(r: op.Code[], index: number): op.Code[] {
    return [
      { op: 'cap-begin', index },
      ...r,
      { op: 'cap-end', index, swap: this.direction === 'backward' }
    ];
  }

  private char(value: string): op.Code[] {
    const c = char.index(value, 0, this.unicode);
    const d = char.canonicalize(c, this.ignoreCase, this.unicode);
    return this.wrapCharOp({ op: 'char', value: d });
  }

  private escapeClass(escape: ast.EscapeClass): op.Code[] {
    const set = this.escapeClassSet(escape);
    return this.wrapCharOp({ op: 'class', set, invert: false });
  }

  private class(items: ast.ClassItem[], invert: boolean): op.Code[] {
    const set = new CharSet();
    for (const item of items) {
      switch (item.type) {
        case 'char':
        case 'escape':
          {
            const begin = char.index(item.value, 0, this.unicode);
            const end = begin + 1;
            set.add(begin, end);
          }
          break;
        case 'class-range':
          {
            const begin = char.index(item.begin.value, 0, this.unicode);
            const end = char.index(item.end.value, 0, this.unicode) + 1;
            set.add(begin, end);
          }
          break;
        case 'escape-class':
          set.addCharSet(this.escapeClassSet(item));
          break;
      }
    }

    return this.wrapCharOp({ op: 'class', set, invert });
  }

  private escapeClassSet(escape: ast.EscapeClass): CharSet {
    switch (escape.kind) {
      case 'digit':
        return charClass.digit;
      case 'not-digit':
        return charClass.invertDigit;
      case 'space':
        return charClass.space;
      case 'not-space':
        return charClass.invertSpace;
      case 'word':
        return this.unicode && this.ignoreCase ? charClass.unicodeWord : charClass.word;
      case 'not-word':
        return this.unicode && this.ignoreCase ? charClass.invertUnicodeWord : charClass.invertWord;
      case 'unicode-property':
      case 'not-unicode-property': {
        let set = unicode.matchPropertyValue('General_Category', escape.property);
        if (set === null) {
          set = unicode.matchProperty(escape.property);
        }
        if (set === null) {
          throw new SyntaxError('invalid property name');
        }
        return escape.kind === 'not-unicode-property' ? set.invert() : set;
      }
      case 'unicode-property-value':
      case 'not-unicode-property-value': {
        const set = unicode.matchPropertyValue(escape.property, escape.value);
        if (set === null) {
          throw new SyntaxError('invalid property name');
        }
        return escape.kind === 'not-unicode-property-value' ? set.invert() : set;
      }
    }
  }

  private anyChar(): op.Code[] {
    return this.wrapCharOp({ op: 'any-char' });
  }

  private wrapCharOp(code: op.Code): op.Code[] {
    if (this.direction === 'backward') {
      return [{ op: 'prev-char' }, code, { op: 'prev-char' }];
    }
    return [code];
  }

  private backRef(key: string | number): op.Code[] {
    if (typeof key === 'string') {
      const k = this.names.get(key);
      if (k === undefined) {
        throw new SyntaxError('invalid named capture reference');
      }
      key = k;
    }
    if (0 <= key || this.paren < key) {
      throw new SyntaxError('invalid back reference');
    }
    return [{ op: 'back-ref', index: key, backward: this.direction === 'backward' }];
  }

  private assert(kind: ast.AssertKind): op.Code[] {
    switch (kind) {
      case 'begin':
        return [{ op: 'assert-char', kind: 'begin' }];
      case 'end':
        return [{ op: 'assert-char', kind: 'end' }];
      case 'word-boundary':
        return [{ op: 'assert-char', kind: 'word-boundary' }];
      case 'not-word-boundary':
        return [{ op: 'assert-char', kind: 'not-word-boundary' }];
    }
  }

  private lookAhead(r: op.Code[], invert: boolean): op.Code[] {
    if (invert) {
      return [
        { op: 'save-pos' },
        { op: 'save-proc' },
        { op: 'fork', offset: r.length + 1 },
        ...r,
        { op: 'fail-look-around' },
        { op: 'pop-proc' },
        { op: 'restore-pos' }
      ];
    }

    return [{ op: 'save-pos' }, ...r, { op: 'restore-pos' }];
  }

  private lookBehind(r: op.Code[], invert: boolean): op.Code[] {
    return this.lookAhead(r, invert);
  }
}

export const compile = (re: ast.Root): Program => {
  const compiler = new Compiler(re.ignoreCase, re.unicode, re.paren, re.names);
  const codes = compiler.compile(re);
  return new Program(
    codes,
    re.ignoreCase,
    re.multiline,
    re.unicode,
    re.sticky,
    re.dotAll,
    re.paren,
    re.names
  );
};
