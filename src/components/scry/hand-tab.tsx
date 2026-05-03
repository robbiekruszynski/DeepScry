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

// Natural card dimensions (portrait). Used to compute the tapped-rotation geometry.
const CARD_W = 80;  // px wide untapped
const CARD_H = 112; // px tall untapped  (ratio ≈ 5:7)

type FieldCard = { card: ScryfallCard; uid: string };

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
          ? json.card_faces.find((f: any) => f?.image_uris?.normal)?.image_uris?.normal
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

/**
 * Renders a card image that physically rotates 90° when tapped, matching real MTG
 * table feel. The container changes dimensions (portrait ↔ landscape) so surrounding
 * layout reflows naturally.
 */
function CardImage({
  imageUrl,
  alt,
  tapped = false,
  className = "",
  onMouseEnter,
  onError,
}: {
  imageUrl: string;
  alt: string;
  tapped?: boolean;
  className?: string;
  onMouseEnter?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  // When tapped the container flips to landscape so the rotated portrait card fills it exactly.
  const containerW = tapped ? CARD_H : CARD_W;
  const containerH = tapped ? CARD_W : CARD_H;
  // Offset keeps the image center aligned with the container center during rotation.
  const imgLeft = tapped ? (CARD_H - CARD_W) / 2 : 0;
  const imgTop  = tapped ? (CARD_W - CARD_H) / 2 : 0;

  return (
    <div
      className={className}
      style={{ width: containerW, height: containerH, position: "relative", flexShrink: 0 }}
      onMouseEnter={onMouseEnter}
    >
      <img
        src={imageUrl}
        alt={alt}
        style={{
          position: "absolute",
          width: CARD_W,
          height: CARD_H,
          left: imgLeft,
          top: imgTop,
          transform: tapped ? "rotate(90deg)" : "none",
          transformOrigin: "center center",
          transition: "transform 0.22s ease, left 0.22s ease, top 0.22s ease",
          borderRadius: 6,
          objectFit: "cover",
        }}
        loading="eager"
        draggable={false}
        onError={onError ?? ((e) => { e.currentTarget.src = CARD_BACK_URL; })}
      />
    </div>
  );
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

  // The commander lives in the command zone and is never part of the shuffled library.
  const commanderEntry = React.useMemo(() => {
    if (!deck.commanderName) return null;
    return (
      deck.entries.find(
        (e) => e.card.name.toLowerCase() === deck.commanderName!.toLowerCase()
      ) ?? null
    );
  }, [deck]);

  const totalDeckCards = deck.entries.reduce((s, e) => s + e.count, 0);

  const uidCounter = React.useRef(0);
  const nextUid = () => `fc-${++uidCounter.current}`;

  const [library, setLibrary]         = React.useState<ScryfallCard[]>([]);
  const [hand, setHand]               = React.useState<ScryfallCard[]>([]);
  const [handSize, setHandSize]       = React.useState(7);
  const [hoveredCard, setHoveredCard] = React.useState<ScryfallCard | null>(null);
  const [imageStates, setImageStates] = React.useState<
    Record<string, { url: string; loading: boolean }>
  >({});
  const [battlefield, setBattlefield] = React.useState<FieldCard[]>([]);
  const [graveyard, setGraveyard]     = React.useState<FieldCard[]>([]);
  const [tappedUids, setTappedUids]   = React.useState<Set<string>>(new Set());
  const [turn, setTurn]               = React.useState(1);
  const [landPlayedThisTurn, setLandPlayedThisTurn] = React.useState(false);

  // ── Derived mana pool ────────────────────────────────────────────────────
  const untappedLands = battlefield.filter(({ card, uid }) => isLand(card) && !tappedUids.has(uid));
  const tappedLands   = battlefield.filter(({ card, uid }) => isLand(card) && tappedUids.has(uid));
  const manaAvailable = untappedLands.length;
  const totalLands    = untappedLands.length + tappedLands.length;

  // ── Image loading (all visible zones) ───────────────────────────────────
  const allVisibleCards = React.useMemo(() => {
    const cards: ScryfallCard[] = [...hand];
    if (commanderEntry) cards.push(commanderEntry.card);
    battlefield.forEach(({ card }) => cards.push(card));
    graveyard.forEach(({ card }) => cards.push(card));
    return cards;
  }, [hand, battlefield, graveyard]);

  React.useEffect(() => {
    let cancelled = false;
    const unique = Array.from(
      new Map(allVisibleCards.map((c) => [normalizeImageKey(c.name), c])).values()
    );

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
    return () => { cancelled = true; };
  }, [allVisibleCards]);

  const imageUrl = (card: ScryfallCard | null) => {
    if (!card) return CARD_BACK_URL;
    return imageStates[normalizeImageKey(card.name)]?.url ?? CARD_BACK_URL;
  };

  // ── Reset helpers ────────────────────────────────────────────────────────
  const resetField = React.useCallback(() => {
    setBattlefield([]);
    setGraveyard([]);
    setTappedUids(new Set());
    setTurn(1);
    setLandPlayedThisTurn(false);
  }, []);

  const newHand = React.useCallback(
    (size = handSize) => {
      const shuffled = shuffle(fullDeck);
      setLibrary(shuffled.slice(size));
      setHand(shuffled.slice(0, size));
      setHoveredCard(shuffled[0] ?? null);
      resetField();
    },
    [fullDeck, handSize, resetField]
  );

  React.useEffect(() => {
    const start = Math.min(7, fullDeck.length);
    setHandSize(start);
    const shuffled = shuffle(fullDeck);
    setLibrary(shuffled.slice(start));
    setHand(shuffled.slice(0, start));
    setHoveredCard(shuffled[0] ?? null);
    resetField();
  }, [fullDeck, resetField]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const drawCard = () => {
    if (!library.length) return;
    setHand((h) => [...h, library[0]!]);
    setLibrary((lib) => lib.slice(1));
  };

  const nextTurn = () => {
    setTurn((t) => t + 1);
    setLandPlayedThisTurn(false);
    setTappedUids(new Set()); // untap step
    drawCard();
  };

  const mulligan = () => {
    const next = Math.max(0, handSize - 1);
    setHandSize(next);
    newHand(next);
  };

  const removeFromHand = (idx: number): ScryfallCard | null => {
    const card = hand[idx];
    if (!card) return null;
    setHand((cur) => {
      if (cur[idx]?.id !== card.id) return cur;
      return [...cur.slice(0, idx), ...cur.slice(idx + 1)];
    });
    return card;
  };

  const playLand = (idx: number) => {
    if (landPlayedThisTurn) return;
    const card = removeFromHand(idx);
    if (!card || !isLand(card)) return;
    setBattlefield((bf) => [...bf, { card, uid: nextUid() }]);
    setLandPlayedThisTurn(true);
  };

  const castCard = (idx: number) => {
    const card = hand[idx];
    if (!card || isLand(card)) return;
    const cost = Math.max(0, Math.ceil(card.cmc));
    if (cost > manaAvailable) return;

    // Auto-tap the required number of untapped lands
    const toTap = untappedLands.slice(0, cost).map(({ uid }) => uid);
    setTappedUids((prev) => {
      const next = new Set(prev);
      toTap.forEach((uid) => next.add(uid));
      return next;
    });

    removeFromHand(idx);
    if (isPermanent(card)) {
      setBattlefield((bf) => [...bf, { card, uid: nextUid() }]);
    } else {
      setGraveyard((gy) => [...gy, { card, uid: nextUid() }]);
    }
  };

  const discardCard = (idx: number) => {
    const card = removeFromHand(idx);
    if (!card) return;
    setGraveyard((gy) => [...gy, { card, uid: nextUid() }]);
  };

  const toggleTap = (uid: string) => {
    setTappedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const sendToGraveyard = (uid: string) => {
    setBattlefield((bf) => {
      const fc = bf.find((x) => x.uid === uid);
      if (!fc) return bf;
      setGraveyard((gy) => [...gy, { card: fc.card, uid: nextUid() }]);
      return bf.filter((x) => x.uid !== uid);
    });
    setTappedUids((prev) => { const next = new Set(prev); next.delete(uid); return next; });
  };

  const returnToHand = (uid: string) => {
    setBattlefield((bf) => {
      const fc = bf.find((x) => x.uid === uid);
      if (!fc) return bf;
      setHand((h) => [...h, fc.card]);
      return bf.filter((x) => x.uid !== uid);
    });
    setTappedUids((prev) => { const next = new Set(prev); next.delete(uid); return next; });
  };

  // ── Mulligan analysis ────────────────────────────────────────────────────
  const advice       = mulliganAdvice(hand, deck.archetype ?? "midrange", tagMap);
  const baseVerdict  = verdictForHand(hand);
  const handLands    = hand.filter(isLand).length;
  const verdictColor =
    advice.verdict === "Keep"    ? "text-emerald-600 dark:text-emerald-400" :
    advice.verdict === "Mulligan"? "text-destructive" : "text-amber-600 dark:text-amber-400";

  // ── Battlefield split ────────────────────────────────────────────────────
  const bfLands = battlefield.filter(({ card }) => isLand(card));
  const bfPerms = battlefield.filter(({ card }) => !isLand(card));

  // ── Command zone panel ───────────────────────────────────────────────────
  const commandZone = (
    <div className="rounded-xl border-2 border-violet-500/30 bg-muted/10">
      <div className="flex items-center gap-2 border-b border-violet-500/20 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-violet-500/80">
          Command Zone
        </span>
      </div>
      {commanderEntry ? (
        <div className="p-2">
          <div className="flex gap-3">
            <button
              className="shrink-0 overflow-hidden rounded-lg border-2 border-violet-500/40 shadow-md shadow-violet-500/10 transition hover:border-violet-500/70 hover:shadow-lg"
              style={{ width: 80 }}
              onMouseEnter={() => setHoveredCard(commanderEntry.card)}
              onClick={() => setHoveredCard(commanderEntry.card)}
              title="Click to preview commander"
            >
              <img
                src={imageUrl(commanderEntry.card)}
                alt={commanderEntry.card.name}
                style={{ width: 80, height: 112, objectFit: "cover" }}
                loading="eager"
                onError={(e) => { e.currentTarget.src = CARD_BACK_URL; }}
              />
            </button>
            <div className="min-w-0 flex-1 space-y-1.5 py-0.5">
              <div className="text-[13px] font-semibold leading-tight">
                {commanderEntry.card.name}
              </div>
              <div className="text-[11px] text-muted-foreground leading-snug">
                {commanderEntry.card.type_line}
              </div>
              {commanderEntry.card.mana_cost && (
                <div className="text-[11px] font-mono text-muted-foreground">
                  {commanderEntry.card.mana_cost}
                </div>
              )}
              <div className="space-y-0.5 pt-1 border-t border-muted/40">
                <div className="text-[10px] text-muted-foreground capitalize">
                  <span className="font-medium text-foreground/70">Archetype:</span>{" "}
                  {deck.archetype ?? "midrange"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground/70">Deck size:</span>{" "}
                  {totalDeckCards} cards
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-3 py-5 text-center text-xs text-muted-foreground">
          No commander set for this deck.
        </div>
      )}
    </div>
  );

  // ── Preview panel (shared) ───────────────────────────────────────────────
  const previewPanel = (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border bg-muted/20 p-2">
        {hoveredCard ? (
          <img
            src={imageUrl(hoveredCard)}
            alt={hoveredCard.name}
            className="mx-auto h-auto max-h-[420px] w-auto rounded-md object-contain"
            onError={(e) => { e.currentTarget.src = CARD_BACK_URL; }}
          />
        ) : (
          <div className="flex min-h-[280px] items-center justify-center text-center text-sm text-muted-foreground">
            Hover any card to preview
          </div>
        )}
      </div>
      {hoveredCard && (
        <div className="space-y-0.5 px-1">
          <div className="text-sm font-medium">{hoveredCard.name}</div>
          <div className="text-xs text-muted-foreground">{hoveredCard.type_line}</div>
          {hoveredCard.oracle_text && (
            <div className="mt-1 max-h-[120px] overflow-auto rounded border bg-muted/20 p-2 text-xs leading-relaxed text-muted-foreground">
              {hoveredCard.oracle_text}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-6">

      {/* ── Global controls ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => newHand()}>New hand</Button>
        <Button variant="secondary" onClick={mulligan} disabled={handSize <= 0}>
          Mulligan → {Math.max(0, handSize - 1)} cards
        </Button>
        <Button variant="outline" onClick={drawCard} disabled={!library.length}>
          Draw a card
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">Library: {library.length}</Badge>
          <Badge variant="secondary">Hand: {hand.length}</Badge>
        </div>
      </div>

      {/* ── Opening hand spread + mulligan advice ──────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Opening hand</CardTitle>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${verdictColor}`}>
                  {advice.verdict}
                </span>
                <Badge variant="secondary">Lands: {handLands}</Badge>
                <Badge variant="outline">Baseline: {baseVerdict}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Fan of cards */}
            <div className="flex flex-wrap items-end justify-center gap-2 px-1 py-3">
              {hand.map((card, idx) => {
                const center = (hand.length - 1) / 2;
                const offset = idx - center;
                const angle  = offset * 1.4;
                const lift   = Math.min(Math.abs(offset) * 1.5, 8);
                return (
                  <div
                    key={`${card.id}-${idx}`}
                    className="group relative cursor-pointer transition duration-200 hover:z-20"
                    style={{ transform: `translateY(${lift}px) rotate(${angle}deg)` }}
                    onMouseEnter={() => setHoveredCard(card)}
                  >
                    <div className="w-[108px] overflow-hidden rounded-xl border bg-card shadow-md transition-transform duration-200 group-hover:-translate-y-2 group-hover:shadow-xl sm:w-[120px] xl:w-[132px]">
                      <img
                        src={imageUrl(card)}
                        alt={card.name}
                        className="aspect-5/7 w-full object-cover"
                        loading="eager"
                        draggable={false}
                        onError={(e) => { e.currentTarget.src = CARD_BACK_URL; }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Mulligan reasoning */}
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              <div className="mb-1 text-xs text-muted-foreground">
                Archetype: <span className="capitalize text-foreground">{deck.archetype ?? "midrange"}</span>
                {" · "}Ramp in hand: {advice.ramp}
                {" · "}Interaction: {advice.interaction}
              </div>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {advice.reasons.map((r, i) => (
                  <li key={`${r}-${i}`}>• {r}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Command zone + preview */}
        <div className="hidden lg:flex lg:flex-col lg:gap-4">
          {commandZone}
          {previewPanel}
        </div>
      </div>

      {/* ── Field test ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">Field test</CardTitle>
              <Badge variant="secondary">Turn {turn}</Badge>
            </div>
            {/* Mana pool display */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <div className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1">
                <span className="text-xs text-muted-foreground">Mana available</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{manaAvailable}</span>
                <span className="text-xs text-muted-foreground">/ {totalLands}</span>
              </div>
              <Badge variant={landPlayedThisTurn ? "secondary" : "default"}>
                {landPlayedThisTurn ? "Land played" : "Land drop available"}
              </Badge>
            </div>
            {/* Turn controls */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="default" onClick={nextTurn} disabled={!library.length}>
                Next turn + draw
              </Button>
              <Button variant="outline" onClick={resetField}>
                Reset field
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
            <div className="space-y-6">

              {/* ── Hand ─────────────────────────────────────────────── */}
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold">Hand</span>
                  <Badge variant="secondary">{hand.length}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Click a card to preview · Play lands · Cast spells (mana is auto-tapped)
                  </span>
                </div>

                {hand.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Hand is empty.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {hand.map((card, idx) => {
                      const cost          = Math.max(0, Math.ceil(card.cmc));
                      const canPlayLand   = isLand(card) && !landPlayedThisTurn;
                      const canCast       = !isLand(card) && cost <= manaAvailable;
                      const cantAfford    = !isLand(card) && cost > manaAvailable;
                      return (
                        <div
                          key={`${card.id}-hand-${idx}`}
                          className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
                          style={{ width: CARD_W }}
                          onMouseEnter={() => setHoveredCard(card)}
                        >
                          <div className="relative">
                            <img
                              src={imageUrl(card)}
                              alt={card.name}
                              style={{ width: CARD_W, height: CARD_H, objectFit: "cover" }}
                              loading="eager"
                              draggable={false}
                              onError={(e) => { e.currentTarget.src = CARD_BACK_URL; }}
                            />
                            {/* Mana value badge */}
                            {!isLand(card) && (
                              <span
                                className={`absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                                  canCast
                                    ? "bg-emerald-500 text-white"
                                    : cantAfford
                                      ? "bg-muted/90 text-muted-foreground"
                                      : "bg-muted/90 text-muted-foreground"
                                }`}
                              >
                                {cost}
                              </span>
                            )}
                            {isLand(card) && canPlayLand && (
                              <span className="absolute right-1 top-1 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                Play
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 p-1.5">
                            <div className="truncate text-[10px] font-medium leading-tight">
                              {card.name}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {isLand(card) ? (
                                <button
                                  className={`flex-1 rounded px-1 py-0.5 text-[10px] font-medium transition-colors ${
                                    canPlayLand
                                      ? "bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 dark:text-blue-400"
                                      : "cursor-not-allowed bg-muted/40 text-muted-foreground"
                                  }`}
                                  onClick={() => playLand(idx)}
                                  disabled={!canPlayLand}
                                >
                                  {landPlayedThisTurn ? "Used" : "Play"}
                                </button>
                              ) : (
                                <button
                                  className={`flex-1 rounded px-1 py-0.5 text-[10px] font-medium transition-colors ${
                                    canCast
                                      ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400"
                                      : "cursor-not-allowed bg-muted/40 text-muted-foreground"
                                  }`}
                                  onClick={() => castCard(idx)}
                                  disabled={!canCast}
                                >
                                  {cantAfford ? `Need ${cost}` : `Cast`}
                                </button>
                              )}
                              <button
                                className="rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                                onClick={() => discardCard(idx)}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ── Battlefield ──────────────────────────────────────── */}
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold">Battlefield</span>
                  <Badge variant="secondary">{battlefield.length}</Badge>
                  {bfLands.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Click a land to tap/untap · tapped lands are rotated
                    </span>
                  )}
                </div>

                {battlefield.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nothing in play yet — play lands and cast permanents from your hand.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Non-land permanents sub-zone — sits above lands */}
                    {bfPerms.length > 0 && (
                      <div>
                        <div className="mb-2 text-xs font-medium text-muted-foreground">
                          Permanents
                        </div>
                        <div className="flex flex-wrap items-start gap-3">
                          {bfPerms.map(({ card, uid }) => (
                            <div key={uid} className="flex flex-col items-center gap-1">
                              <div
                                className="group relative overflow-hidden rounded-lg border transition-shadow hover:shadow-md"
                                style={{ width: CARD_W }}
                                onMouseEnter={() => setHoveredCard(card)}
                              >
                                <img
                                  src={imageUrl(card)}
                                  alt={card.name}
                                  style={{ width: CARD_W, height: CARD_H, objectFit: "cover" }}
                                  loading="eager"
                                  draggable={false}
                                  onError={(e) => { e.currentTarget.src = CARD_BACK_URL; }}
                                />
                                <div className="bg-background/80 p-1">
                                  <div className="truncate text-[10px] font-medium">{card.name}</div>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  className="rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                                  onClick={() => sendToGraveyard(uid)}
                                >
                                  → Gy
                                </button>
                                <button
                                  className="rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                                  onClick={() => returnToHand(uid)}
                                >
                                  → Hand
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lands sub-zone — sits below permanents */}
                    {bfLands.length > 0 && (
                      <div>
                        <div className="mb-2 text-xs font-medium text-muted-foreground">
                          Lands — {untappedLands.length} untapped (mana available) · {tappedLands.length} tapped
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          {bfLands.map(({ card, uid }) => {
                            const tapped = tappedUids.has(uid);
                            return (
                              <div key={uid} className="flex flex-col items-center gap-1">
                                <button
                                  className={`group relative cursor-pointer rounded-lg border-2 transition-all duration-200 focus:outline-none ${
                                    tapped
                                      ? "border-amber-500/60 opacity-75 hover:opacity-90"
                                      : "border-emerald-500/60 hover:border-emerald-500 hover:shadow-md hover:shadow-emerald-500/20"
                                  }`}
                                  onClick={() => toggleTap(uid)}
                                  onMouseEnter={() => setHoveredCard(card)}
                                  title={tapped ? "Untap" : "Tap for mana"}
                                  style={{ overflow: "hidden" }}
                                >
                                  <CardImage
                                    imageUrl={imageUrl(card)}
                                    alt={card.name}
                                    tapped={tapped}
                                  />
                                  <div className={`absolute bottom-0 inset-x-0 flex justify-center py-0.5 text-[9px] font-bold leading-none ${
                                    tapped ? "bg-amber-500/80 text-white" : "bg-emerald-500/80 text-white"
                                  }`}>
                                    {tapped ? "TAPPED" : "UNTAPPED"}
                                  </div>
                                </button>
                                <button
                                  className="text-[10px] text-muted-foreground hover:text-destructive"
                                  onClick={() => sendToGraveyard(uid)}
                                >
                                  → Gy
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ── Graveyard + Library stat ──────────────────────── */}
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold">Graveyard</span>
                  <Badge variant="secondary">{graveyard.length}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    Library: {library.length} cards remaining
                  </span>
                </div>
                {graveyard.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Empty
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {graveyard.map(({ card, uid }) => (
                      <div
                        key={uid}
                        className="relative overflow-hidden rounded-lg border opacity-70 grayscale-[0.3] transition-opacity hover:opacity-90"
                        style={{ width: 60 }}
                        onMouseEnter={() => setHoveredCard(card)}
                      >
                        <img
                          src={imageUrl(card)}
                          alt={card.name}
                          style={{ width: 60, height: 84, objectFit: "cover" }}
                          loading="eager"
                          draggable={false}
                          onError={(e) => { e.currentTarget.src = CARD_BACK_URL; }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Sticky command zone + preview — desktop */}
            <div className="hidden lg:sticky lg:top-28 lg:flex lg:flex-col lg:gap-4">
              {commandZone}
              {previewPanel}
            </div>
          </div>

          {/* Mobile: command zone + preview */}
          <div className="flex flex-col gap-4 lg:hidden">
            {commandZone}
            {previewPanel}
          </div>

          <div className="rounded border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">How it works: </span>
            Play lands from your hand (1 per turn) · Cast spells — the required lands
            auto-tap · Click lands on the battlefield to tap or untap manually ·
            "Next turn" draws a card and untaps everything.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
