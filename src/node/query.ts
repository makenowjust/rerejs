import { ClassItem, Pattern, Node } from '../syntax/pattern';
import { RecurseHandler } from './recurse';
import { Selector, SelectorParser } from './selector';
import { RENode, RENodeTypeName } from './types';

/**
 * A selector specificity like CSS selector.
 *
 * It is a pair of number of attribute selectors and type selectors.
 */
export class Specificity {
  /** Compare two specificities. */
  public static compare(s1: Specificity, s2: Specificity): number {
    return s1.attributes - s2.attributes || s1.types - s2.types;
  }

  /** Choice the greater specificity of the given specificities. */
  public static max(...ss: Specificity[]): Specificity {
    return ss.reduce((s1, s2) => (Specificity.compare(s1, s2) > 0 ? s1 : s2));
  }

  /** Calculate sum of two specificities. */
  public static sum(s1: Specificity, s2: Specificity): Specificity {
    return new Specificity(s1.attributes + s2.attributes, s1.types + s2.types);
  }

  /** Calculate specifity from selector. */
  public static calculate(s: Selector): Specificity {
    switch (s.type) {
      case 'child':
      case 'descendant':
      case 'sibling':
      case 'adjacent':
        return Specificity.sum(Specificity.calculate(s.left), Specificity.calculate(s.right));

      case 'compound':
        return s.selectors.map(Specificity.calculate).reduce(Specificity.sum);

      case 'is':
      case 'not':
        return Specificity.max(...s.selectors.map(Specificity.calculate));

      case 'has':
        return Specificity.max(...s.selectors.map((s) => Specificity.calculate(s.selector)));

      case 'type':
        return new Specificity(0, 1);

      case 'attribute':
      case 'nth-child':
      case 'nth-last-child':
      case 'class':
        return new Specificity(1, 0);
    }

    return new Specificity(0, 0);
  }

  constructor(public attributes: number, public types: number) {}
}

/**
 * `Query` is a wrapper of `Selector`.
 *
 * It can `match` against `NodePath`,
 * and it has some pre-calculated information of the selector.
 */
export class Query {
  /** Collect matchable types for selector. */
  private static collectTypes(s: Selector): Set<string> | null {
    switch (s.type) {
      case 'type':
        return new Set([s.value]);
      case 'class':
        switch (s.name) {
          case 'assertion':
            return new Set(['LookAhead', 'LookBehind', 'WordBoundary', 'LineBegin', 'LineEnd']);
          case 'back-ref':
            return new Set(['BackRef', 'NamedBackRef']);
          case 'capture':
            return new Set(['Capture', 'NamedCapture']);
          case 'char':
            return new Set(['Char', 'Dot', 'Class', 'EscapeClass']);
          case 'group':
            return new Set(['Group', 'Capture', 'NamedCapture']);
          case 'look-around':
            return new Set(['LookAhead', 'LookBehind']);
          case 'repeat':
            return new Set(['Many', 'Some', 'Optional', 'Repeat']);
        }

      case 'is': {
        const types: Set<string> = new Set();
        for (const child of s.selectors) {
          const childTypes = Query.collectTypes(child);
          if (!childTypes) {
            return null;
          }
          for (const type of childTypes) {
            types.add(type);
          }
        }
        return types;
      }

      case 'compound': {
        const allTypes: Set<string> = new Set();
        const childrenTypes: Set<string>[] = [];
        for (const child of s.selectors) {
          const childTypes = Query.collectTypes(child);
          if (childTypes) {
            childrenTypes.push(childTypes);
          }
          for (const type of childTypes ?? []) {
            allTypes.add(type);
          }
        }
        if (childrenTypes.length === 0) {
          return null;
        }
        const types: Set<string> = new Set();
        for (const type of allTypes) {
          if (childrenTypes.every((ts) => ts.has(type))) {
            types.add(type);
          }
        }
        return types;
      }

      case 'descendant':
      case 'child':
      case 'sibling':
      case 'adjacent':
        return Query.collectTypes(s.right);
    }

    return null;
  }

