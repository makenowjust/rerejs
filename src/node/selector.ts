/** Type for REQuery selector AST node. */
export type Selector =
  // '*' selector
  | { type: 'universal' }
  // type selector (e.g. `Char`)
  | { type: 'type'; value: string }
  // `:is` selector (e.g. `:is(Char, Class)`), or toplevel selector list
  | { type: 'is'; selectors: Selector[] }
  // compound selector (e.g. `[value=l][raw=l]`)
  | { type: 'compound'; selectors: Selector[] }
  // `:not` selector (e.g. `:not(Char)`)
  | { type: 'not'; selectors: Selector[] }
  // `:has` selector (e.g. `:has(> Char)`)
  | { type: 'has'; selectors: RelativeSelector[] }
  // child `>` selector (e.g. `Class >  Char`)
  | { type: 'child'; left: Selector; right: Selector }
  // descendant ` ` selector (e.g. `Class Char`)
  | { type: 'descendant'; left: Selector; right: Selector }
  // sibling `~` selector (e.g. `Class ~ Char`)
  | { type: 'sibling'; left: Selector; right: Selector }
  // adjacent `+` selector (e.g. `Class + Char`)
  | { type: 'adjacent'; left: Selector; right: Selector }
  // `[path op value]` attribute selector (e.g. `[value=l]`)
  | {
      type: 'attribute';
      path: string[];
      operator: AttributeSelectorOperator;
      value: AttributeSelectorValue;
    }
  // `[path]` attribute existence selector (e.g. `[flagSet.unicode]`)
  | {
      type: 'attribute';
      path: string[];
      operator: 'exist';
    }
  // `:nth-child` selector (e.g. `:nth-child(2n+1)`)
  | { type: 'nth-child'; index: NthChildSelectorIndex }
  // `:nth-last-child` selector (e.g. `:nth-last-child(2n+1)`)
  | { type: 'nth-last-child'; index: NthChildSelectorIndex }
  // `:scope` selector
  | { type: 'scope' }
  // `:pseudo-class` selector (e.g. `:char`)
  | { type: 'class'; name: ClassSelectorName };

/** Type for selector of `:has(...)` selector argument. */
export type RelativeSelector = {
  op: 'descendant' | 'child' | 'sibling' | 'adjacent';
  // Note that this selector is absolutized,
  // it means `:scope` and the operator is prepended.
  selector: Selector;
};

/** Type for attribute selector operators. */
export type AttributeSelectorOperator = '=' | '!=' | '<=' | '>=' | '<' | '>';

/** Type for attribute selector values.  */
export type AttributeSelectorValue =
  | { type: 'regexp'; value: RegExp }
  | { type: 'literal'; value: string | number | boolean | null }
  | { type: 'type'; value: string };

/** Type for `:nth-child` and `:nth-last-child` index specifier. */
export type NthChildSelectorIndex =
  | { type: 'literal'; value: number }
  | { type: 'step'; by: number; initial: number };

/**
 * Types for `:pseudo-class` names.
 *
 * - `:assertion` matches `LookAhead`, `LookBehind`, `WordBoundary`, `LineBegin` and `LineEnd`.
 * - `:back-ref` matches `BackRef` and `NamedBackRef`.
 * - `:capture` matches `Capture` and `NamedCapture`.
 * - `:char` matches `Char`, `Dot`, `Class` and `EscapeClass` (but not in `Class`).
 * - `:group` matches `Group`, `Capture` and `NamedCapture`
 * - `:look-around` matches `LookAhead` and `LookBehind`.
 * - `:repeat` matches `Many`, `Some`, `Optional` and `Repeat`.
 */
export type ClassSelectorName =
  | 'assertion'
  | 'back-ref'
  | 'capture'
  | 'char'
  | 'group'
  | 'look-around'
  | 'repeat';

/** Check the given character is part of identifier name. */
const isIdentifier = (c: string | undefined): boolean => !!c && !' [\\],():#!=><~+.'.includes(c);

/** `SelectorParser` is parser of REQuery selector. */
export class SelectorParser {
  /** The source selector string to parse. */
  private source: string;
  /** The current position of `source` string on parsing. */
  private pos = 0;

  constructor(source: string) {
    this.source = source;
  }

  /** Run this parser. */
  public parse(): Selector {
    this.skipWhitespace();
    const selectors = this.parseSelectors();
    if (this.pos !== this.source.length) {
      this.invalid();
    }
    return selectors.length >= 2 ? { type: 'is', selectors } : selectors[0];
  }

