import { Element } from '../syntax/pattern';

/** An unique symbol for skip `recurse` function. */
export const SKIP = Symbol('SKIP');
/** Type for SKIP symbol. */
export type SKIP = typeof SKIP;
/** An unique symbol for break `recurse` function. */
export const BREAK = Symbol('BREAK');
/** Type for BREAK symbol. */
export type BREAK = typeof BREAK;

/** Type for a context of `recurse` function. */
export type RecurseContext = {
  ancestry: Element[];
  path: (string | number)[];
};

/** Type for `recurse` function handler. */
export type RecurseHandler = {
  enter?(element: Element, context: RecurseContext): SKIP | BREAK | void;
  leave?(element: Element, context: RecurseContext): BREAK | void;
};

/** Recurse `handler` for each elements under the given element. */
export const recurse = (e: Element, handler: RecurseHandler, context?: RecurseContext): void => {
  if (!context) {
    context = {
      ancestry: [],
      path: [],
    };
  }

  type Item = {
    action: 'enter' | 'leave';
    element: Element;
    context: RecurseContext;
  };
  const stack: Item[] = [];

  stack.push({ action: 'enter', element: e, context });

  while (stack.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { action, element, context } = stack.pop()!;

    if (action === 'leave') {
      if (handler.leave?.(element, context) === BREAK) {
        return;
      }
      continue;
    }

    stack.push({ action: 'leave', element, context });

    switch (handler.enter?.(element, context)) {
      case BREAK:
        return;
      case SKIP:
        continue;
    }

    if ('child' in element) {
      stack.push({
        action: 'enter',
        element: element.child,
        context: {
          ancestry: context.ancestry.concat([element]),
          path: context.path.concat(['child']),
        },
      });
    }

    if ('children' in element) {
      const children = element.children;
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({
          action: 'enter',
          element: children[i],
          context: {
            ancestry: context.ancestry.concat([element]),
            path: context.path.concat(['children', i]),
          },
        });
      }
    }
  }
};
