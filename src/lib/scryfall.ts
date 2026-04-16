import {
  createAsyncQueue,
  delay,
  MIN_MS_BETWEEN_SCRYFALL_REQUESTS,
  parseRetryAfterMs,
  scryfallFetchHeaders,
} from "@/lib/scryfall-rate-limit";

export type ScryfallCard = {
  id: string;
  name: string;
  mana_cost: string | null;
  cmc: number;
  type_line: string;
  color_identity: string[];
  oracle_text?: string;
};

type CacheRecord = {
  fetchedAt: number;
  card: ScryfallCard;
};

const STORAGE_KEY = "scry:scryfall-cache:v1";

let memoryCache: Map<string, CacheRecord> | null = null;

const enqueueScryfall = createAsyncQueue();

function getMemoryCache() {
  if (!memoryCache) memoryCache = new Map();
  return memoryCache;
}

function normalizeKey(name: string) {
  return name.trim().toLowerCase();
}

function readStorage(): Record<string, CacheRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CacheRecord>;
  } catch {
    return {};
  }
}

function writeStorage(next: Record<string, CacheRecord>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / privacy errors
  }
}

export function getCachedCardByName(name: string): ScryfallCard | null {
  const key = normalizeKey(name);
  const mem = getMemoryCache().get(key);
  if (mem) return mem.card;

  const store = readStorage();
  const rec = store[key];
  if (!rec) return null;
  getMemoryCache().set(key, rec);
  return rec.card;
}

function cardFromScryfallJson(json: any): ScryfallCard {
  return {
    id: String(json.id),
    name: String(json.name),
    mana_cost: json.mana_cost ? String(json.mana_cost) : null,
    cmc: Number(json.cmc ?? 0),
    type_line: String(json.type_line ?? ""),
    color_identity: Array.isArray(json.color_identity)
      ? json.color_identity.map((c: unknown) => String(c))
      : [],
    oracle_text: json.oracle_text ? String(json.oracle_text) : undefined,
  };
}

function persistCache(requestedName: string, card: ScryfallCard) {
  const rec: CacheRecord = { fetchedAt: Date.now(), card };
  const requestedKey = normalizeKey(requestedName);
  const canonicalKey = normalizeKey(card.name);
  getMemoryCache().set(requestedKey, rec);
  if (requestedKey !== canonicalKey) {
    getMemoryCache().set(canonicalKey, rec);
  }

  const store = readStorage();
  store[requestedKey] = rec;
  if (requestedKey !== canonicalKey) {
    store[canonicalKey] = rec;
  }
  writeStorage(store);
}

function headersForFetchUrl(url: string): HeadersInit {
  if (typeof window !== "undefined" && url.startsWith("/api")) {
    return { Accept: "application/json" };
  }
  return scryfallFetchHeaders();
}

async function fetchCardPayload(url: string): Promise<{
  ok: boolean;
  status: number;
  text: string;
  retryAfter: string | null;
}> {
  const res = await fetch(url, {
    method: "GET",
    headers: headersForFetchUrl(url),
    cache: "no-store",
  });
  const text = await res.text().catch(() => "");
  return {
    ok: res.ok,
    status: res.status,
    text,
    retryAfter: res.headers.get("Retry-After"),
  };
}

export async function fetchCardByNameFuzzy(name: string): Promise<ScryfallCard> {
  const cached = getCachedCardByName(name);
  if (cached) return cached;

  return enqueueScryfall(async () => {
    await delay(MIN_MS_BETWEEN_SCRYFALL_REQUESTS);

    const useProxy = typeof window !== "undefined";
    const url = useProxy
      ? `/api/scryfall/card?fuzzy=${encodeURIComponent(name)}`
      : `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`;

    let payload = await fetchCardPayload(url);

    if (payload.status === 429) {
      const retryMs = Math.max(
        parseRetryAfterMs(payload.retryAfter) ?? 60_000,
        60_000
      );
      await delay(retryMs);
      await delay(MIN_MS_BETWEEN_SCRYFALL_REQUESTS);
      payload = await fetchCardPayload(url);
    }

    if (!payload.ok) {
      let detail = payload.text || String(payload.status);
      try {
        const errJson = JSON.parse(payload.text) as {
          details?: string;
          error?: string;
        };
        if (errJson?.details) detail = errJson.details;
        else if (errJson?.error) detail = errJson.error;
      } catch {
        // keep detail
      }
      throw new Error(`Scryfall fetch failed (${payload.status}): ${detail}`);
    }

    let json: any;
    try {
      json = JSON.parse(payload.text);
    } catch {
      throw new Error("Scryfall returned invalid JSON.");
    }

    const card = cardFromScryfallJson(json);
    persistCache(name, card);

    return card;
  });
}
