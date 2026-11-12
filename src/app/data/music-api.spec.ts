import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { MusicApi, SNAPSHOT_URL, TOP_ARTISTS } from './music-api';
import { Snapshot } from './models';

const fixture: Snapshot = {
  generatedAt: 1,
  totals: { plays: 10, hours: 2, tracks: 3, artists: 2, albums: 2, libraryHours: 1 },
  recent: [
    {
      id: 'a',
      playedAt: 100,
      title: 'Old',
      artist: 'X',
      album: 'A',
      duration: 60,
      year: 2000,
      genre: '',
    },
    {
      id: 'b',
      playedAt: 300,
      title: 'New',
      artist: 'Y;Alias',
      album: 'B',
      duration: 60,
      year: 2001,
      genre: '',
    },
  ],
  artists: [
    { name: 'Y;Alias', plays: 5, tracks: 1, albums: 1, genre: null, topTracks: [] },
    { name: 'X', plays: 5, tracks: 1, albums: 1, genre: 'idm', topTracks: [] },
    { name: 'Beatles', plays: 1337, tracks: 1, albums: 1, genre: null, topTracks: [] },
  ],
};

describe('MusicApi', () => {
  let api: MusicApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SNAPSHOT_URL, useValue: 'test-snapshot.json' },
      ],
    });
    api = TestBed.inject(MusicApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('fetches the configured URL once and shares it across calls', async () => {
    const totals = firstValueFrom(api.totals());
    const plays = firstValueFrom(api.recentPlays());
    http.expectOne('test-snapshot.json').flush(fixture);
    expect((await totals).plays).toBe(10);
    expect((await plays).length).toBe(2);
    http.expectNone('test-snapshot.json');
  });

  it('orders recent plays newest first', async () => {
    const plays = firstValueFrom(api.recentPlays());
    http.expectOne('test-snapshot.json').flush(fixture);
    expect((await plays).map((p) => p.title)).toEqual(['New', 'Old']);
  });

  it('finds an artist by the credited name, ignoring aliases and case', async () => {
    const hit = firstValueFrom(api.artist('y'));
    http.expectOne('test-snapshot.json').flush(fixture);
    expect((await hit)?.plays).toBe(5);
  });

  it('matches "The Beatles" to my "Beatles" tag, any case', async () => {
    const hit = firstValueFrom(api.artist('the BEATLES'));
    http.expectOne('test-snapshot.json').flush(fixture);
    expect((await hit)?.plays).toBe(1337);
  });

  it('returns undefined for an artist outside the snapshot', async () => {
    const miss = firstValueFrom(api.artist('Nobody'));
    http.expectOne('test-snapshot.json').flush(fixture);
    expect(await miss).toBeUndefined();
  });

  it('ranks only the top artists, leaving out the rest of the snapshot', async () => {
    const extra = Array.from({ length: TOP_ARTISTS }, (_, n) => ({
      name: 'Filler ' + n,
      plays: 100 + n,
      tracks: 1,
      albums: 1,
      genre: null,
      topTracks: [],
    }));
    const top = firstValueFrom(api.topArtists());
    http
      .expectOne('test-snapshot.json')
      .flush({ ...fixture, artists: [...fixture.artists, ...extra] });
    const names = (await top).map((a) => a.name);
    expect(names.length).toBe(TOP_ARTISTS);
    expect(names[0]).toBe('Beatles');
    expect(names).not.toContain('X');
  });
});
