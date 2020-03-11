import { CharSet, MAX_CODE_POINT } from './char-set';
import { property } from './data/unicode';
import { RegExpSyntaxError } from './error';
import { Pattern, Node, ClassItem, Char, EscapeClass } from './pattern';

/** Check the node is assertion, which means cannot become a child of repetition node. */
const isAssertion = (n: Node): boolean => {
  switch (n.type) {
    case 'word_boundary':
    case 'line_begin':
    case 'line_end':
    case 'look_ahead':
    case 'look_behind':
      return true;
  }
  return false;
};

/** Check the character is sequence delimiter. */
const isSequenceDelimiter = (c: string): boolean => c === '|' || c === ')' || c === '';

/** Check the character is digit. */
const isDigit = (c: string): boolean => '0' <= c && c <= '9';

/** Check the character is hex digit. */
const isHexDigit = (c: string): boolean =>
  isDigit(c) || ('a' <= c && c <= 'f') || ('A' <= c && c <= 'F');

/** Check the character has meaning in pattern. */
const isSyntax = (c: string): boolean => c !== '' && '^$\\.*+?()[]{}|'.includes(c);

/** Check the character can use for control escape. */
const isControl = (c: string): boolean => ('a' <= c && c <= 'z') || ('A' <= c && c <= 'Z');

/** Check the character is part of Unicode property name. */
const isUnicodeProperty = (c: string): boolean => isControl(c) || c === '_';

/** Check the character is part of Unicode property value. */
const isUnicodePropertyValue = (c: string): boolean => isUnicodeProperty(c) || isDigit(c);

const idStart = new CharSet(property.get('ID_Start') ?? []);
/** Check the character is identifier start character. */
const isIDStart = (c: string): boolean =>
  c === '$' || c === '_' || idStart.has(c.codePointAt(0) ?? -1);

const idContinue = new CharSet(property.get('ID_Continue') ?? []);
/** Check the character is identifier part character. */
const isIDPart = (c: string): boolean =>
  c === '$' || c === '\u200C' || c === '\u200D' || idContinue.has(c.codePointAt(0) ?? -1);

/** Type of repeat quantifier. */
type RepeatQuantifier = {
  min: number;
  max: number;
};

export class Parser {
  private source: string;
  private flags: string;

  private pos = 0;

  private global = false;
  private ignoreCase = false;
  private multiline = false;
  private unicode = false;
  private dotAll = false;
  private sticky = false;

  /**
   * A flag whether support "Additional ECMAScript Features for Web Browsers" syntax.
   *
   * See https://www.ecma-international.org/ecma-262/10.0/index.html#sec-regular-expressions-patterns.
   */
  private additional: boolean;

  private captureParens = 0;
  private names: Map<string, number> = new Map();
  private captureParensIndex = 0;

  constructor(source: string, flags = '', additional = true) {
    this.source = source;
    this.flags = flags;
    this.additional = additional;
  }

  public parse(): Pattern {
    this.preprocessFlags();
    this.preprocessCaptures();

    this.pos = 0;
    const child = this.parseSelect();
    if (this.current() !== '') {
      throw new RegExpSyntaxError("too many ')'");
    }

    return {
      type: 'pattern',
      global: this.global,
      ignoreCase: this.ignoreCase,
      multiline: this.multiline,
      unicode: this.unicode,
      dotAll: this.dotAll,
      sticky: this.sticky,
      captureParens: this.captureParens,
      names: this.names,
      child
    };
  }

  /** Parse flags. */
  private preprocessFlags(): void {
    for (const c of this.flags) {
      switch (c) {
        case 'g':
          if (this.global) {
            throw new RegExpSyntaxError("duplicated 'g' flag");
          }
          this.global = true;
          break;
        case 'i':
          if (this.ignoreCase) {
            throw new RegExpSyntaxError("duplicated 'i' flag");
          }
          this.ignoreCase = true;
          break;
        case 'm':
          if (this.multiline) {
            throw new RegExpSyntaxError("duplicated 'm' flag");
          }
          this.multiline = true;
          break;
        case 'u':
          if (this.unicode) {
            throw new RegExpSyntaxError("duplicated 'u' flag");
          }
          this.unicode = true;
          break;
        case 's':
          if (this.dotAll) {
            throw new RegExpSyntaxError("duplicated 's' flag");
          }
          this.dotAll = true;
          break;
        case 'y':
          if (this.sticky) {
            throw new RegExpSyntaxError("duplicated 's' flag");
          }
          this.sticky = true;
          break;
        default:
          throw new RegExpSyntaxError('unknown flag');
      }
    }
  }