  /** Parse comma separated selectors. */
  private parseSelectors(): Selector[] {
    const selectors = [this.parseSelector()];

    this.skipWhitespace();
    while (this.source[this.pos] === ',') {
      this.pos++; // skip ','
      this.skipWhitespace();
      selectors.push(this.parseSelector());
    }

    return selectors;
  }

  /** Parse a selector. */
  private parseSelector(): Selector {
    let left = this.parseCompound();

    for (;;) {
      const type = this.parseBinaryOp();
      if (!type) {
        break;
      }
      this.skipWhitespace();
      const right = this.parseCompound();
      left = { type, left, right };
    }

    return left;
  }

  /**
   * Parse a binary operator between selectors.
   *
   * It returns `null` when operator is missing.
   */
  private parseBinaryOp(): 'child' | 'sibling' | 'adjacent' | 'descendant' | null {
    const consumed = this.skipWhitespace();

    switch (this.source[this.pos]) {
      case '>':
        this.pos++;
        return 'child';
      case '~':
        this.pos++;
        return 'sibling';
      case '+':
        this.pos++;
        return 'adjacent';
      case undefined:
      case ',':
      case ')':
        return null;
    }

    return consumed ? 'descendant' : null;
  }

  /** Parse compound selector. */
  private parseCompound(): Selector {
    const selectors = [this.parseFirstAtom()];
    for (;;) {
      const atom = this.tryParseAtom();
      if (!atom) {
        break;
      }
      selectors.push(atom);
    }

    return selectors.length >= 2 ? { type: 'compound', selectors } : selectors[0];
  }

  /**
   * Parse the first atom of compound selector.
   *
   * A type selector and `*` selector are only allowed as the first atom.
   * If they are allowed as the second-or-more atoms, then `*Char` is valid,
   * however it must be invalid.
   */
  private parseFirstAtom(): Selector {
    const atom = this.tryParseAtom();
    if (atom) {
      return atom;
    }

    if (this.source[this.pos] === '*') {
      this.pos++; // skip '*'
      return { type: 'universal' };
    }

    const id = this.parseIdentifier();
    if (id.length > 0) {
      return { type: 'type', value: id };
    }

    this.invalid();
  }

  /** Parse atom of compound selector. */
  private tryParseAtom(): Selector | null {
    if (this.source[this.pos] === ':') {
      this.pos++; // skip ':'
      const name = this.parseIdentifier();
      switch (name) {
        case 'not':
        case 'is':
          return this.parseSelectorsPseudoClass(name);
        case 'has':
          return this.parseRelativeSelectorsPseudoClass(name);
        case 'nth-child':
        case 'nth-last-child':
          return this.parseNthChildPseudoClass(name);
        case 'first-child':
          return { type: 'nth-child', index: { type: 'literal', value: 1 } };
        case 'last-child':
          return { type: 'nth-last-child', index: { type: 'literal', value: 1 } };
        case 'scope':
          return { type: 'scope' }; // Is there use case of `:scope`?
        case 'assertion':
        case 'back-ref':
        case 'capture':
        case 'char':
        case 'group':
        case 'look-around':
        case 'repeat':
          return { type: 'class', name };
      }
      this.invalid(`unknown pseudo class name: ${JSON.stringify(name)}`);
    }

    if (this.source[this.pos] === '[') {
      this.pos++; // skip '['
      this.skipWhitespace();
      const path = this.parsePath();

      this.skipWhitespace();
      let operator: AttributeSelectorOperator | null = null;
      let value: AttributeSelectorValue | null = null;
      const op2 = this.source.substr(this.pos, 2);
      switch (op2) {
        case '!=':
          this.pos += 2; // skip '!='
          operator = op2;
          value = this.parseAttributeValue(true);
          break;
        case '<=':
        case '>=':
          this.pos += 2; // skip '<=' or '>='
          operator = op2;
          value = this.parseAttributeValue(false);
          break;
        default: {
          const op1 = this.source[this.pos];
          switch (op1) {
            case '=':
              this.pos++; // skip '='
              operator = op1;
              value = this.parseAttributeValue(true);
              break;
            case '<':
            case '>':
              this.pos++; // skip '='
              operator = op1;
              value = this.parseAttributeValue(true);
              break;
          }
        }
      }

      this.skipWhitespace();
      if (this.source[this.pos] !== ']') {
        this.invalid();
      }
      this.pos++; // skip ']'

      if (!operator || !value) {
        return { type: 'attribute', path, operator: 'exist' };
      }

      return { type: 'attribute', path, operator, value };
    }

    return null;
  }

  /** Parse `:not` or `:is` pseudo class selector. */
  private parseSelectorsPseudoClass(type: 'not' | 'is'): Selector {
    if (this.source[this.pos] !== '(') {
      this.invalid();
    }
    this.pos++; // skip '('
    this.skipWhitespace();

    const selectors = this.parseSelectors();

    this.skipWhitespace();
    if (this.source[this.pos] !== ')') {
      this.invalid();
    }
    this.pos++; // skip ')'

    return { type, selectors };
  }

