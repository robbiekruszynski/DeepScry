"use client";

import * as React from "react";

import type { CardTagMap, Deck } from "@/lib/deck";
import { expandDeck } from "@/lib/deck";
import { hypergeometricAtLeast } from "@/lib/analysis";
import { isBoardWipe, isTutor, mulliganAdvice } from "@/lib/commander-tools";
import { isInteraction, isLand, isRamp } from "@/lib/stats";
import type { ScryfallCard } from "@/lib/scryfall";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const CARD_BACK_URL = "https://cards.scryfall.io/back.jpg";
const IMAGE_FETCH_DELAY_MS = 90;
const HAND_CARD_ASPECT = "5 / 7";
const imageUrlCache = new Map<string, string>();
let imageFetchQueue = Promise.resolve();

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function verdictForHand(cards: ScryfallCard[]) {
  const lands = cards.filter(isLand).length;
  if (lands >= 2 && lands <= 4) return "Keep";
  if (lands <= 1 || lands >= 6) return "Mulligan";
  return "Risky";
}

function isPermanent(card: ScryfallCard) {
  return /\b(Artifact|Battle|Creature|Enchantment|Land|Planeswalker)\b/i.test(card.type_line);
}

function normalizeImageKey(name: string) {
  return name.trim().toLowerCase();
}

