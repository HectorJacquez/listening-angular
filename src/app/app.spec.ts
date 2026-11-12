import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { PlaylistStore } from './data/playlist-store';

describe('App shell', () => {
  it('shows the playlist count in the nav once something is added', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(App);
    await f.whenStable();
    expect(f.nativeElement.querySelector('.badge')).toBeNull();
    TestBed.inject(PlaylistStore).add({
      key: 'k',
      title: 't',
      artist: 'a',
      album: 'b',
      duration: 1,
    });
    await f.whenStable();
    expect(f.nativeElement.querySelector('.badge')?.textContent?.trim()).toBe('1');
  });
});