  /** Parse `:has` pseudo class selector. */
  private parseRelativeSelectorsPseudoClass(type: 'has'): Selector {
    if (this.source[this.pos] !== '(') {
      this.invalid();
    }
    this.pos++; // skip '('
    this.skipWhitespace();

    const selectors = this.parseRelativeSelectors();

    this.skipWhitespace();
    if (this.source[this.pos] !== ')') {
      this.invalid();
    }
    this.pos++; // skip ')'

    return { type, selectors };
  }

  /** Parse comma separated relative selector list. */
  private parseRelativeSelectors(): RelativeSelector[] {
    const selectors = [this.parseRelativeSelector()];

    this.skipWhitespace();
    while (this.source[this.pos] === ',') {
      this.pos++; // skip ','
      this.skipWhitespace();
      selectors.push(this.parseRelativeSelector());
    }

    return selectors;
  }

  /**
   * Parse relative selector like `> Char`.
   *
   * The result of selector is *absolutized*,
   * it means `> Char` is absolutized to `:scope > Char`.
   *
   * Note that this is not supporting **abosolutize** rule in the specification correctly.
   * It enforces prepending `:scope` to the selector even if it contains `:scope`.
   *
   * See https://drafts.csswg.org/selectors-4/#absolutizing.
   */
  private parseRelativeSelector(): RelativeSelector {
    const type = this.parseBinaryOp() ?? 'descendant';
    this.skipWhitespace();
    const selector = this.parseSelector();

    const fix = (s: Selector): Selector => {
      switch (s.type) {
        case 'descendant':
        case 'child':
        case 'adjacent':
        case 'sibling':
          return { type: s.type, left: fix(s.left), right: s.right };
      }
      return { type, left: { type: 'scope' }, right: s };
    };
    return { op: type, selector: fix(selector) };
  }

  /** Parse `:nth-child` or `:nth-last-child` pseudo class selector. */
  private parseNthChildPseudoClass(type: 'nth-child' | 'nth-last-child'): Selector {
    if (this.source[this.pos] !== '(') {
      this.invalid();
    }
    this.pos++; // skip '('
    this.skipWhitespace();

    let value: number;
    if (this.source[this.pos] === '-') {
      this.pos++; // skip '-'
      value = -this.parseInt();
    } else {
      value = this.parseInt();
    }

    let index: NthChildSelectorIndex;
    if (this.source[this.pos] === 'n') {
      this.pos++; // skip 'n'
      let initial = 0;
      this.skipWhitespace();
      if (this.source[this.pos] === '+') {
        this.pos++; // skip '+'
        initial = this.parseInt();
      } else if (this.source[this.pos] === '-') {
        this.pos++; // skip '-'
        initial = -this.parseInt();
      }
      index = { type: 'step', by: value, initial };
    } else {
      index = { type: 'literal', value };
    }

    this.skipWhitespace();
    if (this.source[this.pos] !== ')') {
      this.invalid();
    }
    this.pos++; // skip ')'

    return { type, index };
  }

  /** Parse dot separated names path. */
  private parsePath(): string[] {
    const name = this.parseIdentifier();
    if (name === '') {
      this.invalid();
    }

    const path = [name];

    while (this.source[this.pos] === '.') {
      this.pos++; // skip '.'
      const name = this.parseIdentifier();
      if (name === '') {
        this.invalid();
      }
      path.push(name);
    }

    return path;
  }

  /**
   * Parse attribute value.
   *
   * When `eq` is `true`, some special syntaxes is allowed.
   * (regexp, boolean, `null` literals, and `type(...)`)
   */
  private parseAttributeValue(eq: boolean): AttributeSelectorValue {
    this.skipWhitespace();

    if (eq) {
      // `type(...)` function
      if (this.source.startsWith('type(', this.pos)) {
        this.pos += 5; // skip 'type('
        this.skipWhitespace();
        const value = this.parseIdentifier();
        this.skipWhitespace();
        if (this.source[this.pos] !== ')') {
          this.invalid();
        }
        this.pos++; // skip ')'
        return { type: 'type', value };
      }

      // regexp literal
      if (this.source[this.pos] === '/') {
        const value = this.parseRegExp();
        return { type: 'regexp', value };
      }
    }

    if ('0' <= this.source[this.pos] && this.source[this.pos] <= '9') {
      const value = this.parseNumber();
      return { type: 'literal', value };
    }

    if (this.source[this.pos] === '"' || this.source[this.pos] === "'") {
      const value = this.parseString();
      return { type: 'literal', value };
    }

    const raw = this.parseIdentifier();
    if (eq) {
      if (raw === 'true' || raw === 'false') {
        return { type: 'literal', value: raw === 'true' };
      }
      if (raw === 'null') {
        return { type: 'literal', value: null };
      }
    }

    return { type: 'literal', value: raw };
  }

