import { Observable, catchError, map, of, startWith } from 'rxjs';

/** The four states an outside source can be in. */
export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'ok'; data: T }
  | { status: 'empty' }
  | { status: 'error'; reason: string };

export const LOADING: Loaded<never> = { status: 'loading' };

export function track<T>(
  empty: (v: T | null | undefined) => boolean = (v) =>
    v == null || (Array.isArray(v) && v.length === 0),
) {
  return (source: Observable<T | null | undefined>): Observable<Loaded<T>> =>
    source.pipe(
      map((data): Loaded<T> =>
        empty(data) ? { status: 'empty' } : { status: 'ok', data: data as T },
      ),
      startWith(LOADING as Loaded<T>),
      catchError((err: unknown) => of<Loaded<T>>({ status: 'error', reason: describe(err) })),
    );
}

function describe(err: unknown): string {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: number }).status;
    return status === 0 ? 'network' : `http ${status}`;
  }
  return 'failed';
}

export function dataOf<T>(loaded: Loaded<T>): T | null {
  return loaded.status === 'ok' ? loaded.data : null;
}
