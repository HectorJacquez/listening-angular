import { Pipe, PipeTransform } from '@angular/core';
import { primaryArtist } from '../data/models';

/** 211.7 -> "3:31" */
@Pipe({ name: 'mmss' })
export class MmssPipe implements PipeTransform {
  transform(seconds: number | null | undefined): string {
    const s = Math.round(seconds ?? 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}

/** unix seconds -> "4 min ago", relative to an injectable "now" so tests are stable. */
@Pipe({ name: 'ago' })
export class AgoPipe implements PipeTransform {
  transform(unix: number, now: number = Date.now() / 1000): string {
    const d = Math.max(0, now - unix);
    if (d < 60) return 'just now';
    if (d < 3600) return `${Math.floor(d / 60)} min ago`;
    if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
    const days = Math.floor(d / 86400);
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }
}

@Pipe({ name: 'credited' })
export class CreditedPipe implements PipeTransform {
  transform(tag: string): string {
    return primaryArtist(tag);
  }
}

/** 233504 -> "233,504" without dragging in locale data. */
@Pipe({ name: 'thousands' })
export class ThousandsPipe implements PipeTransform {
  transform(n: number | null | undefined): string {
    return (n ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}
