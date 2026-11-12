import { Injectable, computed, signal } from '@angular/core';
import { Play, primaryArtist } from './models';

export interface PlaylistItem {
  key: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  /** iTunes artwork: undefined = not looked up yet, null = looked up and none */
  art?: string | null;
  preview?: string | null;
}

export function playlistKey(t: { artist: string; album: string; title: string }): string {
  return `${t.artist}|${t.album}|${t.title}`;
}

/** Kept in memory only. Sharing goes through the URL. */
@Injectable({ providedIn: 'root' })
export class PlaylistStore {
  readonly name = signal('Untitled Mixtape');
  readonly items = signal<PlaylistItem[]>([]);
  readonly count = computed(() => this.items().length);
  readonly totalSeconds = computed(() => this.items().reduce((s, i) => s + i.duration, 0));
  private readonly keys = computed(() => new Set(this.items().map((i) => i.key)));

  has(key: string): boolean {
    return this.keys().has(key);
  }

  addPlay(p: Play): void {
    this.add({
      key: p.id,
      title: p.title,
      artist: primaryArtist(p.artist),
      album: p.album,
      duration: p.duration,
    });
  }

  add(item: PlaylistItem): void {
    if (this.items().some((i) => i.key === item.key)) return;
    this.items.update((list) => [...list, item]);
  }

  patch(key: string, extra: Partial<PlaylistItem>): void {
    this.items.update((list) => list.map((i) => (i.key === key ? { ...i, ...extra } : i)));
  }

  replace(name: string, items: PlaylistItem[]): void {
    this.name.set(name);
    this.items.set(items);
  }

  remove(key: string): void {
    this.items.update((list) => list.filter((i) => i.key !== key));
  }

  move(key: string, delta: -1 | 1): void {
    this.items.update((list) => {
      const i = list.findIndex((x) => x.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  clear(): void {
    this.items.set([]);
  }
}
