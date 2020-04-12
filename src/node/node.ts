import { Pattern, Node, ClassItem } from '../syntax/pattern';
import { Query } from './query';
import { RecurseContext, RecurseHandler } from './recurse';
import { RENodeTypeName, RENode } from './types';

type HasChild = (Pattern | Node | ClassItem) & { child: Node | ClassItem };
type HasChildren = (Pattern | Node | ClassItem) & { children: (Node | ClassItem)[] };

const cache: WeakMap<Pattern | Node | ClassItem, RecurseNode<Node | ClassItem>[]> = new WeakMap();

/**
 * `RecurseNode` is an internal implementation of `RENode`.
 *
 * It is used as pointer object, so this is called `path` sometimes.
 */
export class RecurseNode<T extends Pattern | Node | ClassItem> implements RENode<T> {
  /** Create `RecursePath` from `Pattern`. */
  public static createPattern(pattern: Pattern): RecurseNode<Pattern> {
    const path = new RecurseNode<Pattern>();
    path.object = pattern;
    path.rootPath = path;
    return path;
  }

  /** Create `RecursePath` from `child` attribute node. */
  public static createChild(parentPath: RecurseNode<HasChild>): RecurseNode<Node | ClassItem> {
    const parentObject = parentPath.object;
    const object = parentObject.child;
    return RecurseNode.create(object, parentPath, null, 'child', -1);
  }

  /** Create multiple `RecursePath` from `children` attribute nodes. */
  public static createChildren(
    parentPath: RecurseNode<HasChildren>
  ): RecurseNode<Node | ClassItem>[] {
    const parentObject = parentPath.object;
    const container = parentObject.children;
    const paths = [];
    for (let i = 0; i < container.length; i++) {
      const path = RecurseNode.create(container[i], parentPath, container, 'children', i);
      if (path) {
        paths.push(path);
      }
    }
    return paths;
  }

