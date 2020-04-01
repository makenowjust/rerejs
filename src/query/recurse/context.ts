import { Pattern, Node, ClassItem } from '../../syntax/pattern';
import { NodePath, RecursePath } from './path';

export type RecurseHandler = {
  enter?: (path: NodePath<Pattern | Node | ClassItem>) => void;
  leave?: (path: NodePath<Pattern | Node | ClassItem>) => void;
};

type RecurseAction = {
  type: 'enter' | 'leave';
  path: RecursePath<Pattern | Node | ClassItem>;
};

export class RecurseContext {
  private stack: RecurseAction[] = [];

  private skipped: WeakSet<RecursePath<Pattern | Node | ClassItem>> = new WeakSet();
  private visited: WeakSet<RecursePath<Pattern | Node | ClassItem>> = new WeakSet();

  private root: RecursePath<Pattern | Node | ClassItem>;
  private handler: RecurseHandler;

  private breaked = false;

  constructor(root: RecursePath<Pattern | Node | ClassItem>, handler: RecurseHandler) {
    this.root = root;
    this.handler = handler;
  }

  public skip(path: RecursePath<Pattern | Node | ClassItem>): void {
    this.skipped.add(path);
  }

  public break(): void {
    this.breaked = true;
  }

  public enqueue(path: RecursePath<Pattern | Node | ClassItem>): void {
    let ok = false;
    let ancestor: RecursePath<Pattern | Node | ClassItem> | null = path;
    while (!ok && ancestor) {
      ok = ancestor === this.root;
      ancestor = ancestor.parent();
    }

    if (!ok) {
      return;
    }

    this.stack.push({ type: 'enter', path });
  }

  public run(): void {
    this.root.pushContext(this);
    this.stack.push({ type: 'enter', path: this.root });

    while (this.stack.length > 0 && !this.breaked) {
      this.step();
    }
    this.root.popContext();
  }

  private step(): void {
    const action = this.stack.pop();
    if (!action) {
      return;
    }

    if (action.type === 'leave') {
      this.handler.leave?.(action.path);
      return;
    }

    const path = action.path;
    if (this.visited.has(path) || this.skipped.has(path)) {
      return;
    }
    this.visited.add(path);

    this.handler.enter?.(path);
    if (this.skipped.has(path) || this.breaked) {
      return;
    }

    this.stack.push({ type: 'leave', path });
    const children = path.children();
    for (let i = children.length - 1; i >= 0; i--) {
      this.stack.push({ type: 'enter', path: children[i] });
    }
  }
}
