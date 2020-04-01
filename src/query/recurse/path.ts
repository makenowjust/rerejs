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
} from '../../syntax/pattern';
import { Query } from '../query';
import { RecurseContext, RecurseHandler } from './context';

export type NodeTypeMap = {
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

export type NodeTypeName = keyof NodeTypeMap;

export interface NodePath<T extends Pattern | Node | ClassItem = Node | ClassItem> {
  readonly node: T;
  readonly removed: boolean;
  readonly childIndex: number | null;

  /** Get the root `Pattern` node. */
  root(): NodePath<Pattern>;

  /** Get the previous sibling node. */
  prevSibling(): NodePath | null;

  /** Get the next sibling node. */
  nextSibling(): NodePath | null;

  /** Get the first child node. */
  firstChild(): NodePath | null;

  /** Get the last child node. */
  lastChild(): NodePath | null;

  /** Get an array of children nodes. */
  children(): NodePath[];

  /** Get the parent node. */
  parent(): NodePath<Pattern | Node | ClassItem> | null;

  /** Insert a new node before this. */
  before(node: Node | ClassItem): NodePath<Node | ClassItem>;

  /** Insert a new node after this. */
  after(node: Node | ClassItem): NodePath<Node | ClassItem>;

  /** Remove this node from parent. */
  remove(): void;

  /** Replace this node with the given node. */
  replace(node: Node | ClassItem): NodePath<Node | ClassItem>;

  /** Notify skipping this node children traversing to traverse context. */
  skip(): void;

  /** Notify breaking to travese context. */
  break(): void;

  /** Recurse handler against this node and its children. */
  recurse(handler: RecurseHandler): void;

  /** Try to match selector aginst this node. */
  match(selector: string | Query): boolean;

  /** Check this node is the given type. */
  is<K extends NodeTypeName>(type: K): this is NodePath<NodeTypeMap[K]>;

  /** Assert this node is the given type. */
  assert<K extends NodeTypeName>(type: K): asserts this is NodePath<NodeTypeMap[K]>;
}

type HasChild = (Pattern | Node | ClassItem) & { child: Node | ClassItem };
type HasChildren = (Pattern | Node | ClassItem) & { children: (Node | ClassItem)[] };

const cache: WeakMap<Pattern | Node | ClassItem, RecursePath<Node | ClassItem>[]> = new WeakMap();

/** `RecursePath` is an internal implementation of `NodePath`. */
export class RecursePath<T extends Pattern | Node | ClassItem> implements NodePath<T> {
  /** Create `RecursePath` from `Pattern`. */
  public static createPattern(pattern: Pattern): RecursePath<Pattern> {
    const path = new RecursePath<Pattern>();
    path.object = pattern;
    path.rootPath = path;
    return path;
  }

  /** Create `RecursePath` from `child` attribute node. */
  public static createChild(parentPath: RecursePath<HasChild>): RecursePath<Node | ClassItem> {
    const parentObject = parentPath.object;
    const object = parentObject.child;
    return RecursePath.create(object, parentPath, null, 'child', -1);
  }

  /** Create `RecursePath`-es from `children` attribute nodes. */
  public static createChildren(
    parentPath: RecursePath<HasChildren>
  ): RecursePath<Node | ClassItem>[] {
    const parentObject = parentPath.object;
    const container = parentObject.children;
    const paths = [];
    for (let i = 0; i < container.length; i++) {
      const path = RecursePath.create(container[i], parentPath, container, 'children', i);
      if (path) {
        paths.push(path);
      }
    }
    return paths;
  }

  /** Create `RecursePath` with the given parameter. */
  private static create(
    object: Node | ClassItem,
    parentPath: RecursePath<Pattern | Node | ClassItem>,
    container: (Node | ClassItem)[] | null,
    key: string,
    index: number
  ): RecursePath<Node | ClassItem> {
    const parentObject = parentPath.object;

    const paths = cache.get(parentObject) ?? [];
    cache.set(parentObject, paths);

    let path: RecursePath<Node | ClassItem> | null = null;
    for (const cached of paths) {
      if (cached.object === object) {
        path = cached;
      }
    }

    if (!path) {
      path = new RecursePath();
      paths.push(path);
    }

    path.parentPath = parentPath;
    path.object = object;
    path.container = container;
    path.key = key;
    path.index = index;

    path.rootPath = parentPath.rootPath;
    path.contexts = parentPath.contexts;

    return path;
  }

  private object!: T;
  private parentPath: RecursePath<Pattern | Node | ClassItem> | null = null;
  private container: (Node | ClassItem)[] | null = null;
  private key = '';
  private index = -1;

  private rootPath!: RecursePath<Pattern>;
  private contexts: RecurseContext[] = [];

  public removed = false;

  public get node(): T {
    return this.object;
  }

  public get childIndex(): number | null {
    return this.index === -1 ? (this.parentPath ? 0 : null) : this.index;
  }

  public root(): RecursePath<Pattern> {
    return this.rootPath;
  }

  public prevSibling(): RecursePath<Node | ClassItem> | null {
    if (!this.parentPath || !this.container) {
      return null;
    }

    const index = this.index - 1;
    if (index < 0 || this.container.length <= index) {
      return null;
    }

    const object = this.container[index];
    return RecursePath.create(object, this.parentPath, this.container, this.key, index);
  }

  public nextSibling(): RecursePath<Node | ClassItem> | null {
    if (!this.parentPath || !this.container) {
      return null;
    }

    const index = this.index + 1;
    if (index < 0 || this.container.length <= index) {
      return null;
    }

    const object = this.container[index];
    return RecursePath.create(object, this.parentPath, this.container, this.key, index);
  }

  public firstChild(): RecursePath<Node | ClassItem> | null {
    if (this.hasChild()) {
      return RecursePath.createChild(this);
    }

    if (this.hasChildren()) {
      const paths = RecursePath.createChildren(this);
      return paths[0] ?? null;
    }

    return null;
  }

  public lastChild(): RecursePath<Node | ClassItem> | null {
    if (this.hasChild()) {
      return RecursePath.createChild(this);
    }

    if (this.hasChildren()) {
      const paths = RecursePath.createChildren(this);
      return paths[paths.length - 1] ?? null;
    }

    return null;
  }

  public children(): RecursePath<Node | ClassItem>[] {
    if (this.hasChild()) {
      return [RecursePath.createChild(this)];
    }

    if (this.hasChildren()) {
      return RecursePath.createChildren(this);
    }

    return [];
  }

  public parent(): RecursePath<Pattern | Node | ClassItem> | null {
    return this.parentPath;
  }

  public before(node: Node | ClassItem): RecursePath<Node | ClassItem> {
    if (!(this.parentPath && this.container && !this.is('ClassRange'))) {
      throw new Error('cannot insert to neither Disjunction, Sequence nor Class node');
    }

    return this.insert(node, this.index);
  }

  public after(node: Node | ClassItem): RecursePath<Node | ClassItem> {
    if (!(this.parentPath && this.container && !this.parentPath.is('ClassRange'))) {
      throw new Error('cannot insert to neither Disjunction, Sequence nor Class node');
    }

    return this.insert(node, this.index + 1);
  }

  private insert(node: Node | ClassItem, index: number): RecursePath<Node | ClassItem> {
    if (!this.parentPath || !this.container) {
      throw new Error('BUG: no container');
    }

    this.container.splice(index, 0, node);
    const path = this.parentPath.children()[index];
    path.enqueue();
    return path;
  }

  public remove(): void {
    if (!(this.parentPath && this.container && !this.parentPath.is('ClassRange'))) {
      throw new Error('cannot remove from neither Disjunction, Sequence nor Class node');
    }

    this.container.splice(this.index, 1);
    this.removed = true;
    this.parentPath.children();
    this.skip(true);
  }

  public replace(node: Node | ClassItem): RecursePath<Node | ClassItem> {
    if (!this.parentPath) {
      throw new Error('cannot replace orphan node');
    }

    if (this.parentPath.hasChild()) {
      this.parentPath.object.child = node;
    } else if (this.container) {
      this.container[this.index] = node;
    }

    const path = this as RecursePath<Node | ClassItem>;
    path.object = node;
    path.enqueue();
    return path;
  }

  public skip(hoist = false): void {
    let loop = true;
    for (let i = this.contexts.length - 1; i >= 0 && loop; i--) {
      const context = this.contexts[i];
      context.skip(this);
      loop = hoist;
    }
  }

  public break(): void {
    const contexts = this.contexts;
    if (contexts.length > 0) {
      contexts[contexts.length - 1].break();
    }
  }

  public enqueue(): void {
    for (let i = this.contexts.length - 1; i >= 0; i--) {
      const context = this.contexts[i];
      context.enqueue(this);
    }
  }

  public pushContext(context: RecurseContext): void {
    const contexts = this.contexts;
    if (contexts.length === 0 || contexts[contexts.length - 1] !== context) {
      contexts.push(context);
    }
  }

  public popContext(): void {
    this.contexts.pop();
  }

  public recurse(handler: RecurseHandler): void {
    const context = new RecurseContext(this, handler);
    context.run();
  }

  public match(selector: string | Query): boolean {
    if (typeof selector === 'string') {
      selector = new Query(selector);
    }
    return selector.match(this, this.root());
  }

  public is(type: NodeTypeName): boolean {
    const t = this.object.type;
    if (type === 'Node') {
      return t !== 'Pattern' && t !== 'ClassRange';
    }
    if (type === 'ClassItem') {
      return t === 'Char' || t === 'EscapeClass' || t === 'ClassRange';
    }
    return t === type;
  }

  public assert(type: NodeTypeName): void {
    if (this.is(type)) {
      return;
    }
    throw new Error(`unexpected node type: ${this.object.type}`);
  }

  private hasChild(): this is RecursePath<HasChild> {
    return 'child' in this.object;
  }

  private hasChildren(): this is RecursePath<HasChildren> {
    return 'children' in this.object;
  }
}

interface NodePathConstructor {
  new (pattern: Pattern): NodePath<Pattern>;
}

export const NodePath: NodePathConstructor = function (pattern: Pattern) {
  return RecursePath.createPattern(pattern);
} as never;
