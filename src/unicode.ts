// # unicode.ts
//
// > Provides Unicode property operations.

import propertyAliases from 'unicode-property-aliases-ecmascript';
import propertyValueAliases from 'unicode-property-value-aliases-ecmascript';

import { CharSet } from './char-set';
import { category } from './data/unicode-category';
import { property } from './data/unicode-property';
import { script, scriptExtensions } from './data/unicode-script';

const CACHE: Map<string, CharSet> = new Map();

const loadData = (data: number[][]): CharSet => {
  const set = new CharSet();
  for (const r of data) {
    set.add(r[0], r[1] || r[0] + 1);
  }
  return set;
};

const loadCategory = (v: string): CharSet | null => {
  // Canonicalizes value name.
  v = propertyValueAliases.get('General_Category')?.get(v) || v;

  const key = `General_Category.${v}`;
  const set0 = CACHE.get(key);
  if (set0) {
    return set0;
  }

  const data = category.get(v);
  if (!data) {
    return null;
  }
  const set = loadData(data);
  CACHE.set(key, set);
  return set;
};

const loadScript = (v: string): CharSet | null => {
  // Canonicalizes value name.
  v = propertyValueAliases.get('Script')?.get(v) || v;

  const key = `Script.${v}`;
  const set0 = CACHE.get(key);
  if (set0) {
    return set0;
  }

  const data = script.get(v);
  if (!data) {
    return null;
  }
  const set = loadData(data);
  CACHE.set(key, set);
  return set;
};

const loadScriptExtensions = (v: string): CharSet | null => {
  // Canonicalizes value name.
  v = propertyValueAliases.get('Script_Extensions')?.get(v) || v;

  const key = `Script_Extensions.${v}`;
  const set0 = CACHE.get(key);
  if (set0) {
    return set0;
  }

  const baseSet = loadScript(v);
  if (!baseSet) {
    return null;
  }
  const data = scriptExtensions.get(v);
  if (!data) {
    return baseSet;
  }

  const extSet = loadData(data);
  const set = baseSet.clone();
  set.addCharSet(extSet);
  CACHE.set(key, set);
  return set;
};

export const matchProperty = (p: string): CharSet | null => {
  // Canonicalizes property name.
  p = propertyAliases.get(p) || p;

  const set0 = CACHE.get(p);
  if (set0) {
    return set0;
  }

  const data = property.get(p);
  if (!data) {
    return null;
  }

  const set = loadData(data);
  CACHE.set(p, set);
  return set;
};

export const matchPropertyValue = (p: string, v: string): CharSet | null => {
  // Canonicalizes property name.
  p = propertyAliases.get(p) || p;

  switch (p) {
    case 'General_Category':
      return loadCategory(v);
    case 'Script':
      return loadScript(v);
    case 'Script_Extensions':
      return loadScriptExtensions(v);
    default:
      return null;
  }
};
