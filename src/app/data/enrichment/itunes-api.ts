import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { RequestGate } from './request-gate';
import { norm, sameName } from '../matching';

export interface ItunesAlbum {
  name: string;
  art: string;
  year: number | null;
  tracks: number;
  url: string;
  genre: string;
}

export interface ItunesSong {
  title: string;
  album: string;
  art: string;
  preview: string;
  url: string;
  ms: number;
}

interface RawResult {
  wrapperType: string;
  collectionType?: string;
  artistName: string;
  collectionName?: string;
  trackName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  trackCount?: number;
  collectionViewUrl?: string;
  trackViewUrl?: string;
  previewUrl?: string;
  primaryGenreName?: string;
  trackTimeMillis?: number;
}

export const ITUNES_URL = 'https://itunes.apple.com/search';
export const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup';
/** Apple documents no limit but answers 403 past roughly 20 calls a minute. */
export const ITUNES_MIN_GAP_MS = 3100;

@Injectable({ providedIn: 'root' })
export class ItunesApi {
  private readonly http = inject(HttpClient);
  private readonly gate = new RequestGate(ITUNES_MIN_GAP_MS, [403, 429, 503]);

  albums(artist: string): Observable<ItunesAlbum[]> {
    return this.query(artist, 'album').pipe(
      map((rows) =>
        rows
          .filter((r) => r.wrapperType === 'collection' && sameName(r.artistName, artist))
          .filter((r) => !/ - (Single|EP)$/i.test(r.collectionName ?? ''))
          .map((r) => ({
            name: r.collectionName ?? '',
            art: bigger(r.artworkUrl100),
            year: year(r.releaseDate),
            tracks: r.trackCount ?? 0,
            url: r.collectionViewUrl ?? '',
            genre: r.primaryGenreName ?? '',
          }))
          .sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
      ),
    );
  }

  songs(artist: string): Observable<ItunesSong[]> {
    return this.query(artist, 'song').pipe(
      map((rows) =>
        rows.filter((r) => r.wrapperType === 'track' && sameName(r.artistName, artist)).map(song),
      ),
    );
  }

  song(artist: string, title: string): Observable<ItunesSong | null> {
    const params = { term: `${artist} ${title}`, entity: 'song', limit: '5', media: 'music' };
    return this.gate
      .run(`song:${norm(artist)} ${norm(title)}`, () =>
        this.http
          .get<{ results: RawResult[] }>(ITUNES_URL, { params })
          .pipe(map((r) => r.results ?? [])),
      )
      .pipe(
        map((rows) => {
          const want = norm(title);
          const hit =
            rows.find((r) => sameName(r.artistName, artist) && norm(r.trackName ?? '') === want) ??
            rows.find((r) => sameName(r.artistName, artist));
          return hit ? song(hit) : null;
        }),
      );
  }

  /** Look up by artist id. A search by name ranks by popularity across everyone,
   *  so the artist's own records can be missing from it. */
  private query(artist: string, entity: 'album' | 'song'): Observable<RawResult[]> {
    return this.artistId(artist).pipe(
      switchMap((id) => {
        if (id == null) return of<RawResult[]>([]);
        const params = { id: String(id), entity, limit: '200' };
        return this.gate.run(`${entity}:${id}`, () =>
          this.http
            .get<{ results: RawResult[] }>(ITUNES_LOOKUP_URL, { params })
            .pipe(map((r) => r.results ?? [])),
        );
      }),
    );
  }

  private artistId(artist: string): Observable<number | null> {
    const params = { term: artist, entity: 'musicArtist', limit: '5', media: 'music' };
    return this.gate.run(`artist:${norm(artist)}`, () =>
      this.http
        .get<{ results: RawArtist[] }>(ITUNES_URL, { params })
        .pipe(
          map(
            (r) => (r.results ?? []).find((a) => sameName(a.artistName, artist))?.artistId ?? null,
          ),
        ),
    );
  }
}

interface RawArtist {
  artistName: string;
  artistId: number;
}

function song(r: RawResult): ItunesSong {
  return {
    title: r.trackName ?? '',
    album: r.collectionName ?? '',
    art: bigger(r.artworkUrl100),
    preview: r.previewUrl ?? '',
    url: r.trackViewUrl ?? '',
    ms: r.trackTimeMillis ?? 0,
  };
}

/** iTunes hands back 100px art; the same path serves any size. */
export function bigger(url: string | undefined, px = 300): string {
  return (url ?? '').replace(/\/\d+x\d+bb\./, `/${px}x${px}bb.`);
}

function year(iso: string | undefined): number | null {
  const y = iso ? Number(iso.slice(0, 4)) : NaN;
  return Number.isFinite(y) ? y : null;
}
