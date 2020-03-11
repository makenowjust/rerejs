/** Escape a code point as regular expression source character. */
export const escape = (c: number, inCharClass = false): string => {
  // Common escape character.
  switch (c) {
    case 0x09:
      return '\\t';
    case 0x0a:
      return '\\n';
    case 0x0b:
      return '\\v';
    case 0x0c:
      return '\\f';
    case 0x0d:
      return '\\r';
    case 0x5c:
      return '\\\\';
    case 0x5e:
      return '\\^';
    case 0x5d:
      return '\\]';
  }

  if (inCharClass) {
    // In char class, `'-'` must be escaped.
    if (c === 0x2d) {
      return '\\-';
    }
  } else {
    // Character having meaning in pattern string.
    switch (c) {
      case 0x24:
        return '\\$';
      case 0x28:
        return '\\(';
      case 0x29:
        return '\\)';
      case 0x2a:
        return '\\*';
      case 0x2b:
        return '\\+';
      case 0x2e:
        return '\\.';
      case 0x2f:
        return '\\/';
      case 0x3f:
        return '\\?';
      case 0x5b:
        return '\\[';
      case 0x7b:
        return '\\{';
      case 0x7c:
        return '\\|';
      case 0x7d:
        return '\\}';
    }
  }

  // Control character uses hex escape.
  if (c <= 0x1f || (0x7f <= c && c <= 0xff)) {
    return `\\x${c.toString(16).padStart(2, '0')}`;
  }

  // ASCII character returns itself.
  if (c <= 0x80) {
    return String.fromCodePoint(c);
  }

  // BMP code point use `\uXXXX`.
  if (c <= 0xffff) {
    return `\\u${c.toString(16).padStart(4, '0')}`;
  }

  // Other code point use `\u{XXXXXX}`.
  return `\\u{${c.toString(16)}}`;
};
