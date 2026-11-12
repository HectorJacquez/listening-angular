import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stat">
      <div class="stat-value">{{ value() }}</div>
      <div class="stat-label">{{ label() }}</div>
      @if (note()) {
        <div class="stat-note">{{ note() }}</div>
      }
    </div>
  `,
  styles: `
    .stat {
      background: var(--bg-raise);
      border-radius: var(--radius-sm);
      padding: 1rem 1.15rem;
      min-width: 0;
    }
    @media (max-width: 640px) {
      .stat {
        padding: 0.75rem 0.85rem;
      }
      .stat-value {
        font-size: 1.35rem;
      }
    }
    .stat-value {
      font-family: var(--display);
      font-size: 1.65rem;
      font-weight: 650;
      letter-spacing: -0.01em;
      font-variant-numeric: tabular-nums;
    }
    .stat-label {
      color: var(--ink-dim);
      font-size: 0.78rem;
    }
    .stat-note {
      color: var(--ink-faint);
      font-size: 0.74rem;
      margin-top: 0.35rem;
    }
  `,
})
export class StatCard {
  readonly value = input.required<string | number>();
  readonly label = input.required<string>();
  readonly note = input<string>();
}
