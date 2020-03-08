import * as path from 'path';

import { CharSet } from '../src/char-set';

export const BASE_DIR = path.join(__dirname, '..');
export const DATA_DIR = path.join(BASE_DIR, 'src', 'data');

export const fromCharCode = (c: number): string => String.fromCharCode(c);
export const upper = (c: number): string => fromCharCode(c).toUpperCase();
export const lower = (c: number): string => fromCharCode(c).toLowerCase();
export const hex = (n: number): string => `0x${n.toString(16).toUpperCase()}`;

export const toArray = (set: CharSet): number[][] => {
  const array = [];
  for (const { begin, end } of set.ranges) {
    if (begin === end - 1) {
      array.push([begin]);
    } else {
      array.push([begin, end]);
    }
  }
  return array;
};
