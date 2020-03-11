import { escape } from './escape';

/** Type for whole regular expression pattern. */
export type Pattern = {
  type: 'pattern';
  global: boolean;
  ignoreCase: boolean;
  multiline: boolean;
  unicode: boolean;
  dotAll: boolean;
  sticky: boolean;
  captureParens: number;
  names: Map<string, number>;
  child: Node;
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
  type: 'select';
  children: [Node, ...Node[]];
};

/** Type for sequence pattern `/(ab)/`. */
export type Sequence = {
  type: 'sequence';
  children: Node[];
};

/** Type for capture group `/(...)/`. */
export type Capture = {
  type: 'capture';
  index: number;
  child: Node;
};

/** Type for named capture group `/(?<x>...)/`. */
export type NamedCapture = {
  type: 'named_capture';
  name: string;
  child: Node;
};

/** Type for non-capture group `/(?:...)/`. */
export type Group = {
  type: 'group';
  child: Node;
};

/** Type for zero-or-more repetition pattern `/(a*)/`. */
export type Many = {
  type: 'many';
  nonGreedy: boolean;
  child: Node;
};

/** Type for one-or-more repetition pattern `/(a+)/`. */
export type Some = {
  type: 'some';
  nonGreedy: boolean;
  child: Node;
};

/** Type for skippable pattern `/(a?)/`. */
export type Optional = {
  type: 'optional';
  nonGreedy: boolean;
  child: Node;
};

/** Type for general repetition pattern `/(a{10,20})/`. */
export type Repeat = {
  type: 'repeat';
  min: number;
  max: number;
  nonGreedy: boolean;
  child: Node;
};

/** Type for word boundary assertion pattern `/(\b)/`. */
export type WordBoundary = {
  type: 'word_boundary';
  invert: boolean;
};

/** Type for line begin assertion pattern `/(^)/`. */
export type LineBegin = {
  type: 'line_begin';
};

/** Type for line end assertion pattern `/($)/`. */
export type LineEnd = {
  type: 'line_end';
};

/** Type for look-ahead assertion `/(?=a)/`. */
export type LookAhead = {
  type: 'look_ahead';
  negative: boolean;
  child: Node;
};

/** Type for look-behind assertion `/(?<=a)/`. */
export type LookBehind = {
  type: 'look_behind';
  negative: boolean;
  child: Node;
};

/** Type for character pattern `/a/`. */
export type Char = {
  type: 'char';
  value: number;
  raw: string;
};

/** Type for escape sequence class like `/\w/`. */
export type EscapeClass =
  | SimpleEscapeClass
  | UnicodePropertyEscapeClass
  | UnicodePropertyValueEscapeClass;

/** Type for simple escape sequence class like `/\d/`. */
export type SimpleEscapeClass = {
  type: 'escape_class';
  kind: 'digit' | 'word' | 'space';
  invert: boolean;
};

/** Type for unicode property escape sequence class like `\p{Zs}`. */
export type UnicodePropertyEscapeClass = {
  type: 'escape_class';
  kind: 'unicode_property';
  invert: boolean;
  property: string;
};

/** Type for unicode property value escape sequence class like `\p{Script=Hira}`. */
export type UnicodePropertyValueEscapeClass = {
  type: 'escape_class';
  kind: 'unicode_property_value';
  invert: boolean;
  property: string;
  value: string;
};

/** Type for character class pattern `/[a-z]/`. */
export type Class = {
  type: 'class';
  invert: boolean;
  items: ClassItem[];
};

/** Type for character range in class pattern. */
export type ClassRange = {
  type: 'class_range';
  begin: Char;
  end: Char;
};

/** Type for any character pattern `/./`. */
export type Dot = {
  type: 'dot';
};

/** Type for back reference pattern `/\1/`. */
export type BackRef = {
  type: 'back_ref';
  index: number;
};

/** Type for named back reference pattern `/\k<x>/`. */
export type NamedBackRef = {
  type: 'named_back_ref';
  name: string;
};

/** Show class item as string. */
const classItemToString = (n: ClassItem): string => {
  switch (n.type) {
    case 'char':
      return escape(n.value, true);
    case 'escape_class':
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
    case 'class_range':
      return `${escape(n.begin.value, true)}-${escape(n.end.value, true)}`;
  }
};

/** Show node as string. */
export const nodeToString = (n: Node): string => {
  switch (n.type) {
    case 'sequence':
      return n.children.map(nodeToString).join('');
    case 'select':
      return n.children.map(nodeToString).join('|');
    case 'capture':
      return `(${nodeToString(n.child)})`;
    case 'named_capture':
      return `(?<${n.name}>${nodeToString(n.child)})`;
    case 'group':
      return `(?:${nodeToString(n.child)})`;
    case 'many':
    case 'some':
    case 'optional':
    case 'repeat': {
      let s = nodeToString(n.child);
      switch (n.child.type) {
        case 'sequence':
        case 'select':
        case 'many':
        case 'some':
        case 'optional':
        case 'repeat':
        case 'word_boundary':
        case 'line_begin':
        case 'line_end':
        case 'look_ahead':
        case 'look_behind':
          s = `(?:${s})`;
          break;
      }
      switch (n.type) {
        case 'many':
          s += '*';
          break;
        case 'some':
          s += '+';
          break;
        case 'optional':
          s += '?';
          break;
        case 'repeat':
          s += `{${n.min}`;
          if (n.max === Infinity) {
            s += ',';
          } else if (n.max != n.min) {
            s += `,${n.max}`;
          }
          s += '}';
          break;
      }
      if (n.nonGreedy) {
        s += '?';
      }
      return s;
    }
    case 'word_boundary':
      return n.invert ? '\\B' : '\\b';
    case 'line_begin':
      return '^';
    case 'line_end':
      return '$';
    case 'look_ahead':
      return `(?${n.negative ? '!' : '='}${nodeToString(n.child)})`;
    case 'look_behind':
      return `(?<${n.negative ? '!' : '='}${nodeToString(n.child)})`;
    case 'char':
      return escape(n.value);
    case 'escape_class':
      return classItemToString(n);
    case 'class':
      return `[${n.invert ? '^' : ''}${n.items.map(classItemToString).join('')}]`;
    case 'dot':
      return '.';
    case 'back_ref':
      return `\\${n.index}`;
    case 'named_back_ref':
      return `\\k<${n.name}>`;
  }
};

/** Show pattern as string. */
export const patternToString = (p: Pattern): string => {
  let s = '/';
  s += nodeToString(p.child);
  s += '/';
  if (p.global) {
    s += 'g';
  }
  if (p.ignoreCase) {
    s += 'i';
  }
  if (p.multiline) {
    s += 'm';
  }
  if (p.unicode) {
    s += 'u';
  }
  if (p.dotAll) {
    s += 's';
  }
  if (p.sticky) {
    s += 'y';
  }
  return s;
};
