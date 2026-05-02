import { NextRequest, NextResponse } from "next/server";

function commanderToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type EdhrecCard = {
  name: string;
  sanitized: string;
  num_decks: number;
  potential_decks: number;
  inclusion: number; // percentage 0-100
  synergy: number;   // synergy score (-1 to 1)
  price: number | null;
};

export type EdhrecResponse = {
  commander: string;
  slug: string;
  cards: EdhrecCard[];
  error?: string;
};

export async function GET(req: NextRequest) {
  const commander = req.nextUrl.searchParams.get("commander");
  if (!commander) {
    return NextResponse.json({ error: "Missing commander parameter" }, { status: 400 });
  }

  const slug = commanderToSlug(commander);
  const url = `https://json.edhrec.com/pages/commanders/${slug}.json`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "DeepScry/1.0 (MTG deck analysis app)" },
      next: { revalidate: 3600 }, // cache 1 hour
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `EDHREC returned ${res.status} for "${commander}"`, cards: [] },
        { status: 200 } // return 200 so client can fall back gracefully
      );
    }

    const json = await res.json() as Record<string, unknown>;

    // EDHREC JSON structure: container.json_dict.cardlist
    const cardlist = (
      (json?.container as Record<string, unknown>)?.json_dict as Record<string, unknown>
    )?.cardlist as unknown[] | undefined;

    if (!Array.isArray(cardlist)) {
      return NextResponse.json({ error: "Unexpected EDHREC response shape", cards: [] }, { status: 200 });
    }

    const cards: EdhrecCard[] = cardlist
      .map((raw: unknown) => {
        const c = raw as Record<string, unknown>;
        const name = String(c.name ?? "");
        if (!name) return null;
        return {
          name,
          sanitized: String(c.sanitized ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
          num_decks: Number(c.num_decks ?? 0),
          potential_decks: Number(c.potential_decks ?? 0),
          inclusion: Number(c.inclusion ?? 0),
          synergy: Number(c.synergy ?? 0),
          price: c.price != null ? Number(c.price) : null,
        } satisfies EdhrecCard;
      })
      .filter((c): c is EdhrecCard => c !== null);

    return NextResponse.json({ commander, slug, cards } satisfies EdhrecResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, cards: [] }, { status: 200 });
  }
}
