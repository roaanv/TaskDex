// src/model/hashToken.ts — pure parsing of #-prefixed property syntax in card text.
// Frame-agnostic: no React/DOM. Powers hash property capture + caret autocomplete.

/** A completed `#name: value` line. First name char must be a letter. */
export const HASH_PROP_LINE = /^\s*#([A-Za-z][A-Za-z0-9 _\-]*?)\s*:\s*(\S.*?)\s*$/;

export interface FoundProp {
  name: string;
  value: string;
}

export interface ExtractResult {
  remaining: string;
  found: FoundProp[];
}

/**
 * Lift `#name: value` lines out of `text` into `found`, leaving the rest in
 * `remaining`. When `includeLast` is false the final line is never captured
 * (it may still be mid-edit). `isCapturable` (default: all) lets the caller
 * keep unknown names as plain text instead of capturing them.
 */
export function extractHashProps(
  text: string,
  includeLast: boolean,
  isCapturable: (name: string) => boolean = () => true,
): ExtractResult {
  const lines = (text || '').split('\n');
  const keep: string[] = [];
  const found: FoundProp[] = [];
  lines.forEach((ln, i) => {
    const isLast = i === lines.length - 1;
    const m = ln.match(HASH_PROP_LINE);
    const name = m ? m[1].trim() : '';
    if (m && (!isLast || includeLast) && isCapturable(name)) {
      found.push({ name, value: m[2].trim() });
    } else {
      keep.push(ln);
    }
  });
  return { remaining: keep.join('\n'), found };
}
