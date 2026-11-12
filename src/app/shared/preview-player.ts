import { Injectable, signal } from '@angular/core';

/** One <audio> for the whole app, so two previews never play at once. */
@Injectable({ providedIn: 'root' })
export class PreviewPlayer {
  readonly current = signal<string | null>(null);
  /** seconds into the clip, for the countdown next to the active button */
  readonly position = signal(0);
  readonly length = signal(30);
  private audio: HTMLAudioElement | null = null;

  toggle(url: string): void {
    if (this.current() === url) {
      this.stop();
      return;
    }
    const a = this.element();
    a.src = url;
    this.position.set(0);
    void a.play().catch(() => this.current.set(null));
    this.current.set(url);
  }

  stop(): void {
    this.audio?.pause();
    this.current.set(null);
    this.position.set(0);
  }

  private element(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'none';
      this.audio.addEventListener('ended', () => this.stop());
      this.audio.addEventListener('error', () => this.stop());
      this.audio.addEventListener('timeupdate', () =>
        this.position.set(this.audio?.currentTime ?? 0),
      );
      this.audio.addEventListener('durationchange', () => {
        const d = this.audio?.duration;
        if (d && Number.isFinite(d)) this.length.set(Math.round(d));
      });
    }
    return this.audio;
  }
}
