import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ItunesApi } from '../../data/enrichment/itunes-api';
import { decodePlaylist, encodePlaylist } from '../../data/playlist-codec';
import { PlaylistItem, PlaylistStore, playlistKey } from '../../data/playlist-store';
import { MmssPipe } from '../../shared/pipes';
import { PreviewButton } from '../../shared/preview-button';

@Component({
  selector: 'app-playlist-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, MmssPipe, PreviewButton],
  templateUrl: './playlist-builder.html',
  styleUrl: './playlist-builder.css',
})
export class PlaylistBuilder {
  readonly store = inject(PlaylistStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly itunes = inject(ItunesApi);
  private readonly router = inject(Router);

  /** `?m=<code>` from the share link, bound by the router. */
  readonly m = input<string>();

  readonly form = new FormGroup({
    name: new FormControl(this.store.name(), {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(60)],
    }),
    targetMinutes: new FormControl(45, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(5), Validators.max(600)],
    }),
  });

  readonly targetMinutes = signal(this.form.controls.targetMinutes.value);
  readonly overBy = computed(() => this.store.totalSeconds() - this.targetMinutes() * 60);
  readonly fill = computed(() => {
    const targetSeconds = this.targetMinutes() * 60 || 1;
    return Math.min(100, Math.round((this.store.totalSeconds() / targetSeconds) * 100));
  });

  readonly shareUrl = signal<string | null>(null);
  readonly copied = signal(false);
  readonly fromLink = signal(false);

  constructor() {
    this.form.controls.targetMinutes.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((v) => this.targetMinutes.set(Number(v) || 0));
    this.form.controls.name.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((v) => this.store.name.set(v));
    // a share link in the URL replaces whatever was being built
    effect(() => {
      const code = this.m();
      if (!code) return;
      untracked(() => this.hydrate(code));
    });
    // any edit invalidates a link made earlier
    effect(() => {
      this.store.items();
      this.store.name();
      untracked(() => {
        this.shareUrl.set(null);
        this.copied.set(false);
      });
    });
  }

  get canShare(): boolean {
    return this.form.valid && this.store.count() > 0;
  }

  share(): void {
    if (!this.canShare) {
      this.form.markAllAsTouched();
      return;
    }
    const code = encodePlaylist({ name: this.form.controls.name.value, items: this.store.items() });
    const tree = this.router.createUrlTree(['/playlist'], { queryParams: { m: code } });
    const base = location.href.split('#')[0];
    this.shareUrl.set(`${base}#${this.router.serializeUrl(tree)}`);
  }

  /** navigator.clipboard only exists on https and localhost, so plain http
   *  falls back to execCommand. */
  async copy(field: HTMLInputElement): Promise<void> {
    const url = this.shareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
      return;
    } catch {
      /* fall through */
    }
    field.focus();
    field.select();
    this.copied.set(document.execCommand('copy'));
  }

  private hydrate(code: string): void {
    const shared = decodePlaylist(code);
    if (!shared) return;
    const items: PlaylistItem[] = shared.items.map((i) => ({ ...i, key: playlistKey(i) }));
    this.store.replace(shared.name, items);
    this.form.controls.name.setValue(shared.name, { emitEvent: false });
    this.fromLink.set(true);
    for (const i of items) this.decorate(i);
  }

  decorate(i: PlaylistItem): void {
    if (i.art !== undefined) return; // undefined = not looked up yet; null = looked up, none
    this.itunes
      .song(i.artist, i.title)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => this.store.patch(i.key, { art: s?.art ?? null, preview: s?.preview ?? null }),
        error: () => this.store.patch(i.key, { art: null, preview: null }),
      });
  }

  openIn(service: 'spotify' | 'apple' | 'youtube', i: PlaylistItem): string {
    const q = encodeURIComponent(`${i.artist} ${i.title}`);
    switch (service) {
      case 'spotify':
        return `https://open.spotify.com/search/${q}`;
      case 'apple':
        return `https://music.apple.com/us/search?term=${q}`;
      case 'youtube':
        return `https://music.youtube.com/search?q=${q}`;
    }
  }

  showError(name: 'name' | 'targetMinutes'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }
}
