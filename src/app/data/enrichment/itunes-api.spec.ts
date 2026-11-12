import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ITUNES_LOOKUP_URL, ITUNES_MIN_GAP_MS, ITUNES_URL, ItunesApi, bigger } from './itunes-api';

describe('ItunesApi', () => {
  let api: ItunesApi;
  let http: HttpTestingController;
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ItunesApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });
  const gap = () => vi.advanceTimersByTimeAsync(ITUNES_MIN_GAP_MS);

  const artistHit = {
    results: [
      { artistName: 'Death Grip', artistId: 1 },
      { artistName: 'Death Grips', artistId: 437819641 },
    ],
  };

  it('resolves the exact artist, then lists albums newest first without singles', async () => {
    const p = firstValueFrom(api.albums('death grips'));
    await gap();
    http
      .expectOne((r) => r.url === ITUNES_URL && r.params.get('entity') === 'musicArtist')
      .flush(artistHit);
    await gap();
    const lookup = http.expectOne(
      (r) => r.url === ITUNES_LOOKUP_URL && r.params.get('entity') === 'album',
    );
    expect(lookup.request.params.get('id')).toBe('437819641');
    lookup.flush({
      results: [
        { wrapperType: 'artist', artistName: 'Death Grips' },
        {
          wrapperType: 'collection',
          artistName: 'Death Grips',
          collectionName: 'Guillotine - Single',
          releaseDate: '2011-08-03T00:00:00Z',
          artworkUrl100: 'x/100x100bb.jpg',
        },
        {
          wrapperType: 'collection',
          artistName: 'Death Grips',
          collectionName: 'The Money Store',
          releaseDate: '2012-04-24T00:00:00Z',
          artworkUrl100: 'x/100x100bb.jpg',
          trackCount: 13,
        },
        {
          wrapperType: 'collection',
          artistName: 'Death Grips',
          collectionName: 'Year of the Snitch',
          releaseDate: '2018-06-22T00:00:00Z',
          artworkUrl100: 'x/100x100bb.jpg',
          trackCount: 13,
        },
      ],
    });
    const albums = await p;
    expect(albums.map((a) => a.name)).toEqual(['Year of the Snitch', 'The Money Store']);
    expect(albums[0].art).toBe('x/300x300bb.jpg');
    expect(albums[0].year).toBe(2018);
  });

  it('returns nothing, with no lookup, when iTunes does not know the artist', async () => {
    const p = firstValueFrom(api.songs('Nobody Here'));
    await gap();
    http.expectOne((r) => r.url === ITUNES_URL).flush({ results: [] });
    expect(await p).toEqual([]);
  });

  it('caches the artist id across albums and songs', async () => {
    const a = firstValueFrom(api.albums('Death Grips'));
    const s = firstValueFrom(api.songs('Death Grips'));
    await gap();
    http.expectOne((r) => r.params.get('entity') === 'musicArtist').flush(artistHit);
    await gap();
    http.expectOne((r) => r.params.get('entity') === 'album').flush({ results: [] });
    await gap();
    http.expectOne((r) => r.params.get('entity') === 'song').flush({ results: [] });
    expect(await a).toEqual([]);
    expect(await s).toEqual([]);
  });

  it('song() prefers the exact title by that artist', async () => {
    const p = firstValueFrom(api.song('Ween', 'Ocean Man'));
    await gap();
    http
      .expectOne((r) => r.url === ITUNES_URL && r.params.get('term') === 'Ween Ocean Man')
      .flush({
        results: [
          {
            wrapperType: 'track',
            artistName: 'Someone Else',
            trackName: 'Ocean Man',
            previewUrl: 'no',
          },
          {
            wrapperType: 'track',
            artistName: 'Ween',
            trackName: 'Ocean Man (Live)',
            previewUrl: 'live',
          },
          {
            wrapperType: 'track',
            artistName: 'Ween',
            trackName: 'Ocean Man',
            previewUrl: 'yes',
            artworkUrl100: 'a/100x100bb.jpg',
          },
        ],
      });
    expect((await p)?.preview).toBe('yes');
  });

  it('bigger() rewrites the size segment only', () => {
    expect(bigger('https://x/y/100x100bb.jpg', 600)).toBe('https://x/y/600x600bb.jpg');
    expect(bigger(undefined)).toBe('');
  });
});