  /** Create `RecursePath` with the given parameter. */
  private static create(
    object: Node | ClassItem,
    parentPath: RecurseNode<Pattern | Node | ClassItem>,
    container: (Node | ClassItem)[] | null,
    key: string,
    index: number
  ): RecurseNode<Node | ClassItem> {
    const parentObject = parentPath.object;

    const paths = cache.get(parentObject) ?? [];
    cache.set(parentObject, paths);

    let path: RecurseNode<Node | ClassItem> | null = null;
    for (const cached of paths) {
      if (cached.object === object) {
        path = cached;
      }
    }

    if (!path) {
      path = new RecurseNode();
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

  public object!: T;
  private parentPath: RecurseNode<Pattern | Node | ClassItem> | null = null;
  private container: (Node | ClassItem)[] | null = null;
  private key = '';
  private index = -1;

  private rootPath!: RecurseNode<Pattern>;
  private contexts: RecurseContext[] = [];

  private removed = false;

  public node(): T {
    if (this.removed) {
      throw new Error('node is removed');
    }

    return this.object;
  }

  public attribute(...path: string[]): unknown {
    let value: any = this.node(); // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const attr of path) {
      value = value?.[attr];
    }
    return value;
  }

  public root(): RecurseNode<Pattern> {
    return this.rootPath;
  }

  public prevSibling(): RecurseNode<Node | ClassItem> | null {
    if (!this.parentPath || !this.container) {
      return null;
    }

    const index = this.index - 1;
    if (index < 0 || this.container.length <= index) {
      return null;
    }

    const object = this.container[index];
    return RecurseNode.create(object, this.parentPath, this.container, this.key, index);
  }

  public nextSibling(): RecurseNode<Node | ClassItem> | null {
    if (!this.parentPath || !this.container) {
      return null;
    }

    const index = this.index + (this.removed ? 0 : 1);
    if (index < 0 || this.container.length <= index) {
      return null;
    }

    const object = this.container[index];
    return RecurseNode.create(object, this.parentPath, this.container, this.key, index);
  }

  public firstChild(): RecurseNode<Node | ClassItem> | null {
    if (this.removed) {
      throw new Error('node is removed');
    }

    if (this.hasChild()) {
      return RecurseNode.createChild(this);
    }

    if (this.hasChildren()) {
      const paths = RecurseNode.createChildren(this);
      return paths[0] ?? null;
    }

    return null;
  }

  public lastChild(): RecurseNode<Node | ClassItem> | null {
    if (this.removed) {
      throw new Error('node is removed');
    }

    if (this.hasChild()) {
      return RecurseNode.createChild(this);
    }

    if (this.hasChildren()) {
      const paths = RecurseNode.createChildren(this);
      return paths[paths.length - 1] ?? null;
    }

    return null;
  }

  public children(): RecurseNode<Node | ClassItem>[] {
    if (this.removed) {
      throw new Error('node is removed');
    }

    if (this.hasChild()) {
      return [RecurseNode.createChild(this)];
    }

    if (this.hasChildren()) {
      return RecurseNode.createChildren(this);
    }

    return [];
  }

  public parent(): RecurseNode<Pattern | Node | ClassItem> | null {
    return this.parentPath;
  }

  public childIndex(): number | null {
    return this.index === -1 ? (this.parentPath ? 0 : null) : this.index;
  }

  public before(node: Node | ClassItem): RecurseNode<Node | ClassItem> {
    if (!(this.parentPath && this.container && !this.parentPath.is('ClassRange'))) {
      throw new Error('cannot insert to neither Disjunction, Sequence nor Class node');
    }

    return this.insert(node, this.index);
  }

  public after(node: Node | ClassItem): RecurseNode<Node | ClassItem> {
    if (!(this.parentPath && this.container && !this.parentPath.is('ClassRange'))) {
      throw new Error('cannot insert to neither Disjunction, Sequence nor Class node');
    }

    return this.insert(node, this.index + (this.removed ? 0 : 1));
  }

  private insert(node: Node | ClassItem, index: number): RecurseNode<Node | ClassItem> {
    if (!this.parentPath || !this.container) {
      throw new Error('BUG: no container');
    }

    this.container.splice(index, 0, node);
    this.parentPath.refreshChildrenIndex(index + 1, 1);
    const path = RecurseNode.create(node, this.parentPath, this.container, this.key, index);
    path.enqueue();
    return path;
  }

  public remove(): void {
    if (this.removed) {
      throw new Error('node is already removed');
    }

    if (!(this.parentPath && this.container && !this.parentPath.is('ClassRange'))) {
      throw new Error('cannot remove from neither Disjunction, Sequence nor Class node');
    }

    this.container.splice(this.index, 1);
    this.removed = true;
    this.parentPath.refreshChildrenIndex(this.index + 1, -1);
    this.skip();
  }

  public isRemoved(): boolean {
    return this.removed;
  }

  private refreshChildrenIndex(from: number, by: number): void {
    const children = cache.get(this.object) ?? [];
    for (const child of children) {
      if (child.index >= from) {
        child.index += by;
      }
    }
  }

  public replace(node: Node | ClassItem): RecurseNode<Node | ClassItem> {
    if (this.removed) {
      throw new Error('node is removed');
    }

    if (!this.parentPath) {
      throw new Error('cannot replace orphan node');
    }

    if (this.parentPath.hasChild()) {
      this.parentPath.object.child = node;
    } else if (this.container) {
      this.container[this.index] = node;
    }

    const path = this as RecurseNode<Node | ClassItem>;
    path.object = node;
    path.enqueue();
    return path;
  }

  private skip(): void {
    for (const context of this.contexts) {
      context.skip(this);
    }
  }

  private enqueue(): void {
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
    if (this.removed) {
      throw new Error('node is removed');
    }

    const context = new RecurseContext(this, handler);
    context.run();
  }

  public match(selector: string | Query): boolean {
    if (this.removed) {
      throw new Error('node is removed');
    }

    if (typeof selector === 'string') {
      selector = new Query(selector);
    }
    return selector.match(this, this.root());
  }

  public querySelector(selector: string | Query): RENode<Pattern | Node | ClassItem> | null {
    if (this.removed) {
      throw new Error('node is removed');
    }

    const s = typeof selector === 'string' ? new Query(selector) : selector;

    let result: RENode<Pattern | Node | ClassItem> | null = null;
    this.recurse({
      enter: (child, signal) => {
        if (s.match(child, this)) {
          result = child;
          signal.break();
        }
      },
    });

    return result;
  }

  public querySelectorAll(selector: string | Query): RENode<Pattern | Node | ClassItem>[] {
    if (this.removed) {
      throw new Error('node is removed');
    }

    const s = typeof selector === 'string' ? new Query(selector) : selector;

    const result: RENode<Pattern | Node | ClassItem>[] = [];
    this.recurse({
      enter: (child) => {
        if (s.match(child, this)) {
          result.push(child);
        }
      },
    });

    return result;
  }

  public is(type: RENodeTypeName): boolean {
    if (this.removed) {
      throw new Error('node is removed');
    }

    const t = this.object.type;
    if (type === 'Node') {
      return t !== 'Pattern' && t !== 'ClassRange';
    }
    if (type === 'ClassItem') {
      return t === 'Char' || t === 'EscapeClass' || t === 'ClassRange';
    }
    return t === type;
  }

  public assert(type: RENodeTypeName): void {
    if (this.is(type)) {
      return;
    }
    throw new Error(`unexpected node type: ${this.object.type}`);
  }

  private hasChild(): this is RecurseNode<HasChild> {
    return 'child' in this.object;
  }

  private hasChildren(): this is RecurseNode<HasChildren> {
    return 'children' in this.object;
  }
}
