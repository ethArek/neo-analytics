export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type CacheResult<T> = { kind: 'hit'; value: T } | { kind: 'miss' } | { kind: 'expired' };

export class TtlCache<T> {
  private cache: CacheEntry<T> | null = null;
  private promise: Promise<T> | null = null;

  get(): CacheResult<T> {
    if (!this.cache) {
      return { kind: 'miss' };
    }

    if (this.cache.expiresAt <= Date.now()) {
      return { kind: 'expired' };
    }

    return { kind: 'hit', value: this.cache.value };
  }

  getValue(): T | null {
    const result = this.get();
    return result.kind === 'hit' ? result.value : null;
  }

  getOptional(): T | undefined {
    const result = this.get();
    return result.kind === 'hit' ? result.value : undefined;
  }

  hasValue(): boolean {
    const result = this.get();
    return result.kind === 'hit';
  }

  getPromise(): Promise<T> | null {
    return this.promise;
  }

  setPromise(promise: Promise<T> | null): void {
    this.promise = promise;
  }

  set(value: T, ttlMs: number): void {
    this.cache = {
      value,
      expiresAt: Date.now() + ttlMs,
    };
  }

  clear(): void {
    this.cache = null;
    this.promise = null;
  }
}

export class TtlMapCache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly promises = new Map<string, Promise<T>>();

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      return null;
    }

    return entry.value;
  }

  getPromise(key: string): Promise<T> | null {
    return this.promises.get(key) ?? null;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  setPromise(key: string, promise: Promise<T>): void {
    this.promises.set(key, promise);
  }

  deletePromise(key: string): void {
    this.promises.delete(key);
  }

  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}
