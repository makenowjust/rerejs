import {
  digit,
  invertDigit,
  word,
  invertWord,
  unicodeWord,
  invertUnicodeWord,
  space,
  invertSpace,
} from '../char-class/ascii';
import { CharSet } from '../char-class/char-set';
import { loadProperty, loadPropertyValue } from '../char-class/unicode';
import { RegExpSyntaxError } from '../syntax/error';
import {
  Pattern,
  Node,
  Disjunction,
  Sequence,
  Capture,
  NamedCapture,
  Group,
  Many,
  Some,
  Optional,
  Repeat,
  WordBoundary,
  LineBegin,
  LineEnd,
  LookAhead,
  LookBehind,
  Char,
  EscapeClass,
  Class,
  Dot,
  BackRef,
  NamedBackRef,
} from '../syntax/pattern';
import { canonicalize } from './canonicalize';
import { OpCode } from './op-code';
import { Program } from './program';

/** `Compiler` is a compiler for `Pattern` to `Program`. */
export class Compiler {
  private pattern: Pattern;

  private advance = false;
  private captureParensIndex = 1;
  private direction: 'forward' | 'backward' = 'forward';

  private get ignoreCase(): boolean {
    return this.pattern.flagSet.ignoreCase;
  }

  private get unicode(): boolean {
    return this.pattern.flagSet.unicode;
  }

  private get captureParens(): number {
    return this.pattern.captureParens;
  }

  private get names(): Map<string, number> {
    return this.pattern.names;
  }

  constructor(pattern: Pattern) {
    this.pattern = pattern;
  }

  /** Run compiler and return compiled `Program`. */
  public compile(): Program {
    const codes0 = this.compileNode(this.pattern.child);
    const codes1: OpCode[] = [
      { op: 'cap_begin', index: 0 },
      ...codes0,
      { op: 'cap_end', index: 0 },
      { op: 'match' },
    ];
    return new Program(this.pattern, codes1);
  }

  private compileNode(node: Node): OpCode[] {
    switch (node.type) {
      case 'Disjunction':
        return this.compileDisjunction(node);
      case 'Sequence':
        return this.compileSequence(node);
      case 'Capture':
        return this.compileCapture(node);
      case 'NamedCapture':
        return this.compileNamedCapture(node);
      case 'Group':
        return this.compileGroup(node);
      case 'Many':
        return this.compileMany(node);
      case 'Some':
        return this.compileSome(node);
      case 'Optional':
        return this.compileOptional(node);
      case 'Repeat':
        return this.compileRepeat(node);
      case 'WordBoundary':
        return this.compileWordBoundary(node);
      case 'LineBegin':
        return this.compileLineBegin(node);
      case 'LineEnd':
        return this.compileLineEnd(node);
      case 'LookAhead':
        return this.compileLookAhead(node);
      case 'LookBehind':
        return this.compileLookBehind(node);
      case 'Char':
        return this.compileChar(node);
      case 'EscapeClass':
        return this.compileEscapeClass(node);
      case 'Class':
        return this.compileClass(node);
      case 'Dot':
        return this.compileDot(node);
      case 'BackRef':
        return this.compileBackRef(node);
      case 'NamedBackRef':
        return this.compileNamedBackRef(node);
    }
  }

  private compileDisjunction(node: Disjunction): OpCode[] {
    if (node.children.length === 0) {
      throw new Error('BUG: invalid pattern');
    }

    const children: OpCode[][] = [];
    let advance = true;
    for (const child of node.children) {
      children.push(this.compileNode(child));
      advance = advance && this.advance;
    }
    this.advance = advance;

    return children.reduceRight((codes, codes0) => [
      { op: 'fork_cont', next: codes0.length + 1 },
      ...codes0,
      { op: 'jump', cont: codes.length },
      ...codes,
    ]);
  }

  private compileSequence(node: Sequence): OpCode[] {
    const children = Array.from(node.children);
    if (this.direction === 'backward') {
      children.reverse();
    }

    const codes: OpCode[] = [];
    let advance = false;
    for (const child of children) {
      const codes0 = this.compileNode(child);
      codes.push(...codes0);
      advance = advance || this.advance;
    }
    this.advance = advance;

    return codes;
  }

  private compileGroup(node: Group): OpCode[] {
    return this.compileNode(node.child);
  }

