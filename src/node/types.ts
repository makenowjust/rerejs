import { Parser } from '../syntax/parser';
import {
  Pattern,
  Node,
  ClassItem,
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
  ClassRange,
} from '../syntax/pattern';
import { RecurseNode } from './node';
import { Query } from './query';
import { RecurseHandler } from './recurse';

export type RENodeTypeMap = {
  Pattern: Pattern;

  Node: Node;
  Disjunction: Disjunction;
  Sequence: Sequence;
  Capture: Capture;
  NamedCapture: NamedCapture;
  Group: Group;
  Many: Many;
  Some: Some;
  Optional: Optional;
  Repeat: Repeat;
  WordBoundary: WordBoundary;
  LineBegin: LineBegin;
  LineEnd: LineEnd;
  LookAhead: LookAhead;
  LookBehind: LookBehind;
  Char: Char;
  EscapeClass: EscapeClass;
  Class: Class;
  Dot: Dot;
  BackRef: BackRef;
  NamedBackRef: NamedBackRef;

  ClassItem: ClassItem;
  ClassRange: ClassRange;
};

export type RENodeTypeName = keyof RENodeTypeMap;

export interface RENodeConstructor {
  new (pattern: Pattern): RENode<Pattern>;
  load(source: string, flags?: string): RENode<Pattern>;
}

export interface RENode<T extends Pattern | Node | ClassItem> {
  /**
   * Get the AST object of this node.
   *
   * It raises an error if this node is removed.
   */
  node(): T;

  /**
   * Get the AST object property.
   *
   * It raises an error if this node is removed.
   */
  attribute<K extends keyof T>(key: K): T[K];

  /**
   * Get the AST object property recursively.
   *
   * It raises an error if this node is removed.
   */
  attribute(...path: string[]): unknown;

  /**
   * Get the root `Pattern` node.
   */
  root(): RENode<Pattern>;

  /**
   * Get the previous sibling node.
   */
  prevSibling(): RENode<Node | ClassItem> | null;

  /**
   * Get the next sibling node.
   */
  nextSibling(): RENode<Node | ClassItem> | null;

  /**
   * Get the first child node.
   *
   * When this node has no child, it returns `null` instead.
   *
   * It raises an error if this node is removed.
   */
  firstChild(): RENode<Node | ClassItem> | null;

  /**
   * Get the last child node.
   *
   * When this node has no child, it returns `null` instead.
   *
   * It raises an error if this node is removed.
   */
  lastChild(): RENode<Node | ClassItem> | null;

  /**
   * Get an array of children nodes.
   *
   * It raises an error if this node is removed.
   */
  children(): RENode<Node | ClassItem>[];

  /**
   * Get the parent node.
   *
   * When the parent node is missing, it returns `null` instead.
   */
  parent(): RENode<Pattern | Node | ClassItem> | null;

  /**
   * Get the index of children of parent node.
   *
   * When the parent node is missing, it returns `null` instead.
   */
  childIndex(): number | null;

  /**
   * Insert a new node before this.
   *
   * The result value is inserted node.
   */
  before(node: Node | ClassItem): RENode<Node | ClassItem>;

  /**
   * Insert a new node after this.
   *
   * The result value is inserted node.
   */
  after(node: Node | ClassItem): RENode<Node | ClassItem>;

  /**
   * Remove this node from parent.
   *
   * Note that removed node behaves like a *pointer* in node tree.
   * So, almost all operation is allowed to removed node, however
   * touching the AST node object is not avilable.
   */
  remove(): void;

  /**
   * A flag which is whether this node is removed or not.
   */
  isRemoved(): boolean;

  /**
   * Replace this node with the given node.
   *
   * It mutates this node itself, and returns `this`.
   *
   * It raises an error if this node is removed.
   */
  replace(node: Node | ClassItem): RENode<Node | ClassItem>;

  /**
   * Recurse handler against this node and its children.
   *
   * It raises an error if this node is removed.
   */
  recurse(handler: RecurseHandler): void;

  /**
   * Try to match selector aginst this node.
   *
   * It raises an error if this node is removed.
   */
  match(selector: string | Query): boolean;

  /**
   * Find the first node that matches the given selector from this node.
   *
   * When there is no such node, it returns `null`.
   */
  querySelector(selector: string | Query): RENode<Pattern | Node | ClassItem> | null;

  /**
   * Collect all nodes that matches the given selector from this node.
   */
  querySelectorAll(selector: string | Query): RENode<Pattern | Node | ClassItem>[];

  /**
   * Check this node is the given type.
   *
   * It raises an error if this node is removed.
   */
  is<K extends RENodeTypeName>(type: K): this is RENode<RENodeTypeMap[K]>;

  /**
   * Assert this node is the given type.
   *
   * It raises another error if this node is removed.
   */
  assert<K extends RENodeTypeName>(type: K): asserts this is RENode<RENodeTypeMap[K]>;
}

export const RENode: RENodeConstructor = ((): RENodeConstructor => {
  const RENode: RENodeConstructor = function (pattern: Pattern) {
    return RecurseNode.createPattern(pattern);
  } as never;

  RENode.load = (source: string, flags?: string): RENode<Pattern> => {
    const parser = new Parser(source, flags);
    const pattern = parser.parse();
    return new RENode(pattern);
  };

  return RENode;
})();
