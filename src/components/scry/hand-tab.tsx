"use client";

import * as React from "react";

import type { CardTagMap, Deck } from "@/lib/deck";
import { expandDeck } from "@/lib/deck";
import { mulliganAdvice } from "@/lib/commander-tools";
import { isLand } from "@/lib/stats";
import type { ScryfallCard } from "@/lib/scryfall";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CARD_BACK_URL = "https://cards.scryfall.io/back.jpg";
const IMAGE_FETCH_DELAY_MS = 90;
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
  return /\b(Artifact|Battle|Creature|Enchantment|Land|Planeswalker)\b/i.test(
    card.type_line
  );
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
      if (!res.ok) throw new Error(`Scryfall image lookup failed: ${res.status}`);

      const json = await res.json();
      const faceImage =
        Array.isArray(json.card_faces) && json.card_faces.length > 0
          ? json.card_faces.find((face: any) => face?.image_uris?.normal)?.image_uris
              ?.normal
          : undefined;
      const url = json?.image_uris?.normal ?? faceImage ?? CARD_BACK_URL;
      imageUrlCache.set(key, String(url));
      return String(url);
    } catch {
      imageUrlCache.set(key, CARD_BACK_URL);
      return CARD_BACK_URL;
    }
  });

  imageFetchQueue = task.then(
    () => undefined,
    () => undefined
  );

  return task;
}