  /** An implementation of `Query#match`. */
  private static match(
    s: Selector,
    path: RENode<Pattern | Node | ClassItem>,
    scope: RENode<Pattern | Node | ClassItem>
  ): boolean {
    switch (s.type) {
      case 'universal':
        return true;

      case 'type':
        return path.is(s.value as RENodeTypeName);

      case 'is':
        for (const selector of s.selectors) {
          if (Query.match(selector, path, scope)) {
            return true;
          }
        }
        return false;

      case 'compound':
        for (const selector of s.selectors) {
          if (!Query.match(selector, path, scope)) {
            return false;
          }
        }
        return true;

      case 'not':
        for (const selector of s.selectors) {
          if (Query.match(selector, path, scope)) {
            return false;
          }
        }
        return true;

      case 'has': {
        let matched = false;
        const handler = (s: Selector): RecurseHandler => ({
          enter(child, signal): void {
            if (Query.match(s, child, path)) {
              matched = true;
              signal.break();
            }
          },
        });
        for (const rel of s.selectors) {
          switch (rel.op) {
            case 'descendant':
            case 'child':
              path.recurse(handler(rel.selector));
              break;
            case 'adjacent':
              path.nextSibling()?.recurse(handler(rel.selector));
              break;
            case 'sibling': {
              let sibling = path.nextSibling();
              while (sibling && !matched) {
                sibling.recurse(handler(rel.selector));
                sibling = sibling.nextSibling();
              }
              break;
            }
          }
          if (matched) {
            return true;
          }
        }
        return false;
      }

      case 'child':
        if (Query.match(s.right, path, scope)) {
          const parent = path.parent();
          if (parent) {
            return Query.match(s.left, parent, scope);
          }
        }
        return false;

      case 'descendant':
        if (Query.match(s.right, path, scope)) {
          let ancestor = path.parent();
          while (ancestor) {
            if (Query.match(s.left, ancestor, scope)) {
              return true;
            }
            ancestor = ancestor.parent();
          }
        }
        return false;

      case 'adjacent':
        if (Query.match(s.right, path, scope)) {
          const sibling = path.prevSibling();
          if (sibling) {
            return Query.match(s.left, sibling, scope);
          }
        }
        return false;

      case 'sibling':
        if (Query.match(s.right, path, scope)) {
          let sibling = path.prevSibling();
          while (sibling) {
            if (Query.match(s.left, sibling, scope)) {
              return true;
            }
            sibling = sibling.prevSibling();
          }
        }
        return false;

      case 'attribute': {
        let value: any = path.attribute(...s.path); // eslint-disable-line @typescript-eslint/no-explicit-any
        // Fix value if expected type is `string`.
        if (s.operator !== 'exist' && typeof value === 'number') {
          if (
            s.value.type === 'regexp' ||
            (s.value.type === 'literal' && typeof s.value?.value === 'string')
          ) {
            value = String.fromCodePoint(value);
          }
        }

        switch (s.operator) {
          case 'exist':
            return value != null && value !== false;
          case '=':
          case '!=': {
            const expected = s.operator === '=';
            switch (s.value.type) {
              case 'type':
                return (typeof value === s.value.value) === expected;
              case 'literal':
                return (value === s.value.value) === expected;
              case 'regexp':
                return (typeof value === 'string' && s.value.value.test(value)) === expected;
            }
          }

          /* eslint-disable @typescript-eslint/no-non-null-assertion */
          case '<':
            return value < s.value.value!;
          case '>':
            return value > s.value.value!;
          case '<=':
            return value <= s.value.value!;
          case '>=':
            return value >= s.value.value!;
          /* eslint-enable @typescript-eslint/no-non-null-assertion */
        }
      }

      case 'nth-child': {
        const index = path.childIndex();
        if (index === null) {
          return false;
        }
        switch (s.index.type) {
          case 'literal':
            return index + 1 === s.index.value;
          case 'step': {
            const n = (index + 1 - s.index.initial) / s.index.by;
            return n >= 0 && Number.isInteger(n);
          }
        }
      }

      case 'nth-last-child': {
        const children = path.parent()?.children();
        const index = path.childIndex();
        if (index === null || !children) {
          return false;
        }
        const lastIndex = children.length - index;
        switch (s.index.type) {
          case 'literal':
            return lastIndex === s.index.value;
          case 'step': {
            const n = (lastIndex - s.index.initial) / s.index.by;
            return n >= 0 && Number.isInteger(n);
          }
        }
      }

      case 'scope':
        return path === scope;

      case 'class':
        switch (s.name) {
          case 'assertion':
            return (
              path.is('LookAhead') ||
              path.is('LookBehind') ||
              path.is('WordBoundary') ||
              path.is('LineBegin') ||
              path.is('LineEnd')
            );
          case 'back-ref':
            return path.is('BackRef') || path.is('NamedBackRef');
          case 'capture':
            return path.is('Capture') || path.is('NamedCapture');
          case 'char': {
            if (path.parent()?.is('Class') || path.parent()?.is('ClassRange')) {
              return false;
            }
            return path.is('Char') || path.is('Dot') || path.is('Class') || path.is('EscapeClass');
          }
          case 'group':
            return path.is('Group') || path.is('Capture') || path.is('NamedCapture');
          case 'look-around':
            return path.is('LookAhead') || path.is('LookBehind');
          case 'repeat':
            return path.is('Many') || path.is('Some') || path.is('Optional') || path.is('Repeat');
        }
    }
  }

