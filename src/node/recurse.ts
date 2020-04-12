import { Pattern, Node, ClassItem } from '../syntax/pattern';
import { RecurseNode } from './node';
import { RENode } from './types';

export type RecurseSignal = {
  skip(node?: RENode<Pattern | Node | ClassItem>): void;
  break(): void;
};

export type RecurseHandler = {
  enter?: (node: RENode<Pattern | Node | ClassItem>, signal: RecurseSignal) => void;
  leave?: (node: RENode<Pattern | Node | ClassItem>, signal: RecurseSignal) => void;
};

type RecurseAction = {
  type: 'enter' | 'leave';
  path: RecurseNode<Pattern | Node | ClassItem>;
};

export class RecurseContext {
  private stack: RecurseAction[] = [];

  private skipped: WeakSet<Pattern | Node | ClassItem> = new WeakSet();
  private visited: WeakSet<Pattern | Node | ClassItem> = new WeakSet();

  private root: RecurseNode<Pattern | Node | ClassItem>;
  private handler: RecurseHandler;

  private breaked = false;

  constructor(root: RecurseNode<Pattern | Node | ClassItem>, handler: RecurseHandler) {
    this.root = root;
    this.handler = handler;
  }

  public skip(path: RecurseNode<Pattern | Node | ClassItem>): void {
    this.skipped.add(path.object);
  }

  public break(): void {
    this.breaked = true;
  }

  public enqueue(path: RecurseNode<Pattern | Node | ClassItem>): void {
    let ok = false;
    let ancestor: RecurseNode<Pattern | Node | ClassItem> | null = path;
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

    try {
      this.stack.push({ type: 'enter', path: this.root });

      while (this.stack.length > 0 && !this.breaked) {
        this.step();
      }
    } finally {
      this.root.popContext();
    }
  }

  private step(): void {
    const action = this.stack.pop();
    if (!action) {
      return;
    }

    const signal = {
      skip: (node = action.path): void => {
        this.skip(node);
      },
      break: (): void => {
        this.break();
      },
    };

    if (action.type === 'leave') {
      this.handler.leave?.(action.path, signal);
      return;
    }

    const path = action.path;
    const node = path.object;
    if (this.visited.has(node) || this.skipped.has(node)) {
      return;
    }
    this.visited.add(node);

    this.handler.enter?.(path, signal);
    if (this.skipped.has(node) || this.breaked) {
      return;
    }

    this.stack.push({ type: 'leave', path });
    const children = path.children();
    for (let i = children.length - 1; i >= 0; i--) {
      this.stack.push({ type: 'enter', path: children[i] });
    }
  }
}
