import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MusicApi } from '../../data/music-api';
import { Play, primaryArtist } from '../../data/models';
import { PlaylistStore } from '../../data/playlist-store';
import { AgoPipe, CreditedPipe, MmssPipe, ThousandsPipe } from '../../shared/pipes';
import { StatCard } from '../../shared/stat-card';

type SortKey = 'playedAt' | 'title' | 'artist' | 'album' | 'duration';

@Component({
  selector: 'app-recent-plays',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, StatCard, AgoPipe, MmssPipe, CreditedPipe, ThousandsPipe],
  templateUrl: './recent-plays.html',
  styleUrl: './recent-plays.css',
})
export class RecentPlays {
  private readonly api = inject(MusicApi);
  readonly playlist = inject(PlaylistStore);

  readonly totals = toSignal(this.api.totals());
  private readonly plays = toSignal(this.api.recentPlays(), { initialValue: [] as Play[] });

  readonly filter = signal('');
  readonly sortKey = signal<SortKey>('playedAt');
  readonly sortDesc = signal(true);

  readonly rows = computed(() => {
    const q = this.filter().trim().toLowerCase();
    const key = this.sortKey();
    const dir = this.sortDesc() ? -1 : 1;
    const hit = (p: Play) =>
      !q || [p.title, p.artist, p.album].some((s) => s.toLowerCase().includes(q));
    return this.plays()
      .filter(hit)
      .sort((a, b) => compare(a[key], b[key]) * dir);
  });

  readonly shown = computed(() => this.rows().length);
  readonly loaded = computed(() => this.plays().length);

  onFilter(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDesc.update((desc) => !desc);
      return;
    }
    this.sortKey.set(key);
    this.sortDesc.set(key === 'playedAt' || key === 'duration');
  }

  artistLink(p: Play): string[] {
    return ['/artist', primaryArtist(p.artist)];
  }
}

function compare(x: string | number, y: string | number): number {
  return typeof x === 'number' && typeof y === 'number'
    ? x - y
    : String(x).localeCompare(String(y));
}
