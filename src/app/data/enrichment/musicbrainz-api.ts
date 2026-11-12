import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { uniqueBy } from '../matching';
import { RequestGate } from './request-gate';

/** MusicBrainz asks clients to stay under one request a second. */
export interface MbArtistHit {
  id: string;
  name: string;
  type: string;
  country: string;
  disambiguation: string;
  begin: string;
  score: number;
}

export interface MbArtist {
  id: string;
  name: string;
  type: string;
  country: string;
  area: string;
  beginArea: string;
  begin: string;
  end: string;
  ended: boolean;
  tags: string[];
  wikidata: string | null;
  wikipedia: string | null;
  homepage: string | null;
}

export const MB_URL = 'https://musicbrainz.org/ws/2';
export const MB_MIN_GAP_MS = 1100;

@Injectable({ providedIn: 'root' })
export class MusicBrainzApi {
  private readonly http = inject(HttpClient);
  private readonly gate = new RequestGate(MB_MIN_GAP_MS, [429, 503]);

  search(query: string, limit = 8): Observable<MbArtistHit[]> {
    const q = query.trim();
    const params = { query: `artist:"${q.replace(/"/g, '')}"`, fmt: 'json', limit: String(limit) };
    return this.gate.run(`search:${q.toLowerCase()}`, () =>
      this.http
        .get<{ artists: RawHit[] }>(`${MB_URL}/artist/`, { params })
        .pipe(map((r) => dedupe((r.artists ?? []).map(toHit)))),
    );
  }

  lookup(id: string): Observable<MbArtist> {
    const params = { inc: 'url-rels+tags', fmt: 'json' };
    return this.gate.run(`artist:${id}`, () =>
      this.http.get<RawArtist>(`${MB_URL}/artist/${id}`, { params }).pipe(map(toArtist)),
    );
  }
}

/** MusicBrainz keeps placeholder entries ("for fake releases and mistagged
 *  recordings") under real names; keep the best-scored entry per name. */
function dedupe(hits: MbArtistHit[]): MbArtistHit[] {
  const real = hits.filter((h) => !/fake releases|mistagged/i.test(h.disambiguation));
  const bestFirst = [...real].sort((a, b) => b.score - a.score);
  return uniqueBy(bestFirst, (h) => h.name.toLowerCase());
}

interface RawHit {
  id: string;
  name: string;
  type?: string;
  country?: string;
  disambiguation?: string;
  score?: number;
  'life-span'?: { begin?: string };
}
interface RawArtist {
  id: string;
  name: string;
  type?: string;
  country?: string;
  disambiguation?: string;
  area?: { name: string };
  'begin-area'?: { name: string };
  'life-span'?: { begin?: string | null; end?: string | null; ended?: boolean };
  tags?: { name: string; count: number }[];
  relations?: { type: string; url: { resource: string } }[];
}

function toHit(a: RawHit): MbArtistHit {
  return {
    id: a.id,
    name: a.name,
    type: a.type ?? '',
    country: a.country ?? '',
    disambiguation: a.disambiguation ?? '',
    begin: a['life-span']?.begin ?? '',
    score: a.score ?? 0,
  };
}

function toArtist(a: RawArtist): MbArtist {
  const rel = (type: string) => a.relations?.find((r) => r.type === type)?.url.resource ?? null;
  const life = a['life-span'];
  const tagsByCount = [...(a.tags ?? [])].sort((x, y) => y.count - x.count);
  return {
    id: a.id,
    name: a.name,
    type: a.type ?? '',
    country: a.country ?? '',
    area: a.area?.name ?? '',
    beginArea: a['begin-area']?.name ?? '',
    begin: life?.begin ?? '',
    end: life?.end ?? '',
    ended: !!life?.ended,
    tags: tagsByCount.slice(0, 6).map((t) => t.name),
    wikidata: rel('wikidata'),
    wikipedia: rel('wikipedia'),
    homepage: rel('official homepage'),
  };
}
