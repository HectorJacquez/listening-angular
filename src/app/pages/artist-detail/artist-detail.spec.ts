import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ArtistEnrichment } from '../../data/enrichment/artist-enrichment';
import { MusicApi } from '../../data/music-api';
import { Artist } from '../../data/models';
import { PlaylistStore } from '../../data/playlist-store';
import { ArtistDetail } from './artist-detail';

const dg: Artist = {
  name: 'Death Grips',
  plays: 2780,
  tracks: 100,
  albums: 10,
  genre: 'experimental hip hop',
  topTracks: [
    {
      title: 'Hahaha',
      album: 'Year Of The Snitch',
      plays: 102,
      duration: 215,
      year: 2018,
      genre: '',
    },
    { title: 'Guillotine', album: 'Exmilitary', plays: 90, duration: 223, year: 2011, genre: '' },
  ],
};

describe('ArtistDetail', () => {
  async function render(name: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: MusicApi,
          useValue: {
            artist: (n: string) => of(n.toLowerCase() === 'death grips' ? dg : undefined),
          },
        },
        {
          provide: ArtistEnrichment,
          useValue: {
            enrich: () => ({
              facts$: of({
                status: 'ok',
                data: {
                  name: 'Death Grips',
                  country: 'US',
                  area: 'United States',
                  beginArea: 'Sacramento',
                  begin: '2010-12-21',
                  end: '',
                  ended: false,
                  tags: ['experimental hip hop'],
                },
              }),
              bio$: of({ status: 'error', reason: 'network' }),
              albums$: of({
                status: 'ok',
                data: [
                  {
                    name: 'The Money Store',
                    art: 'a.jpg',
                    year: 2012,
                    tracks: 13,
                    url: 'https://music.apple.com/x',
                    genre: '',
                  },
                ],
              }),
              songs$: of({
                status: 'ok',
                data: [
                  {
                    title: 'HAHAHA',
                    album: 'Year Of The Snitch',
                    art: 'b.jpg',
                    preview: 'https://p/hahaha.m4a',
                    url: '',
                    ms: 215000,
                  },
                ],
              }),
            }),
          },
        },
      ],
    });
    const f = TestBed.createComponent(ArtistDetail);
    f.componentRef.setInput('name', name);
    await f.whenStable();
    return f;
  }

  it('shows the stats and top tracks for a known artist', async () => {
    const f = await render('Death Grips');
    const text: string = f.nativeElement.textContent;
    expect(text).toContain('2,780');
    expect(text).toContain('experimental hip hop');
    expect(f.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
    expect(f.componentInstance.avgPlaysPerTrack()).toBe(28);
  });

  it('a lower-case URL still shows the canonical name', async () => {
    const f = await render('death grips');
    expect(f.nativeElement.querySelector('h2').textContent.trim()).toBe('Death Grips');
  });

  it('still renders an artist outside my history, from the live sources', async () => {
    const f = await render('Nobody');
    const text: string = f.nativeElement.textContent;
    expect(text).toContain('Not in my listening history');
    expect(text).toContain('Popular on iTunes');
    expect(text).toContain('The Money Store');
  });

  it('shows facts, reports a failed source, and attaches previews by title', async () => {
    const f = await render('Death Grips');
    expect(f.nativeElement.querySelector('h2').textContent.trim()).toBe('Death Grips');
    const text: string = f.nativeElement.textContent;
    expect(text).toContain('Sacramento, United States');
    expect(text).toContain('since 2010');
    expect(text).toContain('Wikipedia unavailable');
    expect(f.nativeElement.querySelectorAll('button.preview').length).toBe(1);
  });

  it('adds a track to the shared playlist and disables its button', async () => {
    const f = await render('Death Grips');
    const btn: HTMLButtonElement = f.nativeElement.querySelector('tbody tr .add');
    btn.click();
    await f.whenStable();
    const store = TestBed.inject(PlaylistStore);
    expect(store.items()[0]).toMatchObject({ title: 'Hahaha', artist: 'Death Grips' });
    expect(f.nativeElement.querySelector('tbody tr .add').disabled).toBe(true);
  });
});
