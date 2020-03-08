// # char-set.ts
//
// > Defines the `CharSet` class.

import { escape } from './escape';

const MAX_CODE_POINT = 0x110000;

export interface Range {
  begin: number;
  end: number;
}

/** `CharSet` is a set of character code points. */
export class CharSet {
  public ranges: Range[];

  constructor(ranges: Range[] = []) {
    this.ranges = ranges;
  }

  public toRegExpString(invert = false): string {
    let s = '[';
    if (invert) {
      s += '^';
    }

    for (const { begin, end } of this.ranges) {
      s += escape(begin, true);
      if (begin !== end - 1) {
        s += '-' + escape(end - 1, true);
      }
    }

    return s + ']';
  }

  public add(begin: number, end: number): void {
    const i = this.searchBegin(begin);
    const j = this.searchEnd(end);

    const spliced = this.ranges.splice(i, j - i + 1);
    const range = { begin, end };
    if (spliced.length > 0) {
      range.begin = Math.min(range.begin, spliced[0].begin);
      range.end = Math.max(range.end, spliced[spliced.length - 1].end);
    }

    this.ranges.splice(i, 0, range);
  }

  public addCharSet(charSet: CharSet): void {
    for (const { begin, end } of charSet.ranges) {
      this.add(begin, end);
    }
  }

  public invert(): CharSet {
    if (this.ranges.length === 0) {
      return new CharSet([{ begin: 0, end: MAX_CODE_POINT }]);
    }

    let index = 0;
    let begin = 0;
    if (this.ranges.length > 0 && this.ranges[0].begin === 0) {
      begin = this.ranges[0].end;
      index = 1;
    }

    const ranges = [];
    for (; index < this.ranges.length; index++) {
      const end = this.ranges[index].begin;
      ranges.push({ begin, end });
      begin = this.ranges[index].end;
    }

    if (begin !== MAX_CODE_POINT) {
      ranges.push({ begin, end: MAX_CODE_POINT });
    }

    return new CharSet(ranges);
  }

  public clone(): CharSet {
    return new CharSet(Array.from(this.ranges));
  }

  public has(c: number): boolean {
    let min = -1;
    let max = this.ranges.length;
    while (max - min > 1) {
      const mid = min + Math.floor((max - min) / 2);
      if (this.ranges[mid].end <= c) {
        min = mid;
      } else {
        max = mid;
      }
    }

    if (max >= this.ranges.length) {
      return false;
    }
    const { begin, end } = this.ranges[max];
    return begin <= c && c < end;
  }

  /** Searchs the least `i` such that staisfy `begin <= this.ranges[i].end`. */
  private searchBegin(begin: number): number {
    let min = -1;
    let max = this.ranges.length;
    while (max - min > 1) {
      const mid = min + Math.floor((max - min) / 2);
      if (begin <= this.ranges[mid].end) {
        max = mid;
      } else {
        min = mid;
      }
    }
    return max;
  }

  /** Searchs the maximum `j` such that satisfy `this.ranges[j].begin <= end`. */
  private searchEnd(end: number): number {
    let min = -1;
    let max = this.ranges.length;
    while (max - min > 1) {
      const mid = min + Math.floor((max - min) / 2);
      if (this.ranges[mid].begin <= end) {
        min = mid;
      } else {
        max = mid;
      }
    }
    return min;
  }
}
