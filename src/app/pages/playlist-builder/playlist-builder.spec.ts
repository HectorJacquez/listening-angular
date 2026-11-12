import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ItunesApi } from '../../data/enrichment/itunes-api';
import { encodePlaylist } from '../../data/playlist-codec';
import { PlaylistStore } from '../../data/playlist-store';
import { PlaylistBuilder } from './playlist-builder';

describe('PlaylistBuilder', () => {
  async function render(m?: string) {
    const itunes = {
      song: vi.fn(() =>
        of({
          title: 'Hahaha',
          album: 'Year Of The Snitch',
          art: 'art.jpg',
          preview: 'p.m4a',
          url: '',
          ms: 1,
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ItunesApi, useValue: itunes }],
    });
    const f = TestBed.createComponent(PlaylistBuilder);
    if (m) f.componentRef.setInput('m', m);
    await f.whenStable();
    return { f, store: TestBed.inject(PlaylistStore), c: f.componentInstance, itunes };
  }

  it('starts with a default name but will not share an empty list', async () => {
    const { f, c } = await render();
    expect(c.form.controls.name.value).toBe('Untitled Mixtape');
    expect(c.canShare).toBe(false);
    c.share();
    await f.whenStable();
    expect(c.shareUrl()).toBeNull();
  });

  it('refuses a cleared name', async () => {
    const { f, c, store } = await render();
    store.add({ key: 'a', title: 'A', artist: 'X', album: 'Y', duration: 200 });
    c.form.controls.name.setValue('');
    c.share();
    await f.whenStable();
    expect(c.shareUrl()).toBeNull();
    expect(f.nativeElement.querySelector('.err')?.textContent).toContain('3 to 60');
  });

  it('flags the list when it runs past the target length', async () => {
    const { f, c, store } = await render();
    c.form.controls.targetMinutes.setValue(5);
    store.add({ key: 'a', title: 'A', artist: 'X', album: 'Y', duration: 200 });
    store.add({ key: 'b', title: 'B', artist: 'X', album: 'Y', duration: 200 });
    await f.whenStable();
    expect(c.overBy()).toBe(100);
    expect(c.fill()).toBe(100);
    expect(f.nativeElement.querySelector('.length')?.textContent).toContain('over by 1:40');
  });

  it('makes a share link that carries the list, and drops it on the next edit', async () => {
    const { f, c, store } = await render();
    c.form.controls.name.setValue('late shift');
    store.add({
      key: 'a',
      title: 'Hahaha',
      artist: 'Death Grips',
      album: 'Year Of The Snitch',
      duration: 215,
    });
    await f.whenStable();
    c.share();
    const url = c.shareUrl() ?? '';
    expect(url).toContain('#/playlist?m=');
    expect(url.split('m=')[1]).toBe(encodePlaylist({ name: 'late shift', items: store.items() }));
    store.remove('a');
    await f.whenStable();
    expect(c.shareUrl()).toBeNull();
  });

  it('opening a shared link fills the list and fetches artwork for each track', async () => {
    const code = encodePlaylist({
      name: 'from a friend',
      items: [
        { artist: 'Death Grips', title: 'Hahaha', album: 'Year Of The Snitch', duration: 215 },
      ],
    });
    const { f, store, itunes } = await render(code);
    expect(store.name()).toBe('from a friend');
    expect(store.items()[0]).toMatchObject({ title: 'Hahaha', art: 'art.jpg', preview: 'p.m4a' });
    expect(itunes.song).toHaveBeenCalledWith('Death Grips', 'Hahaha');
    expect(f.nativeElement.querySelector('.art.skeleton')).toBeNull();
    expect(f.nativeElement.textContent).toContain('Opened from a shared link');
    expect(f.nativeElement.querySelector('.open a[href*="open.spotify.com"]')).not.toBeNull();
  });
});
