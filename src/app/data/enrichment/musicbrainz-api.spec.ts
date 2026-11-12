import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { MB_MIN_GAP_MS, MusicBrainzApi } from './musicbrainz-api';

describe('MusicBrainzApi', () => {
  let api: MusicBrainzApi;
  let http: HttpTestingController;
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(MusicBrainzApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('maps a search hit', async () => {
    const p = firstValueFrom(api.search('death grips'));
    await vi.advanceTimersByTimeAsync(0);
    const req = http.expectOne((r) => r.url.endsWith('/artist/'));
    expect(req.request.params.get('query')).toBe('artist:"death grips"');
    req.flush({
      artists: [
        {
          id: 'x',
          name: 'Death Grips',
          type: 'Group',
          country: 'US',
          score: 100,
          'life-span': { begin: '2010-12-21' },
        },
      ],
    });
    expect(await p).toEqual([
      {
        id: 'x',
        name: 'Death Grips',
        type: 'Group',
        country: 'US',
        disambiguation: '',
        begin: '2010-12-21',
        score: 100,
      },
    ]);
  });

  it('an abandoned query gives its slot back', async () => {
    const abandoned = api.search('the b').subscribe();
    abandoned.unsubscribe(); // user kept typing before the slot came up
    const p = firstValueFrom(api.search('the beatles'));
    await vi.advanceTimersByTimeAsync(0);
    http.expectOne((r) => r.params.get('query') === 'artist:"the beatles"').flush({ artists: [] });
    http.expectNone((r) => r.params.get('query') === 'artist:"the b"');
    expect(await p).toEqual([]);
  });

  it('retries once after a 503, a gap later', async () => {
    const p = firstValueFrom(api.search('x'));
    await vi.advanceTimersByTimeAsync(0);
    http
      .expectOne((r) => r.params.get('query') === 'artist:"x"')
      .flush('busy', { status: 503, statusText: 'Service Unavailable' });
    await vi.advanceTimersByTimeAsync(MB_MIN_GAP_MS);
    http.expectOne((r) => r.params.get('query') === 'artist:"x"').flush({ artists: [] });
    expect(await p).toEqual([]);
  });

  it('drops placeholder duplicates of the same name', async () => {
    const p = firstValueFrom(api.search('boards of canada'));
    await vi.advanceTimersByTimeAsync(0);
    http
      .expectOne((r) => r.url.endsWith('/artist/'))
      .flush({
        artists: [
          { id: 'real', name: 'Boards of Canada', score: 100 },
          {
            id: 'fake',
            name: 'Boards of Canada',
            score: 90,
            disambiguation: 'for fake releases and mistagged recordings',
          },
          { id: 'other', name: 'Boards of Canada', score: 80 },
        ],
      });
    expect((await p).map((h) => h.id)).toEqual(['real']);
  });

  it('maps a lookup: top tags, wikidata and homepage relations', async () => {
    const p = firstValueFrom(api.lookup('x'));
    await vi.advanceTimersByTimeAsync(0);
    http
      .expectOne((r) => r.url.endsWith('/artist/x'))
      .flush({
        id: 'x',
        name: 'Death Grips',
        country: 'US',
        area: { name: 'United States' },
        'begin-area': { name: 'Sacramento' },
        'life-span': { begin: '2010-12-21', end: null, ended: false },
        tags: [
          { name: 'hip hop', count: 10 },
          { name: 'experimental hip hop', count: 13 },
        ],
        relations: [
          { type: 'wikidata', url: { resource: 'https://www.wikidata.org/wiki/Q3020722' } },
          { type: 'official homepage', url: { resource: 'https://thirdworlds.net/' } },
        ],
      });
    const a = await p;
    expect(a.tags).toEqual(['experimental hip hop', 'hip hop']);
    expect(a.wikidata).toBe('https://www.wikidata.org/wiki/Q3020722');
    expect(a.homepage).toBe('https://thirdworlds.net/');
    expect(a.beginArea).toBe('Sacramento');
    expect(a.ended).toBe(false);
  });

  it('spaces distinct requests at least a second apart and caches repeats', async () => {
    const first = firstValueFrom(api.search('a'));
    const second = firstValueFrom(api.search('b'));
    const again = firstValueFrom(api.search('a'));
    await vi.advanceTimersByTimeAsync(0);
    http.expectOne((r) => r.params.get('query') === 'artist:"a"').flush({ artists: [] });
    http.expectNone((r) => r.params.get('query') === 'artist:"b"');
    await vi.advanceTimersByTimeAsync(MB_MIN_GAP_MS);
    http.expectOne((r) => r.params.get('query') === 'artist:"b"').flush({ artists: [] });
    expect(await first).toEqual([]);
    expect(await second).toEqual([]);
    expect(await again).toEqual([]);
  });
});
