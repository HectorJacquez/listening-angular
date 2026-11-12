import { Injectable, inject } from '@angular/core';
import { Observable, map, of, shareReplay, switchMap } from 'rxjs';
import { ItunesAlbum, ItunesApi, ItunesSong } from './itunes-api';
import { sameName } from '../matching';
import { Loaded, track } from './loaded';
import { MbArtist, MusicBrainzApi } from './musicbrainz-api';
import { WikiSummary, WikipediaApi, qidFrom } from './wikipedia-api';

/** Each source has its own state, so one being down does not blank the page. */
export interface Enrichment {
  facts$: Observable<Loaded<MbArtist>>;
  bio$: Observable<Loaded<WikiSummary>>;
  albums$: Observable<Loaded<ItunesAlbum[]>>;
  songs$: Observable<Loaded<ItunesSong[]>>;
}

@Injectable({ providedIn: 'root' })
export class ArtistEnrichment {
  private readonly mb = inject(MusicBrainzApi);
  private readonly wiki = inject(WikipediaApi);
  private readonly itunes = inject(ItunesApi);

  enrich(name: string): Enrichment {
    // only an exact name match counts; the nearest other artist would be wrong
    const facts = this.mb.search(name, 5).pipe(
      map((hits) => hits.find((h) => sameName(h.name, name)) ?? null),
      switchMap((hit) => (hit ? this.mb.lookup(hit.id) : of(null))),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    const bio = facts.pipe(
      switchMap((a) => {
        const qid = qidFrom(a?.wikidata ?? null);
        if (qid) return this.wiki.byWikidata(qid);
        const title = a?.wikipedia?.split('/wiki/')[1];
        return this.wiki.byTitle(title ? decodeURIComponent(title) : name);
      }),
    );
    return {
      facts$: facts.pipe(track()),
      bio$: bio.pipe(track()),
      albums$: this.itunes.albums(name).pipe(track()),
      songs$: this.itunes.songs(name).pipe(track()),
    };
  }
}