  /** Count number of capture group parens, and collect names. */
  private preprocessCaptures(): void {
    while (this.pos < this.source.length) {
      const c = this.current();
      switch (c) {
        case '(':
          if (this.source.startsWith('(?<', this.pos)) {
            this.pos += 3; // skip '(?<'
            const d = this.current();
            if (d !== '=' && d !== '!') {
              this.captureParens++;
              const name = this.parseCaptureName();
              this.names.set(name, this.captureParens);
            }
          } else {
            if (!this.source.startsWith('(?', this.pos)) {
              this.captureParens++;
            }
            this.pos++; // skip '('
          }
          break;
        case '\\':
          this.pos++; // skip '\\'
          this.pos += this.current().length; // skip any character.
          break;
        case '[':
          this.skipCharClass();
          break;
        default:
          this.pos += c.length; // skip any character.
          break;
      }
    }
  }

  private skipCharClass(): void {
    this.pos += 1; // skip '['
    while (this.pos < this.source.length) {
      const c = this.current();
      switch (c) {
        case ']':
          this.pos += 1; // skip ']'
          return;
        case '\\':
          this.pos++; // skip '\\'
          this.pos += this.current().length; // skip any character.
          break;
        default:
          this.pos += c.length; // skip any character
          break;
      }
    }
  }

  private parseSelect(): Node {
    const children: [Node, ...Node[]] = [this.parseSequence()];

    for (;;) {
      if (this.current() !== '|') {
        break;
      }
      this.pos += 1; // skip '|'
      children.push(this.parseSequence());
    }

    if (children.length === 1) {
      return children[0];
    }

    return { type: 'select', children };
  }

  private parseSequence(): Node {
    const children = [];

    for (;;) {
      if (isSequenceDelimiter(this.current())) {
        break;
      }
      children.push(this.parseQuantifier());
    }

    if (children.length === 1) {
      return children[0];
    }

    return { type: 'sequence', children };
  }

  private parseQuantifier(): Node {
    const child = this.parseAtom();

    if (isAssertion(child)) {
      if (this.additional && !this.unicode && child.type === 'look_ahead') {
        // In this case, maybe repetition has look-ahead as child.
      } else {
        return child;
      }
    }

    switch (this.current()) {
      case '*':
        return this.parseSimpleQuantifier('many', child);
      case '+':
        return this.parseSimpleQuantifier('some', child);
      case '?':
        return this.parseSimpleQuantifier('optional', child);
      case '{':
        return this.parseRepeat(child);
    }

    return child;
  }

  private parseSimpleQuantifier(type: 'many' | 'some' | 'optional', child: Node): Node {
    this.pos += 1; // skip one of '*', '+', '?'
    let nonGreedy = false;
    if (this.current() === '?') {
      this.pos += 1; // skip '?'
      nonGreedy = true;
    }
    return { type, nonGreedy, child };
  }

  private parseRepeat(child: Node): Node {
    const save = this.pos;
    const quantifier = this.tryParseRepeatQuantifier();
    if (quantifier === null) {
      return this.parseInvalidRepeat(save, child, 'incomplete quantifier');
    }

    const { min, max } = quantifier;
    if (min > max) {
      return this.parseInvalidRepeat(save, child, 'numbers out of order in quantifier');
    }

    let nonGreedy = false;
    if (this.current() === '?') {
      this.pos += 1; // skip '?'
      nonGreedy = true;
    }

    return { type: 'repeat', min, max, nonGreedy, child };
  }

  private tryParseRepeatQuantifier(): RepeatQuantifier | null {
    const save = this.pos;
    this.pos += 1; // skip '{'

    const min = this.parseDigits();
    if (min < 0) {
      this.pos = save;
      return null;
    }

    let max = min;
    if (this.current() === ',') {
      this.pos += 1; // skip ','
      if (this.current() === '}') {
        max = Infinity;
      } else {
        max = this.parseDigits();
        if (max < 0) {
          this.pos = save;
          return null;
        }
      }
    }

    if (this.current() !== '}') {
      this.pos = save;
      return null;
    }
    this.pos += 1; // skip '}'

    return { min, max };
  }

