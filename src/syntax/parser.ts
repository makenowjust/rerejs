import { CharSet } from '../char-class/char-set';
import { property } from '../data/unicode';
import { RegExpSyntaxError } from './error';
import { Pattern, Node, ClassItem, Char, EscapeClass, FlagSet } from './pattern';

/** Check the node is assertion, which means cannot become a child of repetition node. */
const isAssertion = (n: Node): boolean => {
  switch (n.type) {
    case 'WordBoundary':
    case 'LineBegin':
    case 'LineEnd':
    case 'LookAhead':
    case 'LookBehind':
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

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const idStart = new CharSet(property.get('ID_Start')!);
/** Check the character is identifier start character. */
const isIDStart = (c: string): boolean =>
  c === '$' || c === '_' || idStart.has(c.codePointAt(0) ?? -1);

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const idContinue = new CharSet(property.get('ID_Continue')!);
/** Check the character is identifier part character. */
const isIDPart = (c: string): boolean =>
  c === '$' || c === '\u200C' || c === '\u200D' || idContinue.has(c.codePointAt(0) ?? -1);

/** Type of repeat quantifier. */
type RepeatQuantifier = {
  min: number;
  max: number | null;
};

/**
 * `Parser` is parser for regular expression pattern.
 *
 * This parses ECMA-262 `RegExp` pattern syntax.
 * See https://www.ecma-international.org/ecma-262/10.0/index.html#sec-patterns.
 *
 * Also, "Additional ECMAScript Features for Web Browsers" is supported if `additional` flag is `true` (default).
 * See https://www.ecma-international.org/ecma-262/10.0/index.html#sec-regular-expressions-patterns.
 */
export class Parser {
  /** The source pattern string to parse. */
  private source: string;
  /** The flags string. */
  private flags: string;

  /* Parsed flags. */
  private flagSet!: FlagSet;

  /**
   * A flag whether support "Additional ECMAScript Features for Web Browsers" syntax.
   *
   * See https://www.ecma-international.org/ecma-262/10.0/index.html#sec-regular-expressions-patterns.
   */
  private additional: boolean;

  /** Precalculated number of capture group parens. */
  private captureParens = 0;
  /** Precalculated `Map` associate from capture group name to its index. */
  private names: Map<string, number> = new Map();

  /** Is the `flagSet` has `unicode`? */
  private get unicode(): boolean {
    return this.flagSet.unicode;
  }

  /** The current position of `source` string on parsing. */
  private pos = 0;
  /** The current capture group parens index number. */
  private captureParensIndex = 0;

  constructor(source: string, flags = '', additional = true) {
    this.source = source;
    this.flags = flags;
    this.additional = additional;
  }

  /** Run this parser. */
  public parse(): Pattern {
    this.flagSet = this.preprocessFlags();
    this.preprocessCaptures();

    this.pos = 0;
    const child = this.parseDisjunction();
    if (this.current() !== '') {
      throw new RegExpSyntaxError("too many ')'");
    }

    return {
      type: 'Pattern',
      flagSet: this.flagSet,
      captureParens: this.captureParens,
      names: this.names,
      child,
      range: [0, this.pos],
    };
  }

  /** Parse flags. */
  private preprocessFlags(): FlagSet {
    const flagSet: FlagSet = {
      global: false,
      ignoreCase: false,
      multiline: false,
      unicode: false,
      dotAll: false,
      sticky: false,
    };

    for (const c of this.flags) {
      switch (c) {
        case 'g':
          if (flagSet.global) {
            throw new RegExpSyntaxError("duplicated 'g' flag");
          }
          flagSet.global = true;
          break;
        case 'i':
          if (flagSet.ignoreCase) {
            throw new RegExpSyntaxError("duplicated 'i' flag");
          }
          flagSet.ignoreCase = true;
          break;
        case 'm':
          if (flagSet.multiline) {
            throw new RegExpSyntaxError("duplicated 'm' flag");
          }
          flagSet.multiline = true;
          break;
        case 's':
          if (flagSet.dotAll) {
            throw new RegExpSyntaxError("duplicated 's' flag");
          }
          flagSet.dotAll = true;
          break;
        case 'u':
          if (flagSet.unicode) {
            throw new RegExpSyntaxError("duplicated 'u' flag");
          }
          flagSet.unicode = true;
          break;
        case 'y':
          if (flagSet.sticky) {
            throw new RegExpSyntaxError("duplicated 's' flag");
          }
          flagSet.sticky = true;
          break;
        default:
          throw new RegExpSyntaxError('unknown flag');
      }
    }

    return flagSet;
  }

  /**
   * Count number of capture group parens, and collect names.
   *
   * This process is needed before parsing because the syntax changes
   * its behavior when a pattern has named captrue.
   */
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

  /** Skip character class without parsing. */
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

  /**
   * Parse `disjunction` pattern.
   *
   * See https://www.ecma-international.org/ecma-262/10.0/index.html#prod-Disjunction.
   */
  private parseDisjunction(): Node {
    const begin = this.pos;
    const children = [this.parseSequence()];

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

    return { type: 'Disjunction', children, range: [begin, this.pos] };
  }

  /**
   * Parse `sequence` pattern.
   *
   * `sequence` is named `Alternative` in ECMA-262 specification.
   * However this naming is very confusing because
   * it does not make sence without the relation to `Disjunction`.
   * In formal language theory, `sequence` or `concatination` is better.
   *
   * See https://www.ecma-international.org/ecma-262/10.0/index.html#prod-Alternative.
   */
  private parseSequence(): Node {
    const begin = this.pos;
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

    return { type: 'Sequence', children, range: [begin, this.pos] };
  }

  /**
   * Parse `quantifier` pattern.
   *
   * `quantifier` is one of `*`, `+`, `?` and `{n,m}` suffix operators,
   * and they can follow `?` for non-greedy matching.
   *
   * Note that ECMA-262 specification does not allow to quantify assertions like `/\b/`.
   *
   * See https://www.ecma-international.org/ecma-262/10.0/index.html#prod-Quantifier,
   * and https://www.ecma-international.org/ecma-262/10.0/index.html#prod-Term.
   */
  private parseQuantifier(): Node {
    const begin = this.pos;
    const child = this.parseAtom();

    if (isAssertion(child)) {
      if (this.additional && !this.unicode && child.type === 'LookAhead') {
        // In this case, maybe repetition has look-ahead as child.
      } else {
        return child;
      }
    }

    switch (this.current()) {
      case '*':
        return this.parseSimpleQuantifier('Many', begin, child);
      case '+':
        return this.parseSimpleQuantifier('Some', begin, child);
      case '?':
        return this.parseSimpleQuantifier('Optional', begin, child);
      case '{':
        return this.parseRepeat(begin, child);
    }

    return child;
  }

  /**
   * Parse simple quantifier suffix.
   *
   * Simple quantifier suffix means quantifiers execpt for `{n,m}`.
   */
  private parseSimpleQuantifier(
    type: 'Many' | 'Some' | 'Optional',
    begin: number,
    child: Node
  ): Node {
    this.pos += 1; // skip one of '*', '+', '?'
    let nonGreedy = false;
    if (this.current() === '?') {
      this.pos += 1; // skip '?'
      nonGreedy = true;
    }
    return { type, nonGreedy, child, range: [begin, this.pos] };
  }

  /**
   * Parse repeat quantifier suffix (`{n}`, `{n,m}` or `{n,}`).
   *
   * When parsing is failed, however it is in `additional` mode,
   * it is retryable. And the real parsing is done by
   * `tryParseRepeatQuantifier` method.
   */
  private parseRepeat(begin: number, child: Node): Node {
    const save = this.pos;
    const quantifier = this.tryParseRepeatQuantifier();
    if (quantifier === null) {
      if (this.additional && !this.unicode) {
        this.pos = save;
        return child;
      }
      throw new RegExpSyntaxError('incomplete quantifier');
    }

    const { min, max } = quantifier;
    if (min > (max ?? min)) {
      throw new RegExpSyntaxError('numbers out of order in quantifier');
    }

    let nonGreedy = false;
    if (this.current() === '?') {
      this.pos += 1; // skip '?'
      nonGreedy = true;
    }

    return { type: 'Repeat', min, max, nonGreedy, child, range: [begin, this.pos] };
  }

  /**
   * Try to parse repeat quantifier.
   *
   * This method is separated from `parseRepeat` because
   * it is reused by `parseAtom` to detect "nothing to repeat" error
   * of repeat quantifier.
   *
   * When parsing is failed, it does not consume any character and return `null`.
   */
  private tryParseRepeatQuantifier(): RepeatQuantifier | null {
    const save = this.pos;
    this.pos += 1; // skip '{'

    const min = this.parseDigits();
    if (min < 0) {
      this.pos = save;
      return null;
    }

    let max: number | null = null;
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

  /**
   * Parse `atom` pattern.
   *
   * This method also parses `assertion` pattern.
   *
   * See https://www.ecma-international.org/ecma-262/10.0/index.html#prod-Assertion,
   * and https://www.ecma-international.org/ecma-262/10.0/index.html#prod-Atom.
   */
  private parseAtom(): Node {
    const begin = this.pos;
    const c = this.current();
    switch (c) {
      case '.':
        this.pos++; // skip '.'
        return { type: 'Dot', range: [begin, this.pos] };
      case '^':
        this.pos++; // skip '^'
        return { type: 'LineBegin', range: [begin, this.pos] };
      case '$':
        this.pos++; // skip '$'
        return { type: 'LineEnd', range: [begin, this.pos] };
      case '[':
        return this.parseClass();
      case '\\':
        return this.parseEscape();
      case '(':
        return this.parseParen();
      case '*':
      case '+':
      case '?':
        throw new RegExpSyntaxError('nothing to repeat');
      case '{':
        if (this.additional && !this.unicode) {
          const quantifier = this.tryParseRepeatQuantifier();
          if (quantifier !== null) {
            throw new RegExpSyntaxError('nothing to repeat');
          }
          break;
        }
        throw new RegExpSyntaxError('lone quantifier brackets');
      case '}':
        if (this.additional && !this.unicode) {
          break;
        }
        throw new RegExpSyntaxError('lone quantifier brackets');
      case ']':
        if (this.additional && !this.unicode) {
          break;
        }
        throw new RegExpSyntaxError('lone character class brackets');
      case ')':
      case '|':
      case '':
        // Because this characters are handled by `parseSequence`.
        throw new Error('BUG: invalid character');
    }

    // All cases are through, then it should be a simple source character.

    this.pos += c.length; // skip any character
    const value = c.codePointAt(0);
    if (value === undefined) {
      throw new Error('BUG: invalid character');
    }
    return { type: 'Char', value, raw: c, range: [begin, this.pos] };
  }

  /** Parse `character class` pattern. */
  private parseClass(): Node {
    const begin = this.pos;
    this.pos++; // skip '['

    let invert = false;
    if (this.current() === '^') {
      this.pos++; // skip '^'
      invert = true;
    }

    const children: ClassItem[] = [];

    for (;;) {
      const c = this.current();
      if (c === ']') {
        break;
      }
      children.push(this.parseClassItem());
    }
    this.pos++; // skip ']'

    return { type: 'Class', invert, children, range: [begin, this.pos] };
  }

  /** Parse an item of `character class` pattern. */
  private parseClassItem(): ClassItem {
    const beginPos = this.pos;

    const begin = this.parseClassAtom();
    if (this.current() !== '-') {
      return begin;
    }
    if (this.source.startsWith('-]', this.pos)) {
      return begin;
    }

    if (begin.type === 'EscapeClass') {
      if (this.additional && !this.unicode) {
        return begin;
      }
      throw new RegExpSyntaxError('invalid character class');
    }

    const save = this.pos;
    this.pos++; // skip '-'
    const end = this.parseClassAtom();
    if (end.type === 'EscapeClass') {
      if (this.additional && !this.unicode) {
        this.pos = save;
        return begin;
      }
      throw new RegExpSyntaxError('invalid character class');
    }

    if (begin.value > end.value) {
      throw new RegExpSyntaxError('range out of order in character class');
    }

    return { type: 'ClassRange', children: [begin, end], range: [beginPos, this.pos] };
  }

  /** Parse an atom of `character class` range. */
  private parseClassAtom(): Char | EscapeClass {
    const begin = this.pos;
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
      return { type: 'Char', value, raw: c, range: [begin, this.pos] };
    }

    if (this.source.startsWith('\\-', this.pos)) {
      this.pos += 2; // skip '\\-'
      return { type: 'Char', value: 0x2d, raw: '\\-', range: [begin, this.pos] };
    }

    if (this.source.startsWith('\\b', this.pos)) {
      this.pos += 2; // skip '\\b'
      return { type: 'Char', value: 0x08, raw: '\\b', range: [begin, this.pos] };
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

  /**
   * Parse `escape sequence` pattern including `escape sequence character class`,
   * `back reference` and `word boundary assertion` patterns.
   */
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

  /** Try to parse `word boundary` pattern. */
  private tryParseWordBoundary(): Node | null {
    const begin = this.pos;

    if (this.source.startsWith('\\b', this.pos)) {
      this.pos += 2; // skip '\\b'
      return { type: 'WordBoundary', invert: false, range: [begin, this.pos] };
    }

    if (this.source.startsWith('\\B', this.pos)) {
      this.pos += 2; // skip '\\B'
      return { type: 'WordBoundary', invert: true, range: [begin, this.pos] };
    }

    return null;
  }

  /** Try to parse `back reference` pattern. */
  private tryParseBackRef(): Node | null {
    const begin = this.pos;
    this.pos++; // skip '\\';

    if (this.names.size > 0) {
      if (this.current() === 'k') {
        this.pos++; // skip 'k'
        if (this.current() !== '<') {
          throw new RegExpSyntaxError('invalid named back reference');
        }
        const namePos = ++this.pos; // skip '<'
        const name = this.parseCaptureName();
        return {
          type: 'NamedBackRef',
          name,
          raw: this.source.slice(namePos, this.pos - 1),
          range: [begin, this.pos],
        };
      }
    }

    if (this.current() !== '0') {
      const index = this.parseDigits();
      if (index >= 1) {
        if (this.additional && !this.unicode) {
          if (index <= this.captureParens) {
            return { type: 'BackRef', index, range: [begin, this.pos] };
          }
        } else {
          return { type: 'BackRef', index, range: [begin, this.pos] };
        }
      }
    }

    this.pos = begin;
    return null;
  }

  /** Try to parse `escape sequence` pattern. */
  private tryParseEscape(): Char | null {
    const begin = this.pos;

    const unicode = this.tryParseUnicodeEscape();
    if (unicode !== '') {
      const value = unicode.codePointAt(0);
      if (value === undefined) {
        throw new Error('BUG: invalid character');
      }
      return {
        type: 'Char',
        value,
        raw: this.source.slice(begin, this.pos),
        range: [begin, this.pos],
      };
    }

    this.pos++; // skip '\\'
    switch (this.current()) {
      case 't':
        this.pos++; // skip 't'
        return { type: 'Char', value: 0x09, raw: '\\t', range: [begin, this.pos] };
      case 'n':
        this.pos++; // skip 'n'
        return { type: 'Char', value: 0x0a, raw: '\\n', range: [begin, this.pos] };
      case 'v':
        this.pos++; // skip 'v'
        return { type: 'Char', value: 0x0b, raw: '\\v', range: [begin, this.pos] };
      case 'f':
        this.pos++; // skip 'f'
        return { type: 'Char', value: 0x0c, raw: '\\f', range: [begin, this.pos] };
      case 'r':
        this.pos++; // skip 'r'
        return { type: 'Char', value: 0x0d, raw: '\\r', range: [begin, this.pos] };
      case 'c': {
        this.pos++; // skip 'c'
        const c = this.current();
        let value = 0;
        if (isControl(c)) {
          this.pos++; // skip a-z or A-Z
          value = c.charCodeAt(0) % 32;
        } else {
          if (this.additional && !this.unicode) {
            this.pos--; // go back 'c'
            break;
          }
          throw new RegExpSyntaxError('invalid control escape');
        }
        return {
          type: 'Char',
          value,
          raw: this.source.slice(begin, this.pos),
          range: [begin, this.pos],
        };
      }
      case 'x': {
        this.pos++; // skip 'x'
        const value = this.tryParseHexDigitsN(2);
        if (value < 0) {
          this.pos--; // go back 'x'
          break;
        }
        return {
          type: 'Char',
          value,
          raw: this.source.slice(begin, this.pos),
          range: [begin, this.pos],
        };
      }
      case '0': {
        this.pos++; // skip '0'
        if (isDigit(this.current())) {
          this.pos--; // go back '0'
          break;
        }
        return { type: 'Char', value: 0, raw: '\\0', range: [begin, this.pos] };
      }
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
        return {
          type: 'Char',
          value,
          raw: this.source.slice(begin, this.pos),
          range: [begin, this.pos],
        };
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
        return { type: 'Char', value, raw: `\\${c}`, range: [begin, this.pos] };
      }
    } else {
      if (this.additional) {
        if (c === 'c') {
          return { type: 'Char', value: 0x5c, raw: '\\', range: [begin, this.pos] };
        }
        if (this.names.size === 0 || c !== 'k') {
          this.pos += c.length; // skip any char
          return { type: 'Char', value, raw: `\\${c}`, range: [begin, this.pos] };
        }
      } else {
        if (!idContinue.has(value)) {
          this.pos += c.length; // skip any char
          return { type: 'Char', value, raw: `\\${c}`, range: [begin, this.pos] };
        }
      }
    }

    this.pos = begin;
    return null;
  }

  /**
   * Try to parse `\uXXXX` or `\u{XXXXXX}` escape sequence.
   *
   * This method is separated from `tryParseEscape` because
   * it is reused by `parseCaptureNameChar`.
   *
   * When it is failed, it returns `''`.
   */
  private tryParseUnicodeEscape(lead = true): string {
    const begin = this.pos;
    this.pos++; // skip '\\'

    if (this.current() !== 'u') {
      this.pos = begin;
      return '';
    }
    this.pos++; // skip 'u'

    if (this.unicode && this.current() === '{') {
      if (!lead) {
        this.pos = begin;
        return '';
      }
      this.pos++; // skip '{'
      const c = this.parseHexDigits();
      if (c < 0 || 0x110000 <= c || this.current() !== '}') {
        throw new RegExpSyntaxError('invalid Unicode escape');
      }
      this.pos++; // skip '}'
      return String.fromCodePoint(c);
    }

    const c = this.tryParseHexDigitsN(4);
    if (c < 0) {
      if (this.additional && !this.unicode) {
        this.pos = begin;
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

  /** Try to parse `escape sequence character class` pattern. */
  private tryParseEscapeClass(): EscapeClass | null {
    const begin = this.pos;
    this.pos++; // skip '\\'

    const c = this.current();
    switch (c) {
      case 'd':
      case 'D':
        this.pos++; // skip 'd' or 'D'
        return { type: 'EscapeClass', kind: 'digit', invert: c === 'D', range: [begin, this.pos] };
      case 'w':
      case 'W':
        this.pos++; // skip 'w' or 'W'
        return { type: 'EscapeClass', kind: 'word', invert: c === 'W', range: [begin, this.pos] };
      case 's':
      case 'S':
        this.pos++; // skip 's' or 'S'
        return { type: 'EscapeClass', kind: 'space', invert: c === 'S', range: [begin, this.pos] };
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
          return {
            type: 'EscapeClass',
            kind: 'unicode_property',
            property,
            invert,
            range: [begin, this.pos],
          };
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

        return {
          type: 'EscapeClass',
          kind: 'unicode_property_value',
          property,
          value,
          invert,
          range: [begin, this.pos],
        };
      }
    }

    this.pos = begin;
    return null;
  }

  /** Parse the first component of `\p{XXX=XXX}` escape sequence. */
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

  /** Parse the second component of `\p{XXX=XXX}` escape sequence. */
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

  /** Parse grouping pattern by paren. */
  private parseParen(): Node {
    const begin = this.pos;

    if (!this.source.startsWith('(?', this.pos)) {
      this.pos++; // skip '('
      const child = this.parseDisjunction();
      const index = ++this.captureParensIndex;
      if (this.current() !== ')') {
        throw new RegExpSyntaxError('unterminated capture');
      }
      this.pos++; // skip ')'
      return { type: 'Capture', index, child, range: [begin, this.pos] };
    }

    if (this.source.startsWith('(?:', this.pos)) {
      this.pos += 3; // skip '(?:'
      const child = this.parseDisjunction();
      if (this.current() !== ')') {
        throw new RegExpSyntaxError('unterminated group');
      }
      this.pos++; // skip ')'
      return { type: 'Group', child, range: [begin, this.pos] };
    }

    if (this.source.startsWith('(?=', this.pos)) {
      this.pos += 3; // skip '(?='
      const child = this.parseDisjunction();
      if (this.current() !== ')') {
        throw new RegExpSyntaxError('unterminated look-ahead');
      }
      this.pos++; // skip ')'
      return { type: 'LookAhead', negative: false, child, range: [begin, this.pos] };
    }

    if (this.source.startsWith('(?!', this.pos)) {
      this.pos += 3; // skip '(?!'
      const child = this.parseDisjunction();
      if (this.current() !== ')') {
        throw new RegExpSyntaxError('unterminated look-ahead');
      }
      this.pos++; // skip ')'
      return { type: 'LookAhead', negative: true, child, range: [begin, this.pos] };
    }

    if (this.source.startsWith('(?<=', this.pos)) {
      this.pos += 4; // skip '(?<='
      const child = this.parseDisjunction();
      if (this.current() !== ')') {
        throw new RegExpSyntaxError('unterminated look-behind');
      }
      this.pos++; // skip ')'
      return { type: 'LookBehind', negative: false, child, range: [begin, this.pos] };
    }

    if (this.source.startsWith('(?<!', this.pos)) {
      this.pos += 4; // skip '(?<!'
      const child = this.parseDisjunction();
      if (this.current() !== ')') {
        throw new RegExpSyntaxError('unterminated look-behind');
      }
      this.pos++; // skip ')'
      return { type: 'LookBehind', negative: true, child, range: [begin, this.pos] };
    }

    if (this.source.startsWith('(?<', this.pos)) {
      const index = ++this.captureParensIndex;
      this.pos += 3; // skip '(?<'
      const namePos = this.pos;
      const name = this.parseCaptureName();
      const raw = this.source.slice(namePos, this.pos - 1);
      if (this.names.get(name) !== index) {
        throw new Error('BUG: invalid named capture');
      }
      const child = this.parseDisjunction();
      if (this.current() !== ')') {
        throw new RegExpSyntaxError('unterminated named capture');
      }
      this.pos++; // skip ')'
      return { type: 'NamedCapture', name, raw, child, range: [begin, this.pos] };
    }

    throw new RegExpSyntaxError('invalid group');
  }

  /**
   * Parse capture name.
   *
   * This method is used by `preprocessParens`, `tryParseBackRef` and `parseParen`.
   */
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

  /**
   * Parse capture name character.
   *
   * Unicode escape sequences are used as capture name character.
   */
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
