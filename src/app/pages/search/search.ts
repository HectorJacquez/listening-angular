import {
  ChangeDetectionStrategy,
  Component,
  InjectionToken,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { Loaded, dataOf, track } from '../../data/enrichment/loaded';
import { loose, norm } from '../../data/matching';
import { MbArtistHit, MusicBrainzApi } from '../../data/enrichment/musicbrainz-api';
import { MusicApi } from '../../data/music-api';
import { Artist, primaryArtist } from '../../data/models';
import { ThousandsPipe } from '../../shared/pipes';

/** A token so tests can set it to 0. */
export const SEARCH_DEBOUNCE_MS = new InjectionToken<number>('SEARCH_DEBOUNCE_MS', {
  providedIn: 'root',
  factory: () => 350,
});

const MIN_QUERY_LENGTH = 2;
const NOTHING: Loaded<MbArtistHit[]> = { status: 'empty' };

@Component({
  selector: 'app-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ThousandsPipe],
  templateUrl: './search.html',
  styleUrl: './search.css',
})
export class Search {
  private readonly mb = inject(MusicBrainzApi);
  private readonly api = inject(MusicApi);
  private readonly debounce = inject(SEARCH_DEBOUNCE_MS);

  readonly query = signal('');
  readonly idle = computed(() => this.query().trim().length < MIN_QUERY_LENGTH);

  readonly results = toSignal(
    toObservable(this.query).pipe(
      map((q) => q.trim()),
      debounceTime(this.debounce),
      distinctUntilChanged(),
      // switchMap unsubscribes from the previous search, so only the newest can answer
      switchMap((q) =>
        q.length < MIN_QUERY_LENGTH ? of(NOTHING) : this.mb.search(q).pipe(track()),
      ),
    ),
    { initialValue: NOTHING },
  );
  readonly hits = computed(() => dataOf(this.results()) ?? []);

  private readonly mine = toSignal(this.api.artists(), { initialValue: [] as Artist[] });
  private readonly playsByName = computed(() => {
    const exact = new Map<string, number>();
    const lax = new Map<string, number>();
    for (const a of this.mine()) {
      exact.set(norm(primaryArtist(a.name)), a.plays);
      lax.set(loose(primaryArtist(a.name)), a.plays);
    }
    return { exact, lax };
  });

  onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  myPlays(hit: MbArtistHit): number | undefined {
    const { exact, lax } = this.playsByName();
    return exact.get(norm(hit.name)) ?? lax.get(loose(hit.name));
  }

  /** "Group · GB · 1960 · rock band", leaving out whatever MusicBrainz lacks. */
  describe(hit: MbArtistHit): string {
    return [hit.type, hit.country, hit.begin.slice(0, 4), hit.disambiguation]
      .filter((part) => part !== '')
      .join(' · ');
  }
}