function cardImageFromImport(card: ScryfallCard) {
  return card.image_url_large || card.image_url || null;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCardImageUrl(cardName: string): Promise<string> {
  const key = normalizeImageKey(cardName);
  const cached = imageUrlCache.get(key);
  if (cached) return cached;

  const task = imageFetchQueue.then(async () => {
    await delay(IMAGE_FETCH_DELAY_MS);
    try {
      const res = await fetch(
        `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`,
        { headers: { Accept: "application/json" }, cache: "force-cache" }
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      const faceImage =
        Array.isArray(json.card_faces) && json.card_faces.length > 0
          ? json.card_faces.find((f: { image_uris?: { normal?: string } }) => f?.image_uris?.normal)
              ?.image_uris?.normal
          : undefined;
      const url = json?.image_uris?.normal ?? faceImage ?? CARD_BACK_URL;
      imageUrlCache.set(key, String(url));
      return String(url);
    } catch {
      imageUrlCache.set(key, CARD_BACK_URL);
      return CARD_BACK_URL;
    }
  });

  imageFetchQueue = task.then(() => undefined, () => undefined);
  return task;
}

const COLOR_LABELS: Record<string, string> = {
  W: "W",
  U: "U",
  B: "B",
  R: "R",
  G: "G",
};

function deckColorIdentity(deck: Deck): Set<string> {
  const colors = new Set<string>();
  if (deck.commanderName) {
    const commander = deck.entries.find(
      (e) => e.card.name.toLowerCase() === deck.commanderName!.toLowerCase()
    );
    for (const c of commander?.card.color_identity ?? []) {
      if (c !== "C") colors.add(c);
    }
  }
  if (colors.size === 0) {
    for (const entry of deck.entries) {
      for (const c of entry.card.color_identity) {
        if (c !== "C") colors.add(c);
      }
    }
  }
  return colors;
}

function manaColorsFromCard(card: ScryfallCard): string[] {
  const colors = new Set<string>();
  if (isLand(card)) {
    for (const c of card.color_identity) {
      if (c !== "C") colors.add(c);
    }
    return [...colors];
  }
  const text = (card.oracle_text ?? "").toLowerCase();
  if (/\badd\b/.test(text) || text.includes("any color") || text.includes("chosen color")) {
    if (text.includes("{w}") || text.includes("white mana")) colors.add("W");
    if (text.includes("{u}") || text.includes("blue mana")) colors.add("U");
    if (text.includes("{b}") || text.includes("black mana")) colors.add("B");
    if (text.includes("{r}") || text.includes("red mana")) colors.add("R");
    if (text.includes("{g}") || text.includes("green mana")) colors.add("G");
    if (colors.size === 0 && card.color_identity.length) {
      for (const c of card.color_identity) {
        if (c !== "C") colors.add(c);
      }
    }
  }
  return [...colors];
}

function StatTile({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${valueClassName ?? ""}`}>{value}</div>
    </div>
  );
}

function verdictBannerClass(verdict: ReturnType<typeof verdictForHand>) {
  if (verdict === "Keep") {
    return "border-emerald-500/50 bg-emerald-500/20 text-emerald-950 dark:text-emerald-50";
  }
  if (verdict === "Mulligan") {
    return "border-red-500/50 bg-red-500/20 text-red-950 dark:text-red-50";
  }
  return "border-amber-500/50 bg-amber-500/20 text-amber-950 dark:text-amber-50";
}

export function HandTab({
  deck,
  tagMap,
  onGoToImport,
}: {
  deck: Deck | null;
  tagMap: CardTagMap;
  onGoToImport?: () => void;
}) {
  const fullDeck = React.useMemo(() => {
    if (!deck) return [];
    const expanded = expandDeck(deck);
    if (!deck.commanderName) return expanded;
    const commanderIdx = expanded.findIndex(
      (c) => c.name.toLowerCase() === deck.commanderName!.toLowerCase()
    );
    if (commanderIdx < 0) return expanded;
    return [...expanded.slice(0, commanderIdx), ...expanded.slice(commanderIdx + 1)];
  }, [deck]);

  const [hand, setHand] = React.useState<ScryfallCard[]>([]);
  const [imageStates, setImageStates] = React.useState<
    Record<string, { url: string; loading: boolean }>
  >({});
  const [keepRate, setKeepRate] = React.useState<number | null>(null);
  const [keepRateLoading, setKeepRateLoading] = React.useState(false);
  const [hoveredCard, setHoveredCard] = React.useState<ScryfallCard | null>(null);

  const drawHand = React.useCallback(
    (size: number) => {
      const shuffled = shuffle(fullDeck);
      const count = Math.min(size, shuffled.length);
      setHand(shuffled.slice(0, count));
    },
    [fullDeck]
  );

  React.useEffect(() => {
    if (fullDeck.length === 0) {
      setHand([]);
      return;
    }
    drawHand(7);
  }, [fullDeck, drawHand]);

  React.useEffect(() => {
    setHoveredCard(null);
  }, [hand]);

  React.useEffect(() => {
    let cancelled = false;
    const unique = Array.from(new Map(hand.map((c) => [normalizeImageKey(c.name), c])).values());

    for (const card of unique) {
      const key = normalizeImageKey(card.name);
      const cached = imageUrlCache.get(key);
      if (cached) {
        setImageStates((prev) => ({ ...prev, [key]: { url: cached, loading: false } }));
        continue;
      }
      const imported = cardImageFromImport(card);
      if (imported) {
        imageUrlCache.set(key, imported);
        setImageStates((prev) => ({ ...prev, [key]: { url: imported, loading: false } }));
        continue;
      }
      setImageStates((prev) => ({ ...prev, [key]: { url: CARD_BACK_URL, loading: true } }));
      void fetchCardImageUrl(card.name).then((url) => {
        if (cancelled) return;
        setImageStates((prev) => ({ ...prev, [key]: { url, loading: false } }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [hand]);

  React.useEffect(() => {
    if (fullDeck.length === 0) {
      setKeepRate(null);
      setKeepRateLoading(false);
      return;
    }

    setKeepRateLoading(true);
    setKeepRate(null);

    const timer = window.setTimeout(() => {
      let keepable = 0;
      const simulations = 1000;
      for (let i = 0; i < simulations; i++) {
        const shuffled = shuffle(fullDeck);
        const opening = shuffled.slice(0, Math.min(7, shuffled.length));
        const verdict = verdictForHand(opening);
        if (verdict === "Keep" || verdict === "Risky") keepable++;
      }
      setKeepRate((keepable / simulations) * 100);
      setKeepRateLoading(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fullDeck]);

  const imageUrl = (card: ScryfallCard) =>
    imageStates[normalizeImageKey(card.name)]?.url ?? CARD_BACK_URL;

  const previewImageUrl = (card: ScryfallCard) =>
    card.image_url_large || card.image_url || imageUrl(card);

  if (!deck || fullDeck.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Import a deck to simulate opening hands
          </p>
          <Button onClick={() => onGoToImport?.()} disabled={!onGoToImport}>
            Go to Import →
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (hand.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">Drawing opening hand…</p>
        </CardContent>
      </Card>
    );
  }

  const verdict = verdictForHand(hand);
  const advice = mulliganAdvice(hand, deck.archetype ?? "midrange", tagMap);
  const landCount = hand.filter(isLand).length;
  const nonLands = hand.filter((c) => !isLand(c));
  const lowestCmc =
    nonLands.length > 0 ? Math.min(...nonLands.map((c) => c.cmc)) : null;
  const avgCmc =
    hand.length > 0 ? hand.reduce((sum, c) => sum + c.cmc, 0) / hand.length : 0;

  const deckColors = deckColorIdentity(deck);
  const colorsInHand = new Set<string>();
  for (const card of hand) {
    if (isLand(card) || isPermanent(card)) {
      for (const c of manaColorsFromCard(card)) colorsInHand.add(c);
    }
  }
  const colorCoverage =
    deckColors.size === 0
      ? "—"
      : [...deckColors]
          .map((c) => (colorsInHand.has(c) ? COLOR_LABELS[c] ?? c : `—${COLOR_LABELS[c] ?? c}`))
          .join(" ");

  const deckSize = fullDeck.length;
  const landsInDeck = fullDeck.filter(isLand).length;
  const cardsSeenByTurn3 = Math.min(deckSize, 10);
  const landsByTurn3Pct =
    deckSize > 0
      ? hypergeometricAtLeast(deckSize, landsInDeck, cardsSeenByTurn3, 3) * 100
      : 0;

  const openingHandSize = Math.min(7, deckSize);
  const openerOdds = (matchCount: number) =>
    deckSize > 0 && matchCount > 0
      ? hypergeometricAtLeast(deckSize, matchCount, openingHandSize, 1) * 100
      : 0;

  const tutorCount = fullDeck.filter(isTutor).length;
  const boardWipeCount = fullDeck.filter(isBoardWipe).length;
  const rampCountInDeck = fullDeck.filter(isRamp).length;
  const interactionCountInDeck = fullDeck.filter(isInteraction).length;

  const landCountClass =
    landCount <= 1
      ? "text-red-600 dark:text-red-400"
      : landCount >= 2 && landCount <= 4
        ? "text-emerald-600 dark:text-emerald-400"
        : "";

  return (
    <div className="space-y-6">
      {/* A) Verdict banner */}
      <div
        className={`rounded-xl border-2 px-6 py-8 text-center ${verdictBannerClass(verdict)}`}
      >
        <div className="text-sm font-medium uppercase tracking-widest opacity-80">Opening hand</div>
        <div className="mt-2 text-4xl font-bold tracking-tight">{verdict}</div>
      </div>

      {/* B) Hand display + hover preview */}
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <div className="grid gap-4 xl:grid-cols-[1fr_minmax(220px,260px)]">
          <div className="w-full min-w-0">
            <div className="grid w-full grid-cols-7 gap-1 sm:gap-1.5 md:gap-2">
              {hand.map((card, idx) => {
                const isHovered = hoveredCard === card;
                return (
                  <div
                    key={`${card.id}-${idx}`}
                    role="button"
                    tabIndex={0}
                    className={`min-w-0 cursor-pointer overflow-hidden rounded-md border bg-card shadow-md transition hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/50 sm:rounded-lg ${
                      isHovered
                        ? "border-primary ring-2 ring-primary"
                        : "border-border"
                    }`}
                    style={{ aspectRatio: HAND_CARD_ASPECT }}
                    onMouseEnter={() => setHoveredCard(card)}
                    onFocus={() => setHoveredCard(card)}
                  >
                    <img
                      src={imageUrl(card)}
                      alt={card.name}
                      className="h-full w-full object-cover"
                      draggable={false}
                      onError={(e) => {
                        e.currentTarget.src = CARD_BACK_URL;
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-lg border bg-muted/30 p-2 shadow-sm backdrop-blur-sm"
            aria-live="polite"
          >
            {hoveredCard ? (
              <div className="space-y-2">
                <img
                  src={previewImageUrl(hoveredCard)}
                  alt={hoveredCard.name}
                  className="mx-auto h-auto max-h-[min(420px,55vh)] w-auto rounded-md border object-contain"
                  draggable={false}
                  onError={(e) => {
                    e.currentTarget.src = CARD_BACK_URL;
                  }}
                />
                <div className="text-sm font-medium">{hoveredCard.name}</div>
                <div className="text-xs text-muted-foreground">{hoveredCard.type_line}</div>
                {hoveredCard.scryfall_uri ? (
                  <a
                    href={hoveredCard.scryfall_uri}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline-offset-2 hover:underline"
                  >
                    View on Scryfall
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-[160px] items-center justify-center px-2 text-center text-xs text-muted-foreground xl:min-h-[200px]">
                Hover a card in your hand to preview it.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* C) Hand stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Lands in hand"
          value={landCount}
          valueClassName={landCountClass}
        />
        <StatTile
          label="Lowest CMC (non-land)"
          value={lowestCmc !== null ? lowestCmc : "—"}
        />
        <StatTile label="Color coverage" value={colorCoverage} valueClassName="text-base" />
        <StatTile label="Average CMC of hand" value={avgCmc.toFixed(2)} />
      </div>

      {/* D) Probability insights */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Odds of 3 lands by turn 3"
          value={`${landsByTurn3Pct.toFixed(1)}%`}
        />
        <StatTile
          label="Simulated keep rate"
          value={
            keepRateLoading
              ? "Simulating…"
              : keepRate !== null
                ? `${keepRate.toFixed(1)}% of opening hands are keepable with this deck`
                : "—"
          }
          valueClassName="text-sm font-medium leading-snug"
        />
        <StatTile
          label={`Tutor in opening 7 (${tutorCount} in deck)`}
          value={
            tutorCount > 0 ? `${openerOdds(tutorCount).toFixed(1)}%` : "No tutors detected"
          }
        />
        <StatTile
          label={`Board wipe in opening 7 (${boardWipeCount} in deck)`}
          value={
            boardWipeCount > 0
              ? `${openerOdds(boardWipeCount).toFixed(1)}%`
              : "No mass removal detected"
          }
        />
        <StatTile
          label={`Ramp in opening 7 (${rampCountInDeck} in deck)`}
          value={
            rampCountInDeck > 0
              ? `${openerOdds(rampCountInDeck).toFixed(1)}%`
              : "No ramp detected"
          }
        />
        <StatTile
          label={`Interaction in opening 7 (${interactionCountInDeck} in deck)`}
          value={
            interactionCountInDeck > 0
              ? `${openerOdds(interactionCountInDeck).toFixed(1)}%`
              : "No interaction detected"
          }
        />
      </div>

      {/* E) Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => drawHand(7)}>
          Draw New Hand
        </Button>
        <Button type="button" variant="secondary" onClick={() => drawHand(6)}>
          Mulligan to 6
        </Button>
        <Button type="button" variant="secondary" onClick={() => drawHand(5)}>
          Mulligan to 5
        </Button>
      </div>

      {/* F) Mulligan advice */}
      <p className="text-sm italic text-muted-foreground">{advice.reasons.join(" ")}</p>
    </div>
  );
}
