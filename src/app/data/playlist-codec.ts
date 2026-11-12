import { PlaylistItem } from './playlist-store';

/** [artist, title, album, seconds] per track, as JSON, then base64url. */
export interface SharedPlaylist {
  name: string;
  items: Pick<PlaylistItem, 'artist' | 'title' | 'album' | 'duration'>[];
}

/** Caps, so a crafted link cannot make the page build a huge list. */
export const MAX_SHARED_ITEMS = 200;
const MAX_CODE_LENGTH = 60_000;
const MAX_TEXT = 200;

export function encodePlaylist(p: SharedPlaylist): string {
  const compact = [
    p.name,
    ...p.items.map((i) => [i.artist, i.title, i.album, Math.round(i.duration)]),
  ];
  return toBase64Url(JSON.stringify(compact));
}

export function decodePlaylist(code: string): SharedPlaylist | null {
  if (code.length > MAX_CODE_LENGTH) return null;
  try {
    const raw = JSON.parse(fromBase64Url(code)) as unknown;
    if (!Array.isArray(raw) || typeof raw[0] !== 'string') return null;
    const items = raw.slice(1, 1 + MAX_SHARED_ITEMS).flatMap((r) => {
      if (!Array.isArray(r) || r.length < 4) return [];
      const [artist, title, album, duration] = r as [string, string, string, number];
      return [
        {
          artist: text(artist),
          title: text(title),
          album: text(album),
          duration: Number(duration) || 0,
        },
      ];
    });
    return { name: text(raw[0]), items };
  } catch {
    return null;
  }
}

function text(value: unknown): string {
  return String(value).slice(0, MAX_TEXT);
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
