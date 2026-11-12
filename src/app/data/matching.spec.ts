import { loose, norm, sameName, uniqueBy } from './matching';

describe('matching', () => {
  it('norm ignores case, accents and punctuation', () => {
    expect(norm('Sigur Rós')).toBe('sigur ros');
    expect(norm('  AC/DC ')).toBe('ac dc');
    expect(norm('Simon & Garfunkel')).toBe('simon and garfunkel');
  });

  it('loose also ignores a leading "the"', () => {
    expect(loose('The Beatles')).toBe(loose('beatles'));
    expect(loose('Theory')).toBe('theory');
  });

  it('sameName accepts spelling differences but not a different word split', () => {
    expect(sameName('Beatles', 'The Beatles')).toBe(true);
    expect(sameName('Sigur Rós', 'sigur ros')).toBe(true);
    expect(sameName('Jay-Z', 'JAY‐Z')).toBe(true);
    expect(sameName('Hedge@hog', 'Hedge Hog')).toBe(false);
    expect(sameName('Death Grips', 'Death Grip')).toBe(false);
  });

  it('uniqueBy keeps the first item per key, in order', () => {
    const rows = [
      { t: 'a', n: 1 },
      { t: 'b', n: 2 },
      { t: 'a', n: 3 },
    ];
    expect(uniqueBy(rows, (r) => r.t).map((r) => r.n)).toEqual([1, 2]);
  });
});
