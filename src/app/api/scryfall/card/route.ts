import { NextRequest, NextResponse } from "next/server";

let lastRequestAt = 0;
let throttleChain: Promise<void> = Promise.resolve();

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function throttleScryfallRequest() {
  const previous = throttleChain;
  let release = () => {};
  throttleChain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const elapsed = Date.now() - lastRequestAt;
  const waitFor = Math.max(0, 100 - elapsed);
  if (waitFor > 0) await delay(waitFor);
  lastRequestAt = Date.now();
  release();
}

/**
 * Proxies Scryfall so the browser never calls api.scryfall.com directly
 * (avoids CORS / adblock / mixed-content issues in local dev).
 */
export async function GET(req: NextRequest) {
  const fuzzy = req.nextUrl.searchParams.get("fuzzy")?.trim();
  if (!fuzzy) {
    return NextResponse.json({ error: "Missing fuzzy query parameter." }, { status: 400 });
  }

  await throttleScryfallRequest();

  const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(fuzzy)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      { error: text || res.statusText, status: res.status },
      { status: res.status }
    );
  }

  try {
    const json = JSON.parse(text) as unknown;
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ error: "Invalid JSON from Scryfall" }, { status: 502 });
  }
}
