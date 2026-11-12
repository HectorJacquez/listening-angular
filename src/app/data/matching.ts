/** "Sigur Rós" and "sigur ros" compare equal. */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** norm() without a leading "the": my tag says "Beatles". */
export function loose(s: string): string {
  return norm(s).replace(/^the /, '');
}

/** The word count has to agree too. norm() turns a symbol into a space, and
 *  without the check my "Hedge@hog" matched a Norwegian band called "Hedge Hog". */
export function sameName(a: string, b: string): boolean {
  return loose(a) === loose(b) && wordCount(a) === wordCount(b);
}

function wordCount(s: string): number {
  return s
    .trim()
    .replace(/^the\s+/i, '')
    .split(/\s+/).length;
}

export function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
