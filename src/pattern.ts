/** Type for whole regular expression pattern. */
export type Pattern = {
  type: 'Pattern';
  flagSet: FlagSet;
  captureParens: number;
  names: Map<string, number>;
  child: Node;
  range: [number, number];
};

/** Types for regular expression flags. */
export type FlagSet = {
  global: boolean;
  ignoreCase: boolean;
  multiline: boolean;
  dotAll: boolean;
  unicode: boolean;
  sticky: boolean;
};

/** Type for part of regular expression pattern. */
export type Node =
  | Select
  | Sequence
  | Capture
  | NamedCapture
  | Group
  | Many
  | Some
  | Optional
  | Repeat
  | WordBoundary
  | LineBegin
  | LineEnd
  | LookAhead
  | LookBehind
  | Char
  | EscapeClass
  | Class
  | Dot
  | BackRef
  | NamedBackRef;

/** Type for items of character class. */
export type ClassItem = Char | EscapeClass | ClassRange;

/** Type for select pattern `/(a|b)/`. */
export type Select = {
  type: 'Select';
  children: Node[];
  range: [number, number];
};

/** Type for sequence pattern `/(ab)/`. */
export type Sequence = {
  type: 'Sequence';
  children: Node[];
  range: [number, number];
};

/** Type for capture group `/(...)/`. */
export type Capture = {
  type: 'Capture';
  index: number;
  child: Node;
  range: [number, number];
};

/** Type for named capture group `/(?<x>...)/`. */
export type NamedCapture = {
  type: 'NamedCapture';
  name: string;
  raw: string;
  child: Node;
  range: [number, number];
};

/** Type for non-capture group `/(?:...)/`. */
export type Group = {
  type: 'Group';
  child: Node;
  range: [number, number];
};

/** Type for zero-or-more repetition pattern `/(a*)/`. */
export type Many = {
  type: 'Many';
  nonGreedy: boolean;
  child: Node;
  range: [number, number];
};

/** Type for one-or-more repetition pattern `/(a+)/`. */
export type Some = {
  type: 'Some';
  nonGreedy: boolean;
  child: Node;
  range: [number, number];
};

/** Type for skippable pattern `/(a?)/`. */
export type Optional = {
  type: 'Optional';
  nonGreedy: boolean;
  child: Node;
  range: [number, number];
};

/** Type for general repetition pattern `/(a{10,20})/`. */
export type Repeat = {
  type: 'Repeat';
  min: number;
  max: number | null;
  nonGreedy: boolean;
  child: Node;
  range: [number, number];
};

/** Type for word boundary assertion pattern `/(\b)/`. */
export type WordBoundary = {
  type: 'WordBoundary';
  invert: boolean;
  range: [number, number];
};

/** Type for line begin assertion pattern `/(^)/`. */
export type LineBegin = {
  type: 'LineBegin';
  range: [number, number];
};

/** Type for line end assertion pattern `/($)/`. */
export type LineEnd = {
  type: 'LineEnd';
  range: [number, number];
};

/** Type for look-ahead assertion `/(?=a)/`. */
export type LookAhead = {
  type: 'LookAhead';
  negative: boolean;
  child: Node;
  range: [number, number];
};

/** Type for look-behind assertion `/(?<=a)/`. */
export type LookBehind = {
  type: 'LookBehind';
  negative: boolean;
  child: Node;
  range: [number, number];
};

/** Type for character pattern `/a/`. */
export type Char = {
  type: 'Char';
  value: number;
  raw: string;
  range: [number, number];
};

/** Type for escape sequence class like `/\w/`. */
export type EscapeClass =
  | SimpleEscapeClass
  | UnicodePropertyEscapeClass
  | UnicodePropertyValueEscapeClass;

/** Type for simple escape sequence class like `/\d/`. */
export type SimpleEscapeClass = {
  type: 'EscapeClass';
  kind: 'digit' | 'word' | 'space';
  invert: boolean;
  range: [number, number];
};

/** Type for unicode property escape sequence class like `\p{Zs}`. */
export type UnicodePropertyEscapeClass = {
  type: 'EscapeClass';
  kind: 'unicode_property';
  invert: boolean;
  property: string;
  range: [number, number];
};

/** Type for unicode property value escape sequence class like `\p{Script=Hira}`. */
export type UnicodePropertyValueEscapeClass = {
  type: 'EscapeClass';
  kind: 'unicode_property_value';
  invert: boolean;
  property: string;
  value: string;
  range: [number, number];
};

