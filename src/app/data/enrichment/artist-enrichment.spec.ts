import { TestBed } from '@angular/core/testing';
import { firstValueFrom, lastValueFrom, of, throwError } from 'rxjs';
import { ArtistEnrichment } from './artist-enrichment';
import { ItunesApi } from './itunes-api';
import { MusicBrainzApi } from './musicbrainz-api';
import { WikipediaApi } from './wikipedia-api';

describe('ArtistEnrichment', () => {
  function setup(overrides: { mbSearch?: unknown; wiki?: unknown }) {
    const mb = {
      search: vi.fn(
        () =>
          overrides.mbSearch ??
          of([
            { id: 'x', name: 'Death Grips' },
            { id: 'y', name: 'Death Grip' },
          ]),
      ),
      lookup: vi.fn(() =>
        of({
          id: 'x',
          name: 'Death Grips',
          wikidata: 'https://www.wikidata.org/wiki/Q1',
          wikipedia: null,
          tags: [],
        }),
      ),
    };
    const wiki = {
      byWikidata: vi.fn(
        () =>
          overrides.wiki ?? of({ title: 'Death Grips', extract: 'bio', thumbnail: null, url: '' }),
      ),
      byTitle: vi.fn(() => of(null)),
    };
    const itunes = {
      albums: vi.fn(() => of([])),
      songs: vi.fn(() => throwError(() => ({ status: 0 }))),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: MusicBrainzApi, useValue: mb },
        { provide: WikipediaApi, useValue: wiki },
        { provide: ItunesApi, useValue: itunes },
      ],
    });
    return { e: TestBed.inject(ArtistEnrichment).enrich('death grips'), mb, wiki };
  }

  it('each source resolves to its own state; one failing does not touch the others', async () => {
    const { e, mb, wiki } = setup({});
    expect(await firstValueFrom(e.facts$)).toEqual({ status: 'loading' });
    expect((await lastValueFrom(e.facts$)).status).toBe('ok');
    expect((await lastValueFrom(e.bio$)).status).toBe('ok');
    expect(await lastValueFrom(e.albums$)).toEqual({ status: 'empty' });
    expect(await lastValueFrom(e.songs$)).toEqual({ status: 'error', reason: 'network' });
    expect(mb.lookup).toHaveBeenCalledWith('x');
    expect(wiki.byWikidata).toHaveBeenCalledWith('Q1');
  });

  it('shows no facts rather than a near miss with a different name', async () => {
    const { e, mb } = setup({ mbSearch: of([{ id: 'y', name: 'Death Grip' }]) });
    expect(await lastValueFrom(e.facts$)).toEqual({ status: 'empty' });
    expect(mb.lookup).not.toHaveBeenCalled();
  });

  it('falls back to a title lookup when MusicBrainz has no match', async () => {
    const { e, wiki } = setup({ mbSearch: of([]) });
    expect(await lastValueFrom(e.facts$)).toEqual({ status: 'empty' });
    await lastValueFrom(e.bio$);
    expect(wiki.byTitle).toHaveBeenCalledWith('death grips');
  });
});