  private parseInvalidRepeat(save: number, child: Node, message: string): Node {
    if (this.additional && !this.unicode) {
      this.pos = save;
      return child;
    }
    throw new RegExpSyntaxError(message);
  }

  private parseAtom(): Node {
    const c = this.current();
    switch (c) {
      case '.':
        this.pos++; // skip '.'
        return { type: 'dot' };
      case '^':
        this.pos++; // skip '^'
        return { type: 'line_begin' };
      case '$':
        this.pos++; // skip '$'
        return { type: 'line_end' };
      case '*':
      case '+':
      case '?':
        throw new RegExpSyntaxError('nothing to repeat');
      case '{':
      case '}':
        if (this.additional && !this.unicode) {
          const quantifier = this.tryParseRepeatQuantifier();
          if (quantifier === null) {
            break;
          }
        }
        throw new RegExpSyntaxError('lone quantifier brackets');
      case '[':
        return this.parseClass();
      case ']':
        if (this.additional && !this.unicode) {
          break;
        }
        throw new RegExpSyntaxError('lone character class brackets');
      case '\\':
        return this.parseEscape();
      case '(':
        return this.parseParen();
      case ')':
      case '|':
      case '':
        throw new Error('BUG: invalid character');
    }

    this.pos += c.length; // skip any character
    const value = c.codePointAt(0);
    if (value === undefined) {
      throw new Error('BUG: invalid character');
    }
    return { type: 'char', value, raw: c };
  }

  private parseClass(): Node {
    this.pos++; // skip '['

    let invert = false;
    if (this.current() === '^') {
      this.pos++; // skip '^'
      invert = true;
    }

    const items: ClassItem[] = [];

    for (;;) {
      const c = this.current();
      if (c === ']') {
        break;
      }
      items.push(this.parseClassItem());
    }
    this.pos++; // skip ']'

    return { type: 'class', invert, items };
  }

  private parseClassItem(): ClassItem {
    const begin = this.parseClassAtom();
    if (this.current() !== '-') {
      return begin;
    }
    if (this.source.startsWith('-]', this.pos)) {
      return begin;
    }

    if (begin.type === 'escape_class') {
      if (this.additional && !this.unicode) {
        return begin;
      }
      throw new RegExpSyntaxError('invalid character class');
    }

    const save = this.pos;
    this.pos++; // skip '-'
    const end = this.parseClassAtom();
    if (end.type === 'escape_class') {
      if (this.additional && !this.unicode) {
        this.pos = save;
        return begin;
      }
      throw new RegExpSyntaxError('invalid character class');
    }

    return { type: 'class_range', begin, end };
  }

  private parseClassAtom(): Char | EscapeClass {
    const c = this.current();
    if (c === '') {
      throw new RegExpSyntaxError('unterminated character class');
    }

    if (c !== '\\') {
      this.pos += c.length; // skip any character
      const value = c.codePointAt(0);
      if (value === undefined) {
        throw new Error('BUG: invalid character');
      }
      return { type: 'char', value, raw: c };
    }

    if (this.source.startsWith('\\-', this.pos)) {
      this.pos += 2; // skip '\\-'
      return { type: 'char', value: 0x2d, raw: '\\-' };
    }

    if (this.source.startsWith('\\b', this.pos)) {
      this.pos += 2; // skip '\\b'
      return { type: 'char', value: 0x08, raw: '\\b' };
    }

    const escapeClass = this.tryParseEscapeClass();
    if (escapeClass !== null) {
      return escapeClass;
    }

    const escape = this.tryParseEscape();
    if (escape !== null) {
      return escape;
    }

    throw new RegExpSyntaxError('invalid escape');
  }

  private parseEscape(): Node {
    const wordBoundary = this.tryParseWordBoundary();
    if (wordBoundary !== null) {
      return wordBoundary;
    }

    const backRef = this.tryParseBackRef();
    if (backRef !== null) {
      return backRef;
    }

    const escapeClass = this.tryParseEscapeClass();
    if (escapeClass !== null) {
      return escapeClass;
    }

    const escape = this.tryParseEscape();
    if (escape !== null) {
      return escape;
    }

    throw new RegExpSyntaxError('invalid escape');
  }

