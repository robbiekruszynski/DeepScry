import type { ScryfallCard } from "@/lib/scryfall";

export type DeckEntry = {
  card: ScryfallCard;
  count: number;
};

export type Deck = {
  entries: DeckEntry[];
  commanderName?: string;
};

export type ParsedLine = {
  name: string;
  count: number;
  raw: string;
};

export function parseDecklist(text: string): {
  lines: ParsedLine[];
  errors: string[];
} {
  const errors: string[] = [];
  const lines: ParsedLine[] = [];

  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const raw of rawLines) {
    if (raw.startsWith("#") || raw.startsWith("//")) continue;
    if (/^(sideboard|maybeboard)\b/i.test(raw)) continue;

    const m = raw.match(/^(\d+)\s+(.+)$/);
    const count = m ? Number(m[1]) : 1;
    const name = (m ? m[2] : raw).trim();

    if (!name) {
      errors.push(`Could not parse line: "${raw}"`);
      continue;
    }
    if (!Number.isFinite(count) || count <= 0) {
      errors.push(`Invalid count on line: "${raw}"`);
      continue;
    }

    lines.push({ name, count, raw });
  }

  if (lines.length === 0) errors.push("No card lines found.");

  return { lines, errors };
}

export function buildEntries(cardsByName: Map<string, ScryfallCard>, parsed: ParsedLine[]): DeckEntry[] {
  const merged = new Map<string, { card: ScryfallCard; count: number }>();

  for (const line of parsed) {
    const card = cardsByName.get(line.name);
    if (!card) continue;
    const prev = merged.get(card.id);
    if (prev) prev.count += line.count;
    else merged.set(card.id, { card, count: line.count });
  }

  return Array.from(merged.values())
    .sort((a, b) => a.card.name.localeCompare(b.card.name))
    .map((x) => ({ card: x.card, count: x.count }));
}

export function expandDeck(deck: Deck): ScryfallCard[] {
  const out: ScryfallCard[] = [];
  for (const e of deck.entries) {
    for (let i = 0; i < e.count; i++) out.push(e.card);
  }
  return out;
}

