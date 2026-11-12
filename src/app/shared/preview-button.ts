import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PreviewPlayer } from './preview-player';

@Component({
  selector: 'app-preview-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (url(); as u) {
      <span class="wrap" [class.on]="playing()">
        <button
          type="button"
          class="preview"
          (click)="player.toggle(u)"
          [title]="playing() ? 'stop' : '30-second preview from iTunes'"
          [attr.aria-label]="playing() ? 'stop preview' : 'play 30 second preview'"
        >
          {{ playing() ? '■' : '▶' }}
        </button>
        <span class="clock" aria-live="polite">{{ playing() ? clock() : '30s' }}</span>
      </span>
    }
  `,
  styles: `
    .wrap {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .preview {
      width: 2rem;
      height: 2rem;
      padding: 0;
      border-radius: 50%;
      font-size: 0.75rem;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .on .preview {
      background: var(--accent);
      color: #0b1406;
      border-color: transparent;
    }
    .clock {
      font-family: var(--mono);
      font-size: 0.68rem;
      color: var(--ink-faint);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .on .clock {
      color: var(--accent);
    }
  `,
})
export class PreviewButton {
  readonly player = inject(PreviewPlayer);
  readonly url = input<string | null | undefined>();
  readonly playing = computed(() => !!this.url() && this.player.current() === this.url());
  readonly clock = computed(
    () => `${mmss(this.player.position())} / ${mmss(this.player.length())}`,
  );
}

function mmss(s: number): string {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
