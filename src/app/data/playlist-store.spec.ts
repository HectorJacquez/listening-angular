import { PlaylistStore } from './playlist-store';

const item = (key: string, duration = 60) => ({
  key,
  title: key,
  artist: 'A',
  album: 'B',
  duration,
});

describe('PlaylistStore', () => {
  it('adds once, totals the length and removes', () => {
    const s = new PlaylistStore();
    s.add(item('x', 100));
    s.add(item('x', 100));
    s.add(item('y', 50));
    expect(s.count()).toBe(2);
    expect(s.totalSeconds()).toBe(150);
    expect(s.has('x')).toBe(true);
    s.remove('x');
    expect(s.has('x')).toBe(false);
    expect(s.totalSeconds()).toBe(50);
  });

  it('reorders within bounds', () => {
    const s = new PlaylistStore();
    ['a', 'b', 'c'].forEach((k) => s.add(item(k)));
    s.move('c', -1);
    expect(s.items().map((i) => i.key)).toEqual(['a', 'c', 'b']);
    s.move('a', -1);
    expect(s.items().map((i) => i.key)).toEqual(['a', 'c', 'b']);
  });

  it('keeps only the credited artist of a multi-artist play', () => {
    const s = new PlaylistStore();
    s.addPlay({
      id: 'p',
      playedAt: 0,
      title: 't',
      artist: 'harunemuri;Haru Nemuri',
      album: 'a',
      duration: 1,
      year: 0,
      genre: '',
    });
    expect(s.items()[0].artist).toBe('harunemuri');
  });
});
