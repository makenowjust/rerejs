import { Element } from '../syntax/pattern';
import { recurse, RecurseContext, BREAK, SKIP } from './recurse';
import { Selector, SelectorParser } from './selector';

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
      case 'has':
        return Specificity.max(...s.selectors.map(Specificity.calculate));

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
 * It can `match` against `Element`,
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
  private static match(s: Selector, e: Element, context: RecurseContext, scope: Element): boolean {
    switch (s.type) {
      case 'universal':
        return true;

      case 'type':
        return e.type === s.value;

      case 'is':
        for (const selector of s.selectors) {
          if (Query.match(selector, e, context, scope)) {
            return true;
          }
        }
        return false;

      case 'compound':
        for (const selector of s.selectors) {
          if (!Query.match(selector, e, context, scope)) {
            return false;
          }
        }
        return true;

      case 'not':
        for (const selector of s.selectors) {
          if (Query.match(selector, e, context, scope)) {
            return false;
          }
        }
        return true;

      case 'has': {
        for (const selector of s.selectors) {
          // To match sibling and adjacent selector correctly, try to match from the parent.
          // It is too inefficient -_-
          const parent = context.ancestry[context.ancestry.length - 1] ?? e;
          let matched = false;
          let skip = true;
          recurse(
            parent,
            {
              enter(child, context) {
                // Skip elements to reach the current element.
                if (skip) {
                  skip = child !== e;
                  return skip && child !== parent ? SKIP : undefined;
                }
                if (Query.match(selector, child, context, e)) {
                  matched = true;
                  return BREAK;
                }
              },
            },
            Query.upwardContext(context)
          );
          if (matched) {
            return true;
          }
        }
        return false;
      }

      case 'child':
        if (Query.match(s.right, e, context, scope)) {
          const parent = context.ancestry[context.ancestry.length - 1];
          if (!parent) {
            return false;
          }
          return Query.match(s.left, parent, Query.upwardContext(context), scope);
        }
        return false;

      case 'descendant':
        if (Query.match(s.right, e, context, scope)) {
          while (context.ancestry.length > 0) {
            const parent = context.ancestry[context.ancestry.length - 1];
            context = Query.upwardContext(context);
            if (Query.match(s.left, parent, context, scope)) {
              return true;
            }
          }
        }
        return false;

      case 'adjacent':
        if (Query.match(s.right, e, context, scope)) {
          const parent = context.ancestry[context.ancestry.length - 1];
          const index = context.path[context.path.length - 1];
          const attr = context.path[context.path.length - 2];
          if (parent && typeof index === 'number' && attr === 'children' && 'children' in parent) {
            const child = parent[attr][index - 1];
            const path = context.path.slice(0, -1).concat([index - 1]);
            if (child) {
              return Query.match(s.left, child, { ...context, path }, scope);
            }
          }
        }
        return false;

      case 'sibling':
        if (Query.match(s.right, e, context, scope)) {
          const parent = context.ancestry[context.ancestry.length - 1];
          const index = context.path[context.path.length - 1];
          const attr = context.path[context.path.length - 2];
          if (parent && typeof index === 'number' && attr === 'children' && 'children' in parent) {
            for (let i = index - 1; i >= 0; i--) {
              const child = parent[attr][i];
              const path = context.path.slice(0, -1).concat([i]);
              if (Query.match(s.left, child, { ...context, path }, scope)) {
                return true;
              }
            }
          }
        }
        return false;

      case 'attribute': {
        let value: any = e; // eslint-disable-line @typescript-eslint/no-explicit-any
        for (const attr of s.path) {
          value = value?.[attr];
        }
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
        const index = context.path[context.path.length - 1];
        if (typeof index !== 'number') {
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
        const parent = context.ancestry[context.ancestry.length - 1];
        const index = context.path[context.path.length - 1];
        const attr = context.path[context.path.length - 2];
        if (
          !parent ||
          typeof index !== 'number' ||
          attr !== 'children' ||
          !('children' in parent)
        ) {
          return false;
        }
        const lastIndex = parent.children.length - index;
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
        return e === scope;

      case 'class':
        switch (s.name) {
          case 'assertion':
            return (
              e.type === 'LookAhead' ||
              e.type === 'LookBehind' ||
              e.type === 'WordBoundary' ||
              e.type === 'LineBegin' ||
              e.type === 'LineEnd'
            );
          case 'back-ref':
            return e.type === 'BackRef' || e.type === 'NamedBackRef';
          case 'capture':
            return e.type === 'Capture' || e.type === 'NamedCapture';
          case 'char': {
            if (context.ancestry[context.ancestry.length - 1]?.type === 'Class') {
              return false;
            }
            return (
              e.type === 'Char' ||
              e.type === 'Dot' ||
              e.type === 'Class' ||
              e.type === 'EscapeClass'
            );
          }
          case 'group':
            return e.type === 'Group' || e.type === 'Capture' || e.type === 'NamedCapture';
          case 'look-around':
            return e.type === 'LookAhead' || e.type === 'LookBehind';
          case 'repeat':
            return (
              e.type === 'Many' || e.type === 'Some' || e.type === 'Optional' || e.type === 'Repeat'
            );
        }
    }
  }

  /** Get a parent context. */
  private static upwardContext(context: RecurseContext): RecurseContext {
    const ancestry = context.ancestry.slice(0, -1);
    const path = context.path.concat();
    if (typeof path[path.length - 1] === 'number') {
      path.pop();
    }
    path.pop();
    return { ancestry, path };
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
   * Try to match this selector against the given element on the context and scope.
   *
   * It is designed for calling inside `recurse` handler.
   */
  public match(e: Element, context: RecurseContext, scope: Element): boolean {
    return Query.match(this.selector, e, context, scope);
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
  public *match(e: Element, context: RecurseContext, scope: Element): Generator<Query> {
    const typeQueries = this.typeQueriesMap.get(e.type) ?? [];
    const universalQueries = this.universalQueries;

    let i = typeQueries.length - 1;
    let j = universalQueries.length - 1;
    while (i >= 0 || j >= 0) {
      const q =
        i < 0 || (j >= 0 && QuerySet.compare(typeQueries[i], universalQueries[j]) < 0)
          ? universalQueries[j--]
          : typeQueries[i--];
      if (q.query.match(e, context, scope)) {
        yield q.query;
      }
    }
  }
}
