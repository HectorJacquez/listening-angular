import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MusicApi } from '../../data/music-api';
import { Play } from '../../data/models';
import { RecentPlays } from './recent-plays';

const plays: Play[] = [
  {
    id: '1',
    playedAt: 300,
    title: 'Unity',
    artist: 'Katamari',
    album: 'Beautiful',
    duration: 345,
    year: 0,
    genre: '',
  },
  {
    id: '2',
    playedAt: 200,
    title: 'lostplanet',
    artist: 'harunemuri;Haru Nemuri',
    album: 'harutosyura',
    duration: 161,
    year: 2018,
    genre: '',
  },
  {
    id: '3',
    playedAt: 100,
    title: 'Hahaha',
    artist: 'Death Grips',
    album: 'Year Of The Snitch',
    duration: 215,
    year: 2018,
    genre: '',
  },
];

describe('RecentPlays', () => {
  async function render() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: MusicApi,
          useValue: {
            totals: () =>
              of({ plays: 7, hours: 1, tracks: 3, artists: 3, albums: 3, libraryHours: 1 }),
            recentPlays: () => of(plays),
          },
        },
      ],
    });
    const f = TestBed.createComponent(RecentPlays);
    await f.whenStable();
    return f;
  }
  const titles = (el: HTMLElement) =>
    [...el.querySelectorAll('tbody tr td:nth-child(2)')].map((td) => td.textContent?.trim());

  it('lists plays newest first with the credited artist only', async () => {
    const f = await render();
    expect(titles(f.nativeElement)).toEqual(['Unity', 'lostplanet', 'Hahaha']);
    expect(f.nativeElement.textContent).toContain('harunemuri');
    expect(f.nativeElement.textContent).not.toContain('Haru Nemuri');
  });

  it('filters across title, artist and album', async () => {
    const f = await render();
    f.componentInstance.filter.set('snitch');
    await f.whenStable();
    expect(titles(f.nativeElement)).toEqual(['Hahaha']);
    expect(f.nativeElement.querySelector('.count')?.textContent).toContain('1 of 3');
  });

  it('sorts by a column and flips direction on the second click', async () => {
    const f = await render();
    f.componentInstance.sortBy('duration');
    await f.whenStable();
    expect(titles(f.nativeElement)).toEqual(['Unity', 'Hahaha', 'lostplanet']);
    f.componentInstance.sortBy('duration');
    await f.whenStable();
    expect(titles(f.nativeElement)).toEqual(['lostplanet', 'Hahaha', 'Unity']);
  });

  it('shows the totals strip', async () => {
    const f = await render();
    expect(f.nativeElement.querySelectorAll('app-stat-card').length).toBe(4);
  });
});