export function HandTab({
  deck,
  tagMap,
}: {
  deck: Deck;
  tagMap: CardTagMap;
}) {
  const fullDeck = React.useMemo(() => {
    const expanded = expandDeck(deck);
    if (!deck.commanderName) return expanded;

    const commanderIdx = expanded.findIndex(
      (c) => c.name.toLowerCase() === deck.commanderName!.toLowerCase()
    );
    if (commanderIdx < 0) return expanded;

    return [...expanded.slice(0, commanderIdx), ...expanded.slice(commanderIdx + 1)];
  }, [deck]);
  const [library, setLibrary] = React.useState<ScryfallCard[]>([]);
  const [hand, setHand] = React.useState<ScryfallCard[]>([]);
  const [handSize, setHandSize] = React.useState(7);
  const [hoveredCard, setHoveredCard] = React.useState<ScryfallCard | null>(null);
  const [imageStates, setImageStates] = React.useState<
    Record<string, { url: string; loading: boolean }>
  >({});
  const [battlefield, setBattlefield] = React.useState<ScryfallCard[]>([]);
  const [graveyard, setGraveyard] = React.useState<ScryfallCard[]>([]);
  const [turn, setTurn] = React.useState(1);
  const [landPlayedThisTurn, setLandPlayedThisTurn] = React.useState(false);
  const [manaSpentThisTurn, setManaSpentThisTurn] = React.useState(0);

  const resetFieldTest = React.useCallback(() => {
    setBattlefield([]);
    setGraveyard([]);
    setTurn(1);
    setLandPlayedThisTurn(false);
    setManaSpentThisTurn(0);
  }, []);

  const newHand = React.useCallback(
    (size = handSize) => {
      const shuffled = shuffle(fullDeck);
      setLibrary(shuffled.slice(size));
      setHand(shuffled.slice(0, size));
      setHoveredCard(shuffled[0] ?? null);
      resetFieldTest();
    },
    [fullDeck, handSize, resetFieldTest]
  );

  React.useEffect(() => {
    const start = Math.min(7, fullDeck.length);
    setHandSize(start);
    const shuffled = shuffle(fullDeck);
    setLibrary(shuffled.slice(start));
    setHand(shuffled.slice(0, start));
    setHoveredCard(shuffled[0] ?? null);
    resetFieldTest();
  }, [fullDeck, resetFieldTest]);

  React.useEffect(() => {
    let cancelled = false;
    const uniqueHandCards = Array.from(
      new Map(hand.map((card) => [normalizeImageKey(card.name), card])).values()
    );

    for (const card of uniqueHandCards) {
      const key = normalizeImageKey(card.name);
      const cached = imageUrlCache.get(key);
      if (cached) {
        setImageStates((prev) => ({
          ...prev,
          [key]: { url: cached, loading: false },
        }));
        continue;
      }

      const importedImage = cardImageFromImport(card);
      if (importedImage) {
        imageUrlCache.set(key, importedImage);
        setImageStates((prev) => ({
          ...prev,
          [key]: { url: importedImage, loading: false },
        }));
        continue;
      }

      setImageStates((prev) => ({
        ...prev,
        [key]: { url: CARD_BACK_URL, loading: true },
      }));

      void fetchCardImageUrl(card.name).then((url) => {
        if (cancelled) return;
        setImageStates((prev) => ({
          ...prev,
          [key]: { url, loading: false },
        }));
      });
    }

    return () => {
      cancelled = true;
    };
  }, [hand]);

  const drawCard = () => {
    if (!library.length) return;
    setHand((h) => [...h, library[0]!]);
    setLibrary((lib) => lib.slice(1));
  };

  const nextTurn = () => {
    setTurn((t) => t + 1);
    setLandPlayedThisTurn(false);
    setManaSpentThisTurn(0);
    drawCard();
  };

  const moveHandCard = (idx: number, destination: "battlefield" | "graveyard") => {
    const card = hand[idx];
    if (!card) return;

    setHand((current) => {
      if (current[idx]?.id !== card.id) return current;
      return [...current.slice(0, idx), ...current.slice(idx + 1)];
    });

    if (destination === "battlefield") setBattlefield((zone) => [...zone, card]);
    else setGraveyard((zone) => [...zone, card]);
  };

  const playLand = (idx: number) => {
    const card = hand[idx];
    if (!card || !isLand(card) || landPlayedThisTurn) return;
    moveHandCard(idx, "battlefield");
    setLandPlayedThisTurn(true);
  };

  const castCard = (idx: number) => {
    const card = hand[idx];
    if (!card || isLand(card)) return;
    const manaValue = Math.max(0, Math.ceil(card.cmc));
    const landsInPlay = battlefield.filter(isLand).length;
    const manaAvailable = Math.max(0, landsInPlay - manaSpentThisTurn);
    if (manaValue > manaAvailable) return;
    setManaSpentThisTurn((spent) => spent + manaValue);
    moveHandCard(idx, isPermanent(card) ? "battlefield" : "graveyard");
  };

  const mulligan = () => {
    const next = Math.max(0, handSize - 1);
    setHandSize(next);
    newHand(next);
  };

  const baselineVerdict = verdictForHand(hand);
  const advice = mulliganAdvice(hand, deck.archetype ?? "midrange", tagMap);
  const landCount = hand.filter(isLand).length;
  const landsInPlay = battlefield.filter(isLand).length;
  const manaAvailable = Math.max(0, landsInPlay - manaSpentThisTurn);
  const getImageState = React.useCallback(
    (card: ScryfallCard | null) =>
      card ? imageStates[normalizeImageKey(card.name)] : undefined,
    [imageStates]
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => newHand()}>New hand</Button>
        <Button variant="secondary" onClick={mulligan} disabled={handSize <= 0}>
          Mulligan ({Math.max(0, handSize - 1)})
        </Button>
        <Button variant="outline" onClick={drawCard} disabled={!library.length}>
          Draw a card
        </Button>
        <Badge variant={advice.verdict === "Keep" ? "default" : "secondary"}>
          Verdict: {advice.verdict}
        </Badge>
        <Badge variant="secondary">Lands: {landCount}</Badge>
        <Badge variant="outline">Baseline: {baselineVerdict}</Badge>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mulligan assistant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="text-muted-foreground">
            Archetype: <span className="text-foreground capitalize">{deck.archetype ?? "midrange"}</span>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {advice.reasons.map((r, i) => (
              <li key={`${r}-${i}`}>{r}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Opening hand spread</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="pb-2">
              <div className="flex flex-wrap items-end justify-center gap-2 px-1 py-3">
                {hand.map((card, idx) => {
                  const center = (hand.length - 1) / 2;
                  const offsetFromCenter = idx - center;
                  const angle = offsetFromCenter * 1.4;
                  const lift = Math.min(Math.abs(offsetFromCenter) * 1.5, 8);
                  const imageState = getImageState(card);
                  const imageUrl = imageState?.url ?? CARD_BACK_URL;

                  return (
                    <div
                      key={`${card.id}-${idx}`}
                      className="group relative transition duration-200 hover:z-20"
                      style={{
                        transform: `translateY(${lift}px) rotate(${angle}deg)`,
                      }}
                      onMouseEnter={() => setHoveredCard(card)}
                    >
                      <div className="w-[104px] overflow-hidden rounded-xl border bg-card shadow-md transition-transform duration-200 group-hover:scale-105 group-hover:shadow-lg sm:w-[116px] xl:w-[124px]">
                        <div className="relative">
                          <img
                            src={imageUrl}
                            alt={card.name}
                            className="aspect-5/7 w-full object-cover transform-[translateZ(0)]"
                            loading="eager"
                            fetchPriority="high"
                            draggable={false}
                            onError={(event) => {
                              event.currentTarget.src = CARD_BACK_URL;
                            }}
                          />
                          {imageState?.loading ? (
                            <div className="absolute inset-0 animate-pulse bg-background/20" />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-2">
              {hoveredCard ? (
                <img
                  src={getImageState(hoveredCard)?.url ?? CARD_BACK_URL}
                  alt={hoveredCard?.name ?? "Card preview"}
                  className="mx-auto h-auto max-h-[460px] w-auto rounded-md border object-contain"
                  onError={(event) => {
                    event.currentTarget.src = CARD_BACK_URL;
                  }}
                />
              ) : (
                <div className="flex min-h-[320px] items-center justify-center px-2 text-center text-sm text-muted-foreground">
                  Hover a card in the spread to preview it.
                </div>
              )}
              <div className="mt-2 text-sm">
                <div className="font-medium">{hoveredCard?.name ?? "Card preview"}</div>
                {hoveredCard ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {hoveredCard.type_line}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Field test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Turn {turn}</Badge>
            <Badge variant="secondary">Lands in play: {landsInPlay}</Badge>
            <Badge variant="outline">Mana available: {manaAvailable}</Badge>
            <Badge variant="outline">
              Land drop: {landPlayedThisTurn ? "used" : "available"}
            </Badge>
            <Button variant="outline" onClick={nextTurn} disabled={!library.length}>
              Next turn + draw
            </Button>
            <Button variant="ghost" onClick={resetFieldTest}>
              Reset field
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
              <div className="font-medium">Hand ({hand.length})</div>
              <div className="grid max-h-[520px] grid-cols-2 gap-2 overflow-auto rounded border p-2 sm:grid-cols-3 xl:grid-cols-4">
                {hand.length === 0 ? (
                  <div className="col-span-full text-xs text-muted-foreground">
                    No cards in hand.
                  </div>
                ) : (
                  hand.map((card, idx) => {
                    const manaValue = Math.max(0, Math.ceil(card.cmc));
                    const canPlayLand = isLand(card) && !landPlayedThisTurn;
                    const canCast = !isLand(card) && manaValue <= manaAvailable;
                    const imageUrl = getImageState(card)?.url ?? CARD_BACK_URL;

                    return (
                      <div
                        key={`${card.id}-field-${idx}`}
                        className="overflow-hidden rounded-lg border bg-background/70"
                        onMouseEnter={() => setHoveredCard(card)}
                      >
                        <img
                          src={imageUrl}
                          alt={card.name}
                          className="aspect-5/7 w-full object-cover"
                          loading="eager"
                          draggable={false}
                          onError={(event) => {
                            event.currentTarget.src = CARD_BACK_URL;
                          }}
                        />
                        <div className="space-y-2 p-2">
                          <div className="truncate text-xs font-medium">{card.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {isLand(card) ? "Land" : `MV ${manaValue}`}
                          </div>
                          <div className="flex flex-wrap gap-1">
                          {isLand(card) ? (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => playLand(idx)}
                              disabled={!canPlayLand}
                            >
                              Play land
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => castCard(idx)}
                              disabled={!canCast}
                            >
                              Cast
                            </Button>
                          )}
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => moveHandCard(idx, "graveyard")}
                          >
                            Discard
                          </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

              <div className="space-y-2">
              <div className="font-medium">Battlefield ({battlefield.length})</div>
              <div className="grid max-h-[520px] grid-cols-2 gap-2 overflow-auto rounded border p-2 sm:grid-cols-3 xl:grid-cols-4">
                {battlefield.length === 0 ? (
                  <div className="col-span-full text-xs text-muted-foreground">
                    Nothing in play yet.
                  </div>
                ) : (
                  battlefield.map((card, idx) => {
                    const imageUrl = getImageState(card)?.url ?? CARD_BACK_URL;
                    return (
                      <div
                        key={`${card.id}-battlefield-${idx}`}
                        className="overflow-hidden rounded-lg border bg-muted/20"
                        onMouseEnter={() => setHoveredCard(card)}
                      >
                        <img
                          src={imageUrl}
                          alt={card.name}
                          className="aspect-5/7 w-full object-cover"
                          loading="eager"
                          draggable={false}
                          onError={(event) => {
                            event.currentTarget.src = CARD_BACK_URL;
                          }}
                        />
                        <div className="truncate p-2 text-xs font-medium">{card.name}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

              <div className="space-y-2">
              <div className="font-medium">Graveyard ({graveyard.length})</div>
              <div className="grid max-h-[520px] grid-cols-2 gap-2 overflow-auto rounded border p-2 sm:grid-cols-3 xl:grid-cols-4">
                {graveyard.length === 0 ? (
                  <div className="col-span-full text-xs text-muted-foreground">
                    No cards in graveyard.
                  </div>
                ) : (
                  graveyard.map((card, idx) => {
                    const imageUrl = getImageState(card)?.url ?? CARD_BACK_URL;
                    return (
                      <div
                        key={`${card.id}-graveyard-${idx}`}
                        className="overflow-hidden rounded-lg border bg-muted/20 opacity-80"
                        onMouseEnter={() => setHoveredCard(card)}
                      >
                        <img
                          src={imageUrl}
                          alt={card.name}
                          className="aspect-5/7 w-full object-cover grayscale-[0.25]"
                          loading="eager"
                          draggable={false}
                          onError={(event) => {
                            event.currentTarget.src = CARD_BACK_URL;
                          }}
                        />
                        <div className="truncate p-2 text-xs font-medium">{card.name}</div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Library: {library.length} cards remaining.
              </div>
              </div>
            </div>

            <div className="sticky top-28 rounded-lg border bg-muted/20 p-2">
              {hoveredCard ? (
                <img
                  src={getImageState(hoveredCard)?.url ?? CARD_BACK_URL}
                  alt={hoveredCard?.name ?? "Card preview"}
                  className="mx-auto h-auto max-h-[min(620px,calc(100vh-10rem))] w-auto rounded-md border object-contain"
                  onError={(event) => {
                    event.currentTarget.src = CARD_BACK_URL;
                  }}
                />
              ) : (
                <div className="flex min-h-[360px] items-center justify-center px-2 text-center text-sm text-muted-foreground">
                  Hover a field card to preview it.
                </div>
              )}
              <div className="mt-2 text-sm">
                <div className="font-medium">{hoveredCard?.name ?? "Card preview"}</div>
                {hoveredCard ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {hoveredCard.type_line}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