/** Type for character class pattern `/[a-z]/`. */
export type Class = {
  type: 'Class';
  invert: boolean;
  items: ClassItem[];
  range: [number, number];
};

/** Type for character range in class pattern. */
export type ClassRange = {
  type: 'ClassRange';
  begin: Char;
  end: Char;
  range: [number, number];
};

/** Type for any character pattern `/./`. */
export type Dot = {
  type: 'Dot';
  range: [number, number];
};

/** Type for back reference pattern `/\1/`. */
export type BackRef = {
  type: 'BackRef';
  index: number;
  range: [number, number];
};

/** Type for named back reference pattern `/\k<x>/`. */
export type NamedBackRef = {
  type: 'NamedBackRef';
  name: string;
  raw: string;
  range: [number, number];
};

/** Show class item as string. */
const classItemToString = (n: ClassItem): string => {
  switch (n.type) {
    case 'Char':
      return n.raw;
    case 'EscapeClass':
      switch (n.kind) {
        case 'digit':
          return n.invert ? '\\D' : '\\d';
        case 'word':
          return n.invert ? '\\W' : '\\w';
        case 'space':
          return n.invert ? '\\S' : '\\s';
        case 'unicode_property':
          return `\\${n.invert ? 'P' : 'p'}{${n.property}}`;
        case 'unicode_property_value':
          return `\\${n.invert ? 'P' : 'p'}{${n.property}=${n.value}}`;
      }
      break;
    case 'ClassRange':
      return `${n.begin.raw}-${n.end.raw}`;
  }
};

/** Show node as string. */
export const nodeToString = (n: Node): string => {
  switch (n.type) {
    case 'Sequence':
      return n.children.map(nodeToString).join('');
    case 'Select':
      return n.children.map(nodeToString).join('|');
    case 'Capture':
      return `(${nodeToString(n.child)})`;
    case 'NamedCapture':
      return `(?<${n.raw}>${nodeToString(n.child)})`;
    case 'Group':
      return `(?:${nodeToString(n.child)})`;
    case 'Many':
      return `${nodeToString(n.child)}*${n.nonGreedy ? '?' : ''}`;
    case 'Some':
      return `${nodeToString(n.child)}+${n.nonGreedy ? '?' : ''}`;
    case 'Optional':
      return `${nodeToString(n.child)}?${n.nonGreedy ? '?' : ''}`;
    case 'Repeat': {
      let s = nodeToString(n.child);
      s += `{${n.min}`;
      if (n.max === Infinity) {
        s += ',';
      } else if ((n.max ?? n.min) != n.min) {
        s += `,${n.max}`;
      }
      s += '}' + (n.nonGreedy ? '?' : '');
      return s;
    }
    case 'WordBoundary':
      return n.invert ? '\\B' : '\\b';
    case 'LineBegin':
      return '^';
    case 'LineEnd':
      return '$';
    case 'LookAhead':
      return `(?${n.negative ? '!' : '='}${nodeToString(n.child)})`;
    case 'LookBehind':
      return `(?<${n.negative ? '!' : '='}${nodeToString(n.child)})`;
    case 'Char':
      switch (n.raw) {
        case '\n':
          return '\\n';
        case '\r':
          return '\\r';
        case '\u2028':
          return '\\u2028';
        case '\u2029':
          return '\\u2029';
      }
      return n.raw === '/' ? '\\/' : n.raw;
    case 'EscapeClass':
      return classItemToString(n);
    case 'Class':
      return `[${n.invert ? '^' : ''}${n.items.map(classItemToString).join('')}]`;
    case 'Dot':
      return '.';
    case 'BackRef':
      return `\\${n.index}`;
    case 'NamedBackRef':
      return `\\k<${n.raw}>`;
  }
};

/** Show flag set as string. */
export const flagSetToString = (set: FlagSet): string => {
  let s = '';
  if (set.global) {
    s += 'g';
  }
  if (set.ignoreCase) {
    s += 'i';
  }
  if (set.multiline) {
    s += 'm';
  }
  if (set.dotAll) {
    s += 's';
  }
  if (set.unicode) {
    s += 'u';
  }
  if (set.sticky) {
    s += 'y';
  }
  return s;
};

/** Show pattern as string. */
export const patternToString = (p: Pattern): string => {
  let s = '/';
  const n = nodeToString(p.child);
  s += n === '' ? '(?:)' : n;
  s += '/';
  s += flagSetToString(p.flagSet);
  return s;
};