  private compileCapture(node: Capture): OpCode[] {
    const current = this.captureParensIndex++;
    const codes0 = this.compileNode(node.child);
    if (node.index !== current) {
      throw new Error('BUG: invalid pattern');
    }
    return [
      { op: this.direction === 'backward' ? 'cap_end' : 'cap_begin', index: node.index },
      ...codes0,
      { op: this.direction === 'backward' ? 'cap_begin' : 'cap_end', index: node.index },
    ];
  }

  private compileNamedCapture(node: NamedCapture): OpCode[] {
    const current = this.captureParensIndex++;
    const codes0 = this.compileNode(node.child);
    const index = this.names.get(node.name);
    if (index === undefined || index !== current) {
      throw new Error('BUG: invalid pattern');
    }
    return [{ op: 'cap_begin', index }, ...codes0, { op: 'cap_end', index }];
  }

  private compileMany(node: Many): OpCode[] {
    const from = this.captureParensIndex;
    const codes0 = this.insertEmptyCheck(this.compileNode(node.child));
    const codes1 = this.insertCapReset(from, codes0);
    this.advance = false;

    return [
      { op: node.nonGreedy ? 'fork_next' : 'fork_cont', next: codes1.length + 1 },
      ...codes1,
      { op: 'jump', cont: -1 - codes1.length - 1 },
    ];
  }

  private compileSome(node: Some): OpCode[] {
    const from = this.captureParensIndex;
    const codes0 = this.compileNode(node.child);
    const codes1 = this.insertCapReset(from, this.insertEmptyCheck(codes0));

    return [
      ...codes0,
      { op: node.nonGreedy ? 'fork_next' : 'fork_cont', next: codes1.length + 1 },
      ...codes1,
      { op: 'jump', cont: -1 - codes1.length - 1 },
    ];
  }

  private compileOptional(node: Optional): OpCode[] {
    const codes0 = this.compileNode(node.child);
    this.advance = false;

    return [{ op: node.nonGreedy ? 'fork_next' : 'fork_cont', next: codes0.length }, ...codes0];
  }

  private compileRepeat(node: Repeat): OpCode[] {
    const from = this.captureParensIndex;
    const codes0 = this.compileNode(node.child);
    const codes: OpCode[] = [];

    if (node.min === 1) {
      codes.push(...codes0);
    } else if (node.min > 1) {
      const codes1 = this.insertCapReset(from, codes0);
      codes.push(
        { op: 'push', value: node.min },
        ...codes1,
        { op: 'dec' },
        { op: 'loop', cont: -1 - codes1.length - 1 },
        { op: 'pop' }
      );
    } else {
      this.advance = false;
    }

    const max = node.max ?? node.min;
    if (max === Infinity) {
      const codes1 = this.insertCapReset(from, this.insertEmptyCheck(codes0));
      codes.push(
        { op: node.nonGreedy ? 'fork_next' : 'fork_cont', next: codes1.length + 1 },
        ...codes1,
        { op: 'jump', cont: -1 - codes1.length - 1 }
      );
    } else if (max > node.min) {
      const remain = max - node.min;
      const codes1 = this.insertCapReset(from, this.insertEmptyCheck(codes0));
      if (remain === 1) {
        codes.push(
          { op: node.nonGreedy ? 'fork_next' : 'fork_cont', next: codes1.length },
          ...codes1
        );
      } else {
        codes.push(
          { op: 'push', value: remain + 1 },
          { op: node.nonGreedy ? 'fork_next' : 'fork_cont', next: codes0.length + 4 },
          ...codes1,
          { op: 'dec' },
          { op: 'loop', cont: -1 - codes0.length - 2 },
          { op: 'fail' },
          { op: 'pop' }
        );
      }
    }

    return codes;
  }

  private insertEmptyCheck(codes0: OpCode[]): OpCode[] {
    return this.advance ? codes0 : [{ op: 'push_pos' }, ...codes0, { op: 'empty_check' }];
  }

  private insertCapReset(from: number, codes0: OpCode[]): OpCode[] {
    if (from === this.captureParensIndex) {
      return codes0;
    }
    return [{ op: 'cap_reset', from, to: this.captureParensIndex }, ...codes0];
  }

  private compileWordBoundary(node: WordBoundary): OpCode[] {
    this.advance = false;
    return [{ op: node.invert ? 'word_boundary_not' : 'word_boundary' }];
  }

