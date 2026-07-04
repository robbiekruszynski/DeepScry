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
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: scryfallFetchHeaders(),
      cache: "no-store",
    });
    const text = await res.text();
    return { res, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      res: {
        ok: false,
        status: 503,
        statusText: "Scryfall unavailable",
        headers: new Headers(),
      } as Response,
      text: `Unable to reach Scryfall. Check your internet connection and try again. (${message})`,
    };
  }
}

async function retryAfterBackoff(attempt: number) {
  await delay(MIN_MS_BETWEEN_SCRYFALL_REQUESTS * (attempt + 2));
}

export async function GET(req: NextRequest) {
  const fuzzy = req.nextUrl.searchParams.get("fuzzy")?.trim();
  const id = req.nextUrl.searchParams.get("id")?.trim();
  const commander = req.nextUrl.searchParams.get("commander")?.trim();
  const search = req.nextUrl.searchParams.get("search")?.trim();
  const prints = req.nextUrl.searchParams.get("prints")?.trim();
  const page = req.nextUrl.searchParams.get("page")?.trim();
  if (!fuzzy && !id && !commander && !search && !prints) {
    return NextResponse.json(
      { error: "Missing fuzzy, id, commander, search, or prints query parameter." },
      { status: 400 }
    );
  }

  return enqueue(async () => {
    await delay(MIN_MS_BETWEEN_SCRYFALL_REQUESTS);

    const url = id
      ? `https://api.scryfall.com/cards/${encodeURIComponent(id)}`
      : prints
        ? `https://api.scryfall.com/cards/search?unique=prints&q=${encodeURIComponent(`!"${prints}"`)}${page ? `&page=${encodeURIComponent(page)}` : ""}`
        : commander
        ? `https://api.scryfall.com/cards/search?unique=cards&order=edhrec&q=${encodeURIComponent(`name:${commander} is:commander`)}`
        : search
          ? `https://api.scryfall.com/cards/search?unique=cards&order=edhrec&q=${encodeURIComponent(search)}`
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

    for (let attempt = 0; !res.ok && res.status >= 500 && attempt < 2; attempt++) {
      await retryAfterBackoff(attempt);
      ({ res, text } = await fetchFromScryfall(url));
    }

    if (!res.ok) {
      if ((commander || search || prints) && res.status === 404) {
        return NextResponse.json({ data: [] });
      }
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