  /**
   * Parse an identifier.
   *
   * Possibly it returns an empty string.
   */
  private parseIdentifier(): string {
    const pos = this.pos;
    while (isIdentifier(this.source[this.pos])) {
      this.pos++; // skip identifier character.
    }
    return this.source.slice(pos, this.pos);
  }

  /** Parse an integer literal. */
  private parseInt(): number {
    const pos = this.pos;
    while ('0' <= this.source[this.pos] && this.source[this.pos] <= '9') {
      this.pos++; // skip digit character
    }
    let s = this.source.slice(pos, this.pos);
    if (pos === this.pos) {
      if (this.source[this.pos] === 'n') {
        s = '1';
      } else {
        this.invalid();
      }
    }
    return Number.parseInt(s, 10);
  }

  /** Parse a number literal. */
  private parseNumber(): number {
    const pos = this.pos;
    while ('0' <= this.source[this.pos] && this.source[this.pos] <= '9') {
      this.pos++; // skip digit character
    }
    if (this.source[this.pos] === '.') {
      this.pos++; // skip '.'
      while ('0' <= this.source[this.pos] && this.source[this.pos] <= '9') {
        this.pos++; // skip digit character
      }
    }
    if (pos === this.pos) {
      this.invalid();
    }
    const s = this.source.slice(pos, this.pos);
    return Number.parseFloat(s);
  }

  /** Parse a string literal. */
  private parseString(): string {
    const q = this.source[this.pos];
    if (q !== '"' && q !== "'") {
      this.invalid();
    }
    this.pos++; // skip ['"]

    const pos = this.pos;
    while (this.source[this.pos] !== q) {
      switch (this.source[this.pos++]) {
        case undefined:
          this.invalid();
        case '\\':
          this.pos++;
          break;
      }
    }
    const value = this.source.slice(pos, this.pos);

    this.pos++; // skip q

    return value.replace(
      /\\(?:[xX](?<hex>[0-9a-fA-F]{2})|u(?<unicode>[0-9a-fA-F]{4})|u\{(?<unicode_full>[0-9a-fA-F]*)\}|(?<escape>.))/,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: string, ...args: any[]) => {
        const groups: { [key: string]: string } = args[args.length - 1];
        const hex = groups['hex'] ?? groups['unicode'] ?? groups['unicode_full'];
        if (typeof hex === 'string') {
          return String.fromCodePoint(Number.parseInt(hex, 16));
        }
        switch (groups['escape']) {
          case 'b':
            return '\b';
          case 'f':
            return '\f';
          case 'n':
            return '\n';
          case 'v':
            return '\v';
          case 't':
            return '\t';
          case 'r':
            return '\r';
        }
        return groups['escape'];
      }
    );
  }

  /** Parse regexp literal. */
  private parseRegExp(): RegExp {
    if (this.source[this.pos] !== '/') {
      this.invalid();
    }
    this.pos++; // skip '/'

    const pos = this.pos;
    while (this.source[this.pos] !== '/') {
      switch (this.source[this.pos++]) {
        case undefined:
          this.invalid();
        case '\\':
          this.pos++;
          break;
        case '[':
          while (this.source[this.pos] !== ']') {
            switch (this.source[this.pos++]) {
              case undefined:
                this.invalid();
              case '\\':
                this.pos++;
            }
          }
          this.pos++; // skip ']'
          break;
      }
    }
    const source = this.source.slice(pos, this.pos);
    this.pos++; // skip '/'

    let flags = '';
    for (;;) {
      const c = this.source[this.pos];
      switch (c) {
        case 'i':
        case 'm':
        case 's':
        case 'u':
          this.pos++; // skip [imsu]
          flags += c;
          continue;
      }
      break;
    }

    return new RegExp(source, flags);
  }

  /**
   * Skips white speces.
   *
   * If it consumes at least one white space, it returns `true`.
   * Otherwise it returns `false`.
   */
  private skipWhitespace(): boolean {
    let ret = false;
    while (this.source[this.pos] === ' ') {
      this.pos++;
      ret = true;
    }
    return ret;
  }

  /** Throws a parsing error. */
  private invalid(message = `invalid character '${this.source[this.pos] ?? ''}'`): never {
    throw new Error(`${message} (at position ${this.pos})`);
  }
}
