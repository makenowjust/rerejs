

import { escape } from './escape';

/** The maximum valid code point of Unicode. */
const MAX_CODE_POINT = 0x110000;

/** `CharSet` is a set of code points. */
export class CharSet {
  /**
   * Internal data of this.
   *
   * This is a sorted number array.
   * An odd element is begin of a range, and an even element is end of a range.
   * So, this array's size must be even always.
   *
   * ```typescript
   * const set = new CharSet();
   * set.add(10, 20);
   * set.add(30, 40)
   * console.log(set.data);
   * // => [10, 20, 30, 40]
   * ```
   */
  public data: number[];

  constructor(data: number[] = []) {
    this.data = data;
  }

  /** Add a range to this. */
  public add(begin: number, end: number = begin + 1): void {
    const i = this.searchBegin(begin);
    const j = this.searchEnd(end);

    const removed = this.data.splice(i * 2, (j - i + 1) * 2);
    if (removed.length > 0) {
      begin = Math.min(begin, removed[0]);
      end = Math.max(end, removed[removed.length - 1]);
    }

    this.data.splice(i * 2, 0, begin, end);
  }

  /** Add another `CharSet` to this. */
  public addCharSet(set: CharSet): void {
    for (let i = 0; i < set.data.length; i += 2) {
      const begin = set.data[i];
      const end = set.data[i + 1];
      this.add(begin, end);
    }
  }

  /**
   * Invert this set.
   *
   * Note that this method is mutable like `Array.prototype.reverse`.
   * Please clone before this if immutable is desired.
   */
  public invert(): CharSet {
    if (this.data.length === 0) {
      this.data.push(0, MAX_CODE_POINT);
      return this;
    }

    if (this.data[0] === 0 && this.data[this.data.length - 1] === MAX_CODE_POINT) {
      this.data.shift();
      this.data.pop();
      return this;
    }

    this.data.unshift(0);
    this.data.push(MAX_CODE_POINT);
    return this;
  }

  /** Clone this set. */
  public clone(): CharSet {
    return new CharSet(Array.from(this.data));
  }

  /** Check is a code point contained in this set. */
  public has(c: number): boolean {
    const i = this.searchEnd(c);

    if (i < 0 || this.data.length <= i * 2) {
      return false;
    }
    const begin = this.data[i * 2];
    const end = this.data[i * 2 + 1];
    return begin <= c && c < end;
  }

  /** Convert this into `RegExp` char-class pattern string. */
  public toRegExpPattern(invert = false): string {
    let s = '[';
    if (invert) {
      s += '^';
    }

    for (let i = 0; i < this.data.length; i += 2) {
      const begin = this.data[i];
      const end = this.data[i + 1];
      s += escape(begin, true);
      if (begin !== end - 1) {
        s += `-${escape(end - 1, true)}`;
      }
    }

    return s + ']';
  }

  public toString(): string {
    return `CharSet${this.toRegExpPattern()}`;
  }

  /** Find the least `i` such that satisfy `c <= this.data[i * 2 + 1]`. */
  private searchBegin(c: number): number {
    let min = -1;
    let max = this.data.length / 2;
    while (max - min > 1) {
      const mid = min + Math.floor((max - min) / 2);
      if (c <= this.data[mid * 2 + 1]) {
        max = mid;
      } else {
        min = mid;
      }
    }
    return max;
  }

  /** Find the maximum `j` such that satisfy `this.ranges[j * 2] <= c`. */
  private searchEnd(c: number): number {
    let min = -1;
    let max = this.data.length / 2;
    while (max - min > 1) {
      const mid = min + Math.floor((max - min) / 2);
      if (this.data[mid * 2] <= c) {
        min = mid;
      } else {
        max = mid;
      }
    }
    return min;
  }
}