  private compileLineBegin(_node: LineBegin): OpCode[] {
    this.advance = false;
    return [{ op: 'line_begin' }];
  }

  private compileLineEnd(_node: LineEnd): OpCode[] {
    this.advance = false;
    return [{ op: 'line_end' }];
  }

  private compileLookAhead(node: LookAhead): OpCode[] {
    const oldDirection = this.direction;
    this.direction = 'forward';
    const codes = this.compileLookAround(node);
    this.direction = oldDirection;
    return codes;
  }

  private compileLookBehind(node: LookBehind): OpCode[] {
    const oldDirection = this.direction;
    this.direction = 'backward';
    const codes = this.compileLookAround(node);
    this.direction = oldDirection;
    return codes;
  }

  private compileLookAround(node: LookAhead | LookBehind): OpCode[] {
    const codes0 = this.compileNode(node.child);
    this.advance = false;

    if (node.negative) {
      return [
        { op: 'push_pos' },
        { op: 'push_proc' },
        { op: 'fork_cont', next: codes0.length + 2 },
        ...codes0,
        { op: 'rewind_proc' },
        { op: 'fail' },
        { op: 'pop' },
        { op: 'restore_pos' },
      ];
    }

    return [
      { op: 'push_pos' },
      { op: 'push_proc' },
      ...codes0,
      { op: 'rewind_proc' },
      { op: 'restore_pos' },
    ];
  }

  private compileChar(node: Char): OpCode[] {
    let value = node.value;
    if (this.ignoreCase) {
      value = canonicalize(value, this.unicode);
    }
    this.advance = true;
    return this.insertBack([{ op: 'char', value }]);
  }

  private compileEscapeClass(node: EscapeClass): OpCode[] {
    const set = this.escapeClassToSet(node);
    this.advance = true;
    return this.insertBack([{ op: 'class', set }]);
  }

  private compileClass(node: Class): OpCode[] {
    const set = new CharSet();
    for (const item of node.children) {
      switch (item.type) {
        case 'Char':
          set.add(item.value, item.value + 1);
          break;
        case 'EscapeClass':
          set.addCharSet(this.escapeClassToSet(item));
          break;
        case 'ClassRange':
          set.add(item.children[0].value, item.children[1].value + 1);
          break;
      }
    }
    this.advance = true;
    return this.insertBack([{ op: node.invert ? 'class_not' : 'class', set }]);
  }

  private escapeClassToSet(node: EscapeClass): CharSet {
    switch (node.kind) {
      case 'digit':
        return node.invert ? invertDigit : digit;
      case 'word':
        if (this.unicode && this.ignoreCase) {
          return node.invert ? invertUnicodeWord : unicodeWord;
        }
        return node.invert ? invertWord : word;
      case 'space':
        return node.invert ? invertSpace : space;
      case 'unicode_property': {
        const set =
          loadPropertyValue('General_Category', node.property) ?? loadProperty(node.property);
        if (set === null) {
          throw new RegExpSyntaxError('invalid Unicode property');
        }
        return node.invert ? set.clone().invert() : set;
      }
      case 'unicode_property_value': {
        const set = loadPropertyValue(node.property, node.value);
        if (set === null) {
          throw new RegExpSyntaxError('invalid Unicode property value');
        }
        return node.invert ? set.clone().invert() : set;
      }
    }
  }

  private compileDot(_node: Dot): OpCode[] {
    this.advance = true;
    return this.insertBack([{ op: 'any' }]);
  }

  private insertBack(codes: OpCode[]): OpCode[] {
    if (this.direction === 'forward') {
      return codes;
    }
    return [{ op: 'back' }, ...codes, { op: 'back' }];
  }

  private compileBackRef(node: BackRef): OpCode[] {
    if (node.index < 1 || this.captureParens < node.index) {
      throw new Error('invalid back reference');
    }
    this.advance = false;
    return [{ op: this.direction === 'backward' ? 'ref_back' : 'ref', index: node.index }];
  }

  private compileNamedBackRef(node: NamedBackRef): OpCode[] {
    const index = this.names.get(node.name);
    if (index === undefined || index < 1 || this.captureParens < index) {
      throw new Error('invalid named back reference');
    }
    this.advance = false;
    return [{ op: this.direction === 'backward' ? 'ref_back' : 'ref', index }];
  }
}
