import * as path from 'path';

export const BASE_DIR = path.join(__dirname, '..');
export const DATA_DIR = path.join(BASE_DIR, 'src', 'data');

export const fromCharCode = (c: number): string => String.fromCharCode(c);
export const upper = (c: number): string => fromCharCode(c).toUpperCase();
export const lower = (c: number): string => fromCharCode(c).toLowerCase();
export const hex = (n: number): string => `0x${n.toString(16).toUpperCase()}`;
