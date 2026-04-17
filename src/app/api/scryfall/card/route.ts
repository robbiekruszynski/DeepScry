import { NextRequest, NextResponse } from "next/server";

import {
  createAsyncQueue,
  delay,
  MIN_MS_BETWEEN_SCRYFALL_REQUESTS,
  parseRetryAfterMs,
  scryfallFetchHeaders,
} from "@/lib/scryfall-rate-limit";

const enqueue = createAsyncQueue();

async function fetchFromScryfall(url: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: scryfallFetchHeaders(),
    cache: "no-store",
  });
  const text = await res.text();
  return { res, text };
}

export async function GET(req: NextRequest) {
  const fuzzy = req.nextUrl.searchParams.get("fuzzy")?.trim();
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!fuzzy && !id) {
    return NextResponse.json(
      { error: "Missing fuzzy or id query parameter." },
      { status: 400 }
    );
  }

  return enqueue(async () => {
    await delay(MIN_MS_BETWEEN_SCRYFALL_REQUESTS);

    const url = id
      ? `https://api.scryfall.com/cards/${encodeURIComponent(id)}`
      : `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(fuzzy!)}`;
    let { res, text } = await fetchFromScryfall(url);

    if (res.status === 429) {
      const retryMs = Math.max(
        parseRetryAfterMs(res.headers.get("Retry-After")) ?? 60_000,
        60_000
      );
      await delay(retryMs);
      await delay(MIN_MS_BETWEEN_SCRYFALL_REQUESTS);
      ({ res, text } = await fetchFromScryfall(url));
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: text || res.statusText, status: res.status, details: text },
        { status: res.status }
      );
    }

    try {
      const json = JSON.parse(text) as unknown;
      return NextResponse.json(json);
    } catch {
      return NextResponse.json({ error: "Invalid JSON from Scryfall" }, { status: 502 });
    }
  });
}
