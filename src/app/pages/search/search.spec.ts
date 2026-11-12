import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { MusicBrainzApi } from '../../data/enrichment/musicbrainz-api';
import { MusicApi } from '../../data/music-api';
import { SEARCH_DEBOUNCE_MS, Search } from './search';

describe('Search', () => {
  async function render() {
    const calls: { q: string; out: Subject<unknown[]> }[] = [];
    const mb = {
      search: vi.fn((q: string) => {
        const out = new Subject<unknown[]>();
        calls.push({ q, out });
        return out;
      }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SEARCH_DEBOUNCE_MS, useValue: 0 },
        { provide: MusicBrainzApi, useValue: mb },
        {
          provide: MusicApi,
          useValue: {
            artists: () =>
              of([
                {
                  name: 'Death Grips',
                  plays: 2780,
                  tracks: 1,
                  albums: 1,
                  genre: null,
                  topTracks: [],
                },
              ]),
          },
        },
      ],
    });
    const f = TestBed.createComponent(Search);
    await f.whenStable();
    return { f, c: f.componentInstance, calls };
  }
  const tick = () => new Promise((r) => setTimeout(r, 5));
  // a fixed wait was too short on a busy CI runner
  const searches = (calls: unknown[], n: number) => vi.waitFor(() => expect(calls.length).toBe(n));

  it('does not search for one character', async () => {
    const { c, calls } = await render();
    c.query.set('d');
    await tick();
    expect(calls.length).toBe(0);
  });

  it('a newer query wins even when the older response lands later', async () => {
    const { f, c, calls } = await render();
    c.query.set('death');
    await searches(calls, 1);
    c.query.set('death grips');
    await searches(calls, 2);
    expect(calls.map((x) => x.q)).toEqual(['death', 'death grips']);
    calls[1].out.next([
      {
        id: 'x',
        name: 'Death Grips',
        type: 'Group',
        country: 'US',
        disambiguation: '',
        begin: '2010',
        score: 100,
      },
    ]);
    calls[1].out.complete();
    calls[0].out.next([
      { id: 'late', name: 'Stale', type: '', country: '', disambiguation: '', begin: '', score: 1 },
    ]);
    calls[0].out.complete();
    await f.whenStable();
    const text: string = f.nativeElement.textContent;
    expect(text).toContain('Death Grips');
    expect(text).not.toContain('Stale');
    expect(text).toContain('2,780 plays by me');
  });

  it('shows an error line when MusicBrainz fails', async () => {
    const { f, c, calls } = await render();
    c.query.set('boards');
    await searches(calls, 1);
    calls[0].out.error({ status: 503 });
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('not answering');
  });
});
