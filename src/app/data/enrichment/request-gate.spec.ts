import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { RequestGate } from './request-gate';

describe('RequestGate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('spaces distinct requests by the gap and caches repeats', async () => {
    const g = new RequestGate(1000);
    const calls: string[] = [];
    const make = (k: string) => () => {
      calls.push(k);
      return of(k);
    };
    const a = firstValueFrom(g.run('a', make('a')));
    const b = firstValueFrom(g.run('b', make('b')));
    const again = firstValueFrom(g.run('a', make('a')));
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(['a']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toEqual(['a', 'b']);
    expect(await Promise.all([a, b, again])).toEqual(['a', 'b', 'a']);
    expect(calls.length).toBe(2);
  });

  it('an abandoned booking gives its slot back', async () => {
    const g = new RequestGate(1000);
    const calls: string[] = [];
    g.run('typing', () => {
      calls.push('typing');
      return of(1);
    })
      .subscribe()
      .unsubscribe();
    const p = firstValueFrom(
      g.run('final', () => {
        calls.push('final');
        return of(2);
      }),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(['final']);
    expect(await p).toBe(2);
  });

  it('retries a busy answer after Retry-After and pushes the queue back', async () => {
    const g = new RequestGate(1000, [429]);
    let n = 0;
    const p = firstValueFrom(
      g.run('x', () =>
        ++n === 1
          ? throwError(() => ({
              status: 429,
              headers: { get: (h: string) => (h === 'Retry-After' ? '3' : null) },
            }))
          : of('ok'),
      ),
    );
    const q = firstValueFrom(g.run('y', () => of('y')));
    await vi.advanceTimersByTimeAsync(0);
    expect(n).toBe(1);
    await vi.advanceTimersByTimeAsync(2999);
    expect(n).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(n).toBe(2);
    expect(await p).toBe('ok');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await q).toBe('y');
  });

  it('does not retry an ordinary failure', async () => {
    const g = new RequestGate(10, [429]);
    let n = 0;
    const p = firstValueFrom(
      g.run('x', () => {
        n++;
        return throwError(() => ({ status: 404 }));
      }),
    );
    p.catch(() => undefined); // the rejection is expected; keep it from being reported as unhandled
    await vi.advanceTimersByTimeAsync(0);
    await expect(p).rejects.toEqual({ status: 404 });
    expect(n).toBe(1);
  });

  it('shares one in-flight request between concurrent subscribers', async () => {
    const g = new RequestGate(10);
    const src = new Subject<number>();
    let made = 0;
    const a = firstValueFrom(
      g.run('k', () => {
        made++;
        return src;
      }),
    );
    const b = firstValueFrom(
      g.run('k', () => {
        made++;
        return src;
      }),
    );
    await vi.advanceTimersByTimeAsync(0);
    src.next(7);
    src.complete();
    expect(await Promise.all([a, b])).toEqual([7, 7]);
    expect(made).toBe(1);
  });
});
