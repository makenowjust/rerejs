// # ast.ts
//
// > Type definitions of regular expresion AST nodes.

export type Root = {
  type: 'root';
  global: boolean;
  ignoreCase: boolean;
  multiline: boolean;
  unicode: boolean;
  sticky: boolean;
  dotAll: boolean;
  paren: number;
  names: Map<string, number>;
  child: Node;
};

export type Node =
  | Sequence
  | Select
  | Repeat
  | Many
  | Some
  | Optional
  | Capture
  | Char
  | Escape
  | EscapeClass
  | Class
  | AnyChar
  | BackRef
  | Assert
  | LookAhead
  | LookBehind;

export type ClassItem = Char | Escape | EscapeClass | ClassRange;

export type Sequence = {
  type: 'sequence';
  children: Node[];
};

export type Select = {
  type: 'select';
  children: [Node, ...Node[]];
};

export type Repeat = {
  type: 'repeat';
  min: number;
  max: number;
  greedy: boolean;
  child: Node;
};

export type Many = {
  type: 'many';
  greedy: boolean;
  child: Node;
};

export type Some = {
  type: 'some';
  greedy: boolean;
  child: Node;
};

export type Optional = {
  type: 'optional';
  greedy: boolean;
  child: Node;
};

export type Capture = {
  type: 'capture';
  index: number;
  name: string | null;
  child: Node;
};

export type Char = {
  type: 'char';
  value: string;
};

export type Escape = {
  type: 'escape';
  value: string;
};

export type EscapeClass =
  | {
      type: 'escape-class';
      kind: 'digit' | 'not-digit' | 'space' | 'not-space' | 'word' | 'not-word';
    }
  | {
      type: 'escape-class';
      kind: 'unicode-property' | 'not-unicode-property';
      property: string;
    }
  | {
      type: 'escape-class';
      kind: 'unicode-property-value' | 'not-unicode-property-value';
      property: string;
      value: string;
    };

export type Class = {
  type: 'class';
  items: ClassItem[];
  invert: boolean;
};

export type ClassRange = {
  type: 'class-range';
  begin: Char | Escape;
  end: Char | Escape;
};

export type AnyChar = {
  type: 'any-char';
};

export type BackRef = {
  type: 'back-ref';
  key: number | string;
};

export type Assert = {
  type: 'assert';
  kind: AssertKind;
};

export type AssertKind = 'word-boundary' | 'not-word-boundary' | 'begin' | 'end';

export type LookAhead = {
  type: 'look-ahead';
  invert: boolean;
  child: Node;
};

export type LookBehind = {
  type: 'look-behind';
  invert: boolean;
  child: Node;
};
