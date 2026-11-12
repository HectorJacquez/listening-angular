import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, shareReplay, switchMap } from 'rxjs';

export interface WikiSummary {
  title: string;
  extract: string;
  thumbnail: string | null;
  url: string;
}

export const WIKI_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary';
export const WIKIDATA_URL = 'https://www.wikidata.org/wiki/Special:EntityData';

/** Goes through Wikidata when MusicBrainz knows the item, so "Katamari" the
 *  artist does not resolve to the game. */
@Injectable({ providedIn: 'root' })
export class WikipediaApi {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<WikiSummary | null>>();

  byTitle(title: string): Observable<WikiSummary | null> {
    const key = `t:${title}`;
    if (!this.cache.has(key)) {
      this.cache.set(
        key,
        this.http
          .get<RawSummary>(`${WIKI_URL}/${encodeURIComponent(title.replace(/ /g, '_'))}`)
          .pipe(
            map((r) => (r.type === 'standard' ? toSummary(r) : null)),
            shareReplay({ bufferSize: 1, refCount: false }),
          ),
      );
    }
    return this.cache.get(key)!;
  }

  byWikidata(qid: string): Observable<WikiSummary | null> {
    const key = `q:${qid}`;
    if (!this.cache.has(key)) {
      this.cache.set(
        key,
        this.http.get<RawEntity>(`${WIKIDATA_URL}/${qid}.json`).pipe(
          map((r) => r.entities?.[qid]?.sitelinks?.['enwiki']?.title ?? null),
          switchMap((title) => (title ? this.byTitle(title) : of(null))),
          shareReplay({ bufferSize: 1, refCount: false }),
        ),
      );
    }
    return this.cache.get(key)!;
  }
}

interface RawSummary {
  type: string;
  title: string;
  extract: string;
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}
interface RawEntity {
  entities?: Record<string, { sitelinks?: Record<string, { title: string }> }>;
}

function toSummary(r: RawSummary): WikiSummary {
  return {
    title: r.title,
    extract: r.extract,
    thumbnail: r.thumbnail?.source ?? null,
    url: r.content_urls?.desktop?.page ?? '',
  };
}

/** "https://www.wikidata.org/wiki/Q3020722" -> "Q3020722" */
export function qidFrom(url: string | null): string | null {
  const m = url?.match(/\/(Q\d+)$/);
  return m ? m[1] : null;
}