  public selector: Selector;
  public source: string;
  public types: Set<string> | null;
  public specificity: Specificity;

  constructor(source: string) {
    this.source = source;

    const parser = new SelectorParser(source);
    this.selector = parser.parse();
    this.types = Query.collectTypes(this.selector);
    this.specificity = Specificity.calculate(this.selector);
  }

  /**
   * Try to match this selector against the given node.
   */
  public match(
    path: RENode<Pattern | Node | ClassItem>,
    scope: RENode<Pattern | Node | ClassItem> = path
  ): boolean {
    return Query.match(this.selector, path, scope);
  }
}

/**
 * Type for items of `QuerySet` queries.
 *
 * `position` is needed for keep the given order when specificities are same.
 */
type QuerySetItem = {
  query: Query;
  position: number;
};

/**
 * `QuerySet` is ordered set of queries.
 *
 * It can try to match all selectors ordering by specifcity.
 */
export class QuerySet {
  /** Compare two `QuerySetItem`. */
  private static compare = (q1: QuerySetItem, q2: QuerySetItem): number =>
    Specificity.compare(q1.query.specificity, q2.query.specificity) || q1.position - q2.position;

  private universalQueries: QuerySetItem[];
  private typeQueriesMap: Map<string, QuerySetItem[]>;

  public constructor(queries: Query[]) {
    const universalQueries: QuerySetItem[] = [];
    const typeQueriesMap: Map<string, QuerySetItem[]> = new Map();

    for (const [position, query] of queries.entries()) {
      if (!query.types) {
        universalQueries.push({ position, query });
        continue;
      }

      for (const type of query.types) {
        let queries = typeQueriesMap.get(type);
        if (!queries) {
          queries = [];
          typeQueriesMap.set(type, queries);
        }
        queries.push({ position, query });
      }
    }

    universalQueries.sort(QuerySet.compare);
    for (const queries of typeQueriesMap.values()) {
      queries.sort(QuerySet.compare);
    }

    this.universalQueries = universalQueries;
    this.typeQueriesMap = typeQueriesMap;
  }

  /** Return a generator of matched queries. */
  public *match(
    path: RENode<Pattern | Node | ClassItem>,
    scope: RENode<Pattern | Node | ClassItem> = path
  ): Generator<Query> {
    const typeQueries = this.typeQueriesMap.get(path.node().type) ?? [];
    const universalQueries = this.universalQueries;

    let i = typeQueries.length - 1;
    let j = universalQueries.length - 1;
    while (i >= 0 || j >= 0) {
      const q =
        i < 0 || (j >= 0 && QuerySet.compare(typeQueries[i], universalQueries[j]) < 0)
          ? universalQueries[j--]
          : typeQueries[i--];
      if (q.query.match(path, scope)) {
        yield q.query;
      }
    }
  }
}