  private tryParseWordBoundary(): Node | null {
    if (this.source.startsWith('\\b', this.pos)) {
      this.pos += 2; // skip '\\b'
      return { type: 'word_boundary', invert: false };
    }

    if (this.source.startsWith('\\B', this.pos)) {
      this.pos += 2; // skip '\\B'
      return { type: 'word_boundary', invert: false };
    }

    return null;
  }

  private tryParseBackRef(): Node | null {
    const save = this.pos;
    this.pos++; // skip '\\';

    if (this.names.size > 0) {
      if (this.current() === 'k') {
        this.pos++; // skip 'k';
        if (this.current() !== '<') {
          throw new RegExpSyntaxError('invalid named back reference');
        }
        this.pos++; // skip '<'
        const name = this.parseCaptureName();
        return { type: 'named_back_ref', name };
      }
    }

    if (this.current() !== '0') {
      const index = this.parseDigits();
      if (index >= 1) {
        if (this.additional && !this.unicode) {
          if (index <= this.captureParens) {
            return { type: 'back_ref', index };
          }
        } else {
          return { type: 'back_ref', index };
        }
      }
    }

    this.pos = save;
    return null;
  }

  private tryParseEscape(): Char | null {
    const save = this.pos;

    const unicode = this.tryParseUnicodeEscape();
    if (unicode !== '') {
      const value = unicode.codePointAt(0);
      if (value === undefined) {
        throw new Error('BUG: invalid character');
      }
      return { type: 'char', value, raw: this.source.slice(save, this.pos) };
    }

    this.pos++; // skip '\\'
    switch (this.current()) {
      case 't':
        this.pos++; // skip 't'
        return { type: 'char', value: 0x09, raw: '\\t' };
      case 'n':
        this.pos++; // skip 'n'
        return { type: 'char', value: 0x0a, raw: '\\n' };
      case 'v':
        this.pos++; // skip 'v'
        return { type: 'char', value: 0x0b, raw: '\\v' };
      case 'f':
        this.pos++; // skip 'f'
        return { type: 'char', value: 0x0c, raw: '\\f' };
      case 'r':
        this.pos++; // skip 'r'
        return { type: 'char', value: 0x0d, raw: '\\r' };
      case 'c': {
        this.pos++;
        const c = this.current();
        let value = 0;
        if (isControl(c)) {
          this.pos++; // skip a-z or A-Z
          value = c.charCodeAt(0) % 32;
        } else {
          if (this.additional && !this.unicode) {
            this.pos--;
            break;
          }
          throw new RegExpSyntaxError('invalid control escape');
        }
        return { type: 'char', value, raw: this.source.slice(save, this.pos) };
      }
      case 'x': {
        this.pos++; // skip 'x'
        const value = this.tryParseHexDigitsN(2);
        if (value < 0) {
          break;
        }
        return { type: 'char', value, raw: this.source.slice(save, this.pos) };
      }
      case '0':
        this.pos++;
        if (isDigit(this.current())) {
          break;
        }
        return { type: 'char', value: 0, raw: '\\0' };
      case '':
        throw new RegExpSyntaxError('\\ at end of pattern');
    }

    // Legacy octal escape.
    if (this.additional && !this.unicode) {
      const octal = this.pos;
      const c0 = this.current();
      if ('0' <= c0 && c0 <= '3') {
        this.pos++;
        const c1 = this.current();
        if ('0' <= c1 && c1 <= '7') {
          this.pos++;
          const c2 = this.current();
          if ('0' <= c2 && c2 <= '7') {
            this.pos++;
          }
        }
      } else if ('4' <= c0 && c0 <= '7') {
        this.pos++;
        const c1 = this.current();
        if ('0' <= c1 && c1 <= '7') {
          this.pos++;
        }
      }
      if (octal !== this.pos) {
        const value = Number.parseInt(this.source.slice(octal, this.pos), 8);
        return { type: 'char', value, raw: this.source.slice(save, this.pos) };
      }
    }

    // Identity escape.
    const c = this.current();
    const value = c.codePointAt(0);
    if (value === undefined) {
      throw new Error('BUG: invalid character');
    }
    if (this.unicode) {
      if (isSyntax(c) || c === '/') {
        this.pos += c.length; // skip any char
        return { type: 'char', value, raw: `\\${c}` };
      }
    } else {
      if (this.additional) {
        if (c === 'c') {
          return { type: 'char', value: 0x5c, raw: '\\' };
        }
        if (this.names.size === 0 || c !== 'k') {
          this.pos += c.length; // skip any char
          return { type: 'char', value, raw: `\\${c}` };
        }
      } else {
        if (!idContinue.has(value)) {
          this.pos += c.length; // skip any char
          return { type: 'char', value, raw: `\\${c}` };
        }
      }
    }

    this.pos = save;
    return null;
  }

