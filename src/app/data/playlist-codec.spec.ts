import { MAX_SHARED_ITEMS, decodePlaylist, encodePlaylist } from './playlist-codec';

describe('playlist codec', () => {
  it('round-trips a playlist through a URL-safe string', () => {
    const p = {
      name: 'late shift',
      items: [
        { artist: 'Death Grips', title: 'Hahaha', album: 'Year Of The Snitch', duration: 214.99 },
        { artist: 'クラムボン', title: 'Re-Bass,Bass,Bass', album: 'JP', duration: 300 },
      ],
    };
    const code = encodePlaylist(p);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodePlaylist(code)).toEqual({
      name: 'late shift',
      items: [
        { artist: 'Death Grips', title: 'Hahaha', album: 'Year Of The Snitch', duration: 215 },
        { artist: 'クラムボン', title: 'Re-Bass,Bass,Bass', album: 'JP', duration: 300 },
      ],
    });
  });

  it('bounds what a crafted link can make the page build', () => {
    const track = { artist: 'a', title: 't'.repeat(5000), album: 'b', duration: 1 };
    const many = encodePlaylist({ name: 'n', items: Array(MAX_SHARED_ITEMS + 50).fill(track) });
    expect(many.length).toBeGreaterThan(60_000);
    expect(decodePlaylist(many)).toBeNull();

    const ok = { artist: 'a', title: 't', album: 'b', duration: 1 };
    const long = decodePlaylist(
      encodePlaylist({ name: 'n', items: Array(MAX_SHARED_ITEMS + 50).fill(ok) }),
    );
    expect(long?.items.length).toBe(MAX_SHARED_ITEMS);
    expect(
      decodePlaylist(encodePlaylist({ name: 'n', items: [track] }))?.items[0].title.length,
    ).toBe(200);
  });

  it('rejects garbage without throwing', () => {
    expect(decodePlaylist('not base64!')).toBeNull();
    expect(decodePlaylist(btoa('{"a":1}'))).toBeNull();
  });
});
