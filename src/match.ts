// # match.ts
//
// > Defines `Match` class which is a result of `Program` execution.

export class Match {
  public readonly input: string;

  private readonly begins: readonly (number | undefined)[];
  private readonly ends: readonly (number | undefined)[];
  private readonly names: ReadonlyMap<string, number>;

  constructor(
    input: string,
    begins: (number | undefined)[],
    ends: (number | undefined)[],
    names: ReadonlyMap<string, number>
  ) {
    this.input = input;
    this.begins = begins;
    this.ends = ends;
    this.names = names;
  }

  get length(): number {
    return this.begins.length;
  }

  public get(k: number | string): string | undefined {
    if (typeof k === 'string') {
      const i = this.names.get(k);
      if (!i) {
        return undefined;
      }
      k = i;
    }
    return this.input.slice(this.begins[k], this.ends[k]);
  }

  public toArray(): RegExpMatchArray {
    const array: (string | undefined)[] & RegExpMatchArray = [];
    array.input = this.input;
    array.index = this.begins[0];

    for (let i = 0; i < this.length; i++) {
      array.push(this.get(i));
    }
    const groups: { [key: string]: string | undefined } = Object.create(null);
    for (const [name, i] of this.names) {
      groups[name] = array[i];
    }
    // In typescript 3.8.3 at least, `RegExpMatchArray`'s `groups` defined as `{[key: string]: string}`.
    // However `groups` property value can contain `undefined`. It this TS  standard lib definition BUG?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (array as any).groups = groups;

    return array;
  }

  public toString(): string {
    const array = this.toArray();
    return `Match[${JSON.stringify(array).slice(1, -1)}, index: ${
      this.begins[0]
    }, groups: ${JSON.stringify(array.groups)}]`;
  }
}