  private tryParseUnicodeEscape(lead = true): string {
    const save = this.pos;
    this.pos++; // skip '\\'

    if (this.current() !== 'u') {
      this.pos = save;
      return '';
    }
    this.pos++; // skip 'u'

    if (this.unicode && this.current() === '{') {
      if (!lead) {
        this.pos = save;
        return '';
      }
      this.pos++; // skip '{'
      const c = this.parseHexDigits();
      if (c < 0 || MAX_CODE_POINT <= c || this.current() !== '}') {
        throw new RegExpSyntaxError('invalid Unicode escape');
      }
      this.pos++; // skip '}'
      return String.fromCodePoint(c);
    }

    const c = this.tryParseHexDigitsN(4);
    if (c < 0) {
      if (this.additional && !this.unicode) {
        this.pos = save;
        return '';
      }
      throw new RegExpSyntaxError('invalid Unicode escape');
    }

    const s = String.fromCharCode(c);
    if (!this.unicode) {
      return s;
    }

    if (lead && '\uD800' <= s && s <= '\uDBFF' && this.current() === '\\') {
      const save = this.pos;
      const t = this.tryParseUnicodeEscape(false);
      if ('\uDC00' <= t && t <= '\uDFFF') {
        return s + t;
      }
      this.pos = save;
    }

    return s;
  }

  private tryParseEscapeClass(): EscapeClass | null {
    const save = this.pos;
    this.pos++; // skip '\\'

    const c = this.current();
    switch (c) {
      case 'd':
      case 'D':
        this.pos++; // skip 'd' or 'D'
        return { type: 'escape_class', kind: 'digit', invert: c === 'D' };
      case 'w':
      case 'W':
        this.pos++; // skip 'w' or 'W'
        return { type: 'escape_class', kind: 'word', invert: c === 'W' };
      case 's':
      case 'S':
        this.pos++; // skip 's' or 'S'
        return { type: 'escape_class', kind: 'space', invert: c === 'S' };
      case 'p':
      case 'P': {
        if (!this.unicode) {
          break;
        }
        const invert = c === 'P';
        this.pos++; // skip 'p' or 'P'

        if (this.current() !== '{') {
          throw new RegExpSyntaxError('invalid Unicode property escape');
        }
        this.pos++; // skip '{'

        const property = this.parseUnicodePropertyName();
        if (property === '') {
          throw new RegExpSyntaxError('invalid Unicode property name');
        }

        if (this.current() === '}') {
          this.pos++; // skip '}'
          return { type: 'escape_class', kind: 'unicode_property', property, invert };
        }

        if (this.current() !== '=') {
          throw new RegExpSyntaxError('invalid Unicode property escape');
        }
        this.pos++; // skip '='

        const value = this.parseUnicodePropertyValue();
        if (value === '') {
          throw new RegExpSyntaxError('invalid Unicode property value');
        }

        if (this.current() !== '}') {
          throw new RegExpSyntaxError('invalid Unicode property escape');
        }
        this.pos++; // skip '}'

        return { type: 'escape_class', kind: 'unicode_property_value', property, value, invert };
      }
    }

    this.pos = save;
    return null;
  }

  private parseUnicodePropertyName(): string {
    let p = '';
    for (;;) {
      const c = this.current();
      if (!isUnicodeProperty(c)) {
        break;
      }
      p += c;
      this.pos += c.length; // skip any character
    }
    return p;
  }

  private parseUnicodePropertyValue(): string {
    let v = '';
    for (;;) {
      const c = this.current();
      if (!isUnicodePropertyValue(c)) {
        break;
      }
      v += c;
      this.pos += c.length; // skip any character
    }
    return v;
  }

