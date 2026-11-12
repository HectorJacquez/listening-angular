import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { WIKIDATA_URL, WIKI_URL, WikipediaApi, qidFrom } from './wikipedia-api';

describe('WikipediaApi', () => {
  let api: WikipediaApi;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(WikipediaApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('goes Wikidata -> enwiki title -> summary', async () => {
    const p = firstValueFrom(api.byWikidata('Q1'));
    http
      .expectOne(`${WIKIDATA_URL}/Q1.json`)
      .flush({ entities: { Q1: { sitelinks: { enwiki: { title: 'Death Grips' } } } } });
    http.expectOne(`${WIKI_URL}/Death_Grips`).flush({
      type: 'standard',
      title: 'Death Grips',
      extract: 'An American band.',
      thumbnail: { source: 'pic' },
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Death_Grips' } },
    });
    expect(await p).toEqual({
      title: 'Death Grips',
      extract: 'An American band.',
      thumbnail: 'pic',
      url: 'https://en.wikipedia.org/wiki/Death_Grips',
    });
  });

  it('treats a disambiguation page as no article', async () => {
    const p = firstValueFrom(api.byTitle('Katamari'));
    http
      .expectOne(`${WIKI_URL}/Katamari`)
      .flush({ type: 'disambiguation', title: 'Katamari', extract: '' });
    expect(await p).toBeNull();
  });

  it('qidFrom reads the id off a Wikidata URL', () => {
    expect(qidFrom('https://www.wikidata.org/wiki/Q3020722')).toBe('Q3020722');
    expect(qidFrom(null)).toBeNull();
  });
});
