export const MIN_MS_BETWEEN_SCRYFALL_REQUESTS = 120;

const SCRYFALL_UA =
  "Scry/0.1 (https://github.com/robbiekruszynski/Scry; deck analyzer)";

export function scryfallFetchHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    "User-Agent": SCRYFALL_UA,
  };
}

export function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function createAsyncQueue() {
  let chain: Promise<void> = Promise.resolve();

  return function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(() => fn());
    chain = run.then(
      () => {},
      () => {}
    );
    return run;
  };
}

export function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const n = Number(header.trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n * 1000;
}
