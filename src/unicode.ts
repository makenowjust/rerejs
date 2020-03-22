import propertyAliases from 'unicode-property-aliases-ecmascript';
import propertyValueAliases from 'unicode-property-value-aliases-ecmascript';

import { CharSet } from './char-set';
import { category, property, script, scriptExtensions } from './data/unicode';

/** Cache for loaded `ChaeSet`. */
const CACHE: Map<string, CharSet> = new Map();

/** Load `CharSet` corresponding to Unicode `General_Category` value. */
const loadCategory = (v: string): CharSet | null => {
  // Canonicalize value name.
  v = propertyValueAliases.get('General_Category')?.get(v) || v;

  const key = `General_Category.${v}`;
  const cache = CACHE.get(key);
  if (cache) {
    return cache;
  }

  const data = category.get(v);
  if (!data) {
    return null;
  }
  const set = new CharSet(data);
  CACHE.set(key, set);
  return set;
};

/** Load `CharSet` corresponding to Unicode `Script` value. */
const loadScript = (v: string): CharSet | null => {
  // Canonicalize value name.
  v = propertyValueAliases.get('Script')?.get(v) || v;

  const key = `Script.${v}`;
  const cache = CACHE.get(key);
  if (cache) {
    return cache;
  }

  const data = script.get(v);
  if (!data) {
    return null;
  }
  const set = new CharSet(data);
  CACHE.set(key, set);
  return set;
};

/** Load `CharSet` corresponding to Unicode `Script_Extensions` value. */
const loadScriptExtensions = (v: string): CharSet | null => {
  // Canonicalize value name.
  v = propertyValueAliases.get('Script_Extensions')?.get(v) || v;

  const key = `Script_Extensions.${v}`;
  const cache = CACHE.get(key);
  if (cache) {
    return cache;
  }

  const baseSet = loadScript(v);
  if (!baseSet) {
    return null;
  }
  const data = scriptExtensions.get(v);
  if (!data) {
    throw new Error('BUG: Script_Extensions must contain each value of Script');
  }

  const extSet = new CharSet(data);
  const set = baseSet.clone();
  set.addCharSet(extSet);
  CACHE.set(key, set);
  return set;
};

/**
 * Load `CharSet` corresponding to Unicode property.
 *
 * Return `null` if property is invalid.
 *
 * See https://www.ecma-international.org/ecma-262/10.0/index.html#sec-runtime-semantics-unicodematchproperty-p.
 */
export const loadProperty = (p: string): CharSet | null => {
  // Canonicalize property name.
  p = propertyAliases.get(p) || p;

  const cache = CACHE.get(p);
  if (cache) {
    return cache;
  }

  const data = property.get(p);
  if (!data) {
    return null;
  }

  const set = new CharSet(data);
  CACHE.set(p, set);
  return set;
};

/**
 * Load `CharSet` corresponding to Unicode property and value.
 *
 * Return `null` if property or value is invalid.
 *
 * See https://www.ecma-international.org/ecma-262/10.0/index.html#sec-runtime-semantics-unicodematchpropertyvalue-p-v.
 */
export const loadPropertyValue = (p: string, v: string): CharSet | null => {
  // Canonicalize property name.
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
