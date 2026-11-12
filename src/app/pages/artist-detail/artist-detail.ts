import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map, shareReplay, switchMap } from 'rxjs';
import { ArtistEnrichment } from '../../data/enrichment/artist-enrichment';
import { ItunesSong } from '../../data/enrichment/itunes-api';
import { LOADING, dataOf, track } from '../../data/enrichment/loaded';
import { norm, uniqueBy } from '../../data/matching';
import { MusicApi } from '../../data/music-api';
import { Track, primaryArtist } from '../../data/models';
import { PlaylistStore, playlistKey } from '../../data/playlist-store';
import { MmssPipe, ThousandsPipe } from '../../shared/pipes';
import { PreviewButton } from '../../shared/preview-button';
import { StatCard } from '../../shared/stat-card';

/** My play counts from the snapshot (missing for an artist found through search)
 *  next to live facts from MusicBrainz, Wikipedia and iTunes. */
@Component({
  selector: 'app-artist-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatCard, MmssPipe, ThousandsPipe, PreviewButton],
  templateUrl: './artist-detail.html',
  styleUrl: './artist-detail.css',
})
export class ArtistDetail {
  private readonly api = inject(MusicApi);
  private readonly enrichment = inject(ArtistEnrichment);
  readonly playlist = inject(PlaylistStore);

  readonly name = input.required<string>();
  private readonly name$ = toObservable(this.name);

  readonly mine = toSignal(
    this.name$.pipe(switchMap((name) => this.api.artist(name).pipe(track()))),
    { initialValue: LOADING },
  );
  readonly artist = computed(() => dataOf(this.mine()));

  readonly avgPlaysPerTrack = computed(() => {
    const a = this.artist();
    return a && a.tracks ? Math.round(a.plays / a.tracks) : 0;
  });

  private readonly enriched$ = this.name$.pipe(
    map((name) => this.enrichment.enrich(name)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  readonly facts = toSignal(this.enriched$.pipe(switchMap((e) => e.facts$)), {
    initialValue: LOADING,
  });
  readonly bio = toSignal(this.enriched$.pipe(switchMap((e) => e.bio$)), { initialValue: LOADING });
  readonly albums = toSignal(this.enriched$.pipe(switchMap((e) => e.albums$)), {
    initialValue: LOADING,
  });
  readonly songs = toSignal(this.enriched$.pipe(switchMap((e) => e.songs$)), {
    initialValue: LOADING,
  });

  private readonly mbArtist = computed(() => dataOf(this.facts()));
  private readonly songList = computed(() => dataOf(this.songs()) ?? []);
  readonly summary = computed(() => dataOf(this.bio()));
  readonly albumList = computed(() => dataOf(this.albums()) ?? []);
  readonly tags = computed(() => this.mbArtist()?.tags ?? []);
  readonly photo = computed(() => this.summary()?.thumbnail ?? this.artist()?.image ?? null);

  readonly displayName = computed(() => {
    const mine = this.artist();
    if (mine) return primaryArtist(mine.name);
    return this.mbArtist()?.name ?? this.name();
  });

  readonly years = computed(() => {
    const mb = this.mbArtist();
    if (!mb?.begin) return '';
    const began = mb.begin.slice(0, 4);
    return mb.ended ? `${began} to ${mb.end.slice(0, 4) || '?'}` : `since ${began}`;
  });

  readonly origin = computed(() => {
    const mb = this.mbArtist();
    if (!mb) return '';
    const places = [mb.beginArea, mb.area].filter((place) => place !== '');
    return uniqueBy(places, (place) => place).join(', ');
  });

  /** keyed by title, to attach previews to my own track list */
  private readonly previewByTitle = computed(() => {
    const byTitle = new Map<string, ItunesSong>();
    for (const song of uniqueBy(this.songList(), (s) => norm(s.title))) {
      byTitle.set(norm(song.title), song);
    }
    return byTitle;
  });

  readonly popular = computed(() => {
    if (this.artist()) return [];
    return uniqueBy(this.songList(), (s) => norm(s.title)).slice(0, 12);
  });

  preview(track: Track): ItunesSong | undefined {
    return this.previewByTitle().get(norm(track.title));
  }

  key(artist: string, track: { album: string; title: string }): string {
    return playlistKey({ artist, album: track.album, title: track.title });
  }

  add(artist: string, track: Track | ItunesSong): void {
    const song = 'preview' in track ? track : this.preview(track);
    this.playlist.add({
      key: this.key(artist, track),
      title: track.title,
      artist,
      album: track.album,
      duration: 'duration' in track ? track.duration : track.ms / 1000,
      art: song?.art ?? null,
      preview: song?.preview ?? null,
    });
  }
}