  private parseParen(): Node {
    if (!this.source.startsWith('(?', this.pos)) {
      this.pos++; // skip '('
      const child = this.parseSelect();
      const index = ++this.captureParensIndex;
      if (this.current() !== ')') {
        throw new RegExpSyntaxError('unterminated capture');
      }
      this.pos++; // skip ')'
      return { type: 'capture', index, child };
    }

    if (this.source.startsWith('(?:', this.pos)) {
      this.pos += 3; // skip '(?:'
      const child = this.parseSelect();
      if (this.current() !== ')') {
        throw new RegExpSyntaxError('unterminated group');
      }
      this.pos++; // skip ')'
      return { type: 'group', child };
    }

    if (this.source.startsWith('(?=', this.pos)) {
      this.pos += 3; // skip '(?='
      const child = this.parseSelect();
      if (this.current() !== ')') {
        throw new RegExpSyntaxError('unterminated look-ahead');
      }
      this.pos++; // skip ')'
      return { type: 'look_ahead', negative: false, child };
    }

    if (this.source.startsWith('(?!', this.pos)) {
      this.pos += 3; // skip '(?!'
      const child = this.parseSelect();
      if (this.current() !== ')') {
        throw new RegExpSyntaxError('unterminated look-ahead');
      }
      this.pos++; // skip ')'
      return { type: 'look_ahead', negative: true, child };
    }

    if (this.source.startsWith('(?<=', this.pos)) {
      this.pos += 4; // skip '(?<='
      const child = this.parseSelect();
      if (this.current() !== ')') {
        throw new RegExpSyntaxError('unterminated look-behind');
      }
      this.pos++; // skip ')'
      return { type: 'look_behind', negative: false, child };
    }

    if (this.source.startsWith('(?<!', this.pos)) {
      this.pos += 4; // skip '(?<!'
      const child = this.parseSelect();
      if (this.current() !== ')') {
        throw new RegExpSyntaxError('unterminated look-behind');
      }
      this.pos++; // skip ')'
      return { type: 'look_behind', negative: true, child };
    }

    if (this.source.startsWith('(?<', this.pos)) {
      this.pos += 3; // skip '(?<'
      const index = ++this.captureParensIndex;
      const name = this.parseCaptureName();
      if (this.names.get(name) !== index) {
        throw new Error('BUG: invalid named capture');
      }
      const child = this.parseSelect();
      if (this.current() !== ')') {
        throw new RegExpSyntaxError('unterminated named capture');
      }
      this.pos++; // skip ')'
      return { type: 'named_capture', name, child };
    }

    throw new RegExpSyntaxError('invalid group');
  }

  private parseCaptureName(): string {
    let name = '';
    const start = this.parseCaptureNameChar();
    if (!isIDStart(start)) {
      throw new RegExpSyntaxError('invalid capture group name');
    }
    name += start;

    for (;;) {
      const save = this.pos;
      const part = this.parseCaptureNameChar();
      if (!isIDPart(part)) {
        this.pos = save;
        break;
      }
      name += part;
    }

    if (this.current() !== '>') {
      throw new RegExpSyntaxError('invalid capture group name');
    }
    this.pos += 1; // skip '>'

    return name;
  }

  private parseCaptureNameChar(): string {
    const c = this.current();
    if (c === '\\') {
      return this.tryParseUnicodeEscape();
    }
    this.pos += c.length; // skip any character
    return c;
  }

  /** Parse digits. If parsing is failed, return `-1`. */
  private parseDigits(): number {
    let s = '';
    while (isDigit(this.current())) {
      s += this.current();
      this.pos++; // skip digit
    }
    return s === '' ? -1 : Number.parseInt(s, 10);
  }

  /** Parse hex digits. If parsing is failed, return `-1`. */
  private parseHexDigits(): number {
    let s = '';
    for (;;) {
      const c = this.current();
      if (!isHexDigit(c)) {
        break;
      }
      s += c;
      this.pos += c.length; // skip hex digit
    }
    return s === '' ? -1 : Number.parseInt(s, 16);
  }

  /** Try to parse `n` characters of hex digits.  If parsing is faield, return `-1`. */
  private tryParseHexDigitsN(n: number): number {
    const save = this.pos;
    let s = '';
    while (n-- > 0) {
      const c = this.current();
      if (!isHexDigit(c)) {
        this.pos = save;
        return -1;
      }
      s += c;
      this.pos += c.length; // skip hex digit
    }
    return Number.parseInt(s, 16);
  }

  /** Return the current character. */
  private current(): string {
    if (this.unicode) {
      const c = this.source.codePointAt(this.pos);
      return c === undefined ? '' : String.fromCodePoint(c);
    }
    const c = this.source.charCodeAt(this.pos);
    return Number.isNaN(c) ? '' : String.fromCharCode(c);
  }
}
