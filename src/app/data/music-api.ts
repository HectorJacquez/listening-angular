import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { loose, norm } from './matching';
import { Artist, Play, Snapshot, Totals, primaryArtist } from './models';

/** A token so tests can point the service at their own file. */
export const SNAPSHOT_URL = new InjectionToken<string>('SNAPSHOT_URL', {
  providedIn: 'root',
  factory: () => 'snapshot.json',
});

/** How many artists the snapshot ranks in full. */
export const TOP_ARTISTS = 60;

@Injectable({ providedIn: 'root' })
export class MusicApi {
  private readonly http = inject(HttpClient);
  private readonly url = inject(SNAPSHOT_URL);

  readonly snapshot$: Observable<Snapshot> = this.http
    .get<Snapshot>(this.url)
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  totals(): Observable<Totals> {
    return this.snapshot$.pipe(map((s) => s.totals));
  }

  recentPlays(): Observable<Play[]> {
    return this.snapshot$.pipe(map((s) => [...s.recent].sort((a, b) => b.playedAt - a.playedAt)));
  }

  artists(): Observable<Artist[]> {
    return this.snapshot$.pipe(map((s) => s.artists));
  }

  /** The snapshot also holds everyone from the recent plays, who are not top artists. */
  topArtists(): Observable<Artist[]> {
    return this.artists().pipe(
      map((all) => [...all].sort((a, b) => b.plays - a.plays).slice(0, TOP_ARTISTS)),
    );
  }

  artist(name: string): Observable<Artist | undefined> {
    const exact = norm(primaryArtist(name));
    const lax = loose(primaryArtist(name));
    return this.artists().pipe(
      map(
        (all) =>
          all.find((a) => norm(primaryArtist(a.name)) === exact) ??
          all.find((a) => loose(primaryArtist(a.name)) === lax),
      ),
    );
  }
}
