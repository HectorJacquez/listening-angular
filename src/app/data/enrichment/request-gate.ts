import { Observable, defer, retry, shareReplay, throwError, timer } from 'rxjs';

/** Queues calls to one API: one at a time with a minimum gap, cached per key,
 *  retried when the server says it is busy (429, 503, or 403 from iTunes). */
export class RequestGate {
  private readonly cache = new Map<string, Observable<unknown>>();
  private nextSlot = 0;

  constructor(
    readonly minGapMs: number,
    private readonly busyStatuses: readonly number[] = [429, 503],
    private readonly maxRetries = 2,
  ) {}

  run<T>(key: string, make: () => Observable<T>): Observable<T> {
    if (!this.cache.has(key)) {
      const gated = new Observable<T>((sub) => {
        const now = Date.now();
        const at = Math.max(now, this.nextSlot);
        this.nextSlot = at + this.minGapMs;
        let fired = false;
        let inner: { unsubscribe(): void } | undefined;
        const t = setTimeout(() => {
          fired = true;
          inner = defer(make).pipe(this.retryWhenBusy<T>()).subscribe(sub);
        }, at - now);
        return () => {
          clearTimeout(t);
          inner?.unsubscribe();
          if (!fired) this.nextSlot = Math.max(Date.now(), this.nextSlot - this.minGapMs);
        };
      }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
      this.cache.set(key, gated);
    }
    return this.cache.get(key) as Observable<T>;
  }

  private retryWhenBusy<T>() {
    return retry<T>({
      count: this.maxRetries,
      delay: (err: BusyError, attempt: number) => {
        if (!this.busyStatuses.includes(err?.status ?? 0)) return throwError(() => err);
        const retryAfter = Number(err.headers?.get?.('Retry-After'));
        const wait =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : this.minGapMs * attempt;
        // push the whole queue back too, so the next request does not land in the same window
        this.nextSlot = Math.max(this.nextSlot, Date.now() + wait + this.minGapMs);
        return timer(wait);
      },
    });
  }
}

interface BusyError {
  status?: number;
  headers?: { get?(name: string): string | null };
}
