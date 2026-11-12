export interface Totals {
  plays: number;
  hours: number;
  tracks: number;
  artists: number;
  albums: number;
  libraryHours: number;
}

export interface Play {
  id: string;
  /** unix seconds */
  playedAt: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  year: number;
  genre: string;
}

export interface Track {
  title: string;
  album: string;
  plays: number;
  duration: number;
  year: number;
  genre: string;
}

export interface Artist {
  name: string;
  plays: number;
  tracks: number;
  albums: number;
  genre: string | null;
  image?: string | null;
  topTracks: Track[];
}

export interface Snapshot {
  generatedAt: number;
  totals: Totals;
  recent: Play[];
  artists: Artist[];
}

/** Navidrome joins multi-artist tags with ';'. The first is the credited artist. */
export function primaryArtist(tag: string): string {
  return tag.split(';')[0].trim();
}
