/** `SyntaxError` for `RegExp`. */
export class RegExpSyntaxError extends SyntaxError {
  constructor(message: string) {
    super(`invalid regular expression: ${message}`);
  }
}
