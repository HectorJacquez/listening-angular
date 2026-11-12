import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MusicApi } from '../../data/music-api';
import { Artist, primaryArtist } from '../../data/models';
import { CreditedPipe, ThousandsPipe } from '../../shared/pipes';

@Component({
  selector: 'app-artists',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CreditedPipe, ThousandsPipe],
  templateUrl: './artists.html',
  styleUrl: './artists.css',
})
export class Artists {
  private readonly api = inject(MusicApi);

  readonly all = toSignal(this.api.topArtists(), { initialValue: [] as Artist[] });
  readonly filter = signal('');
  readonly rows = computed(() => {
    const q = this.filter().trim().toLowerCase();
    return this.all().filter((a) => !q || a.name.toLowerCase().includes(q));
  });

  onFilter(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  credited(a: Artist): string {
    return primaryArtist(a.name);
  }

  /** Position in the full list, so a filtered view keeps the real ranking. */
  rank(a: Artist): number {
    return this.all().indexOf(a) + 1;
  }
}
