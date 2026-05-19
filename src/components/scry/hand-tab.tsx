"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import type { CardTagMap, Deck } from "@/lib/deck";
import { expandDeck } from "@/lib/deck";
import { mulliganAdvice } from "@/lib/commander-tools";
import { isLand } from "@/lib/stats";
import type { ScryfallCard } from "@/lib/scryfall";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CARD_BACK_URL = "https://cards.scryfall.io/back.jpg";
const IMAGE_FETCH_DELAY_MS = 90;
const imageUrlCache = new Map<string, string>();
let imageFetchQueue = Promise.resolve();

const BF_CARD_W = 72;
const BF_CARD_H = 100;
const HAND_CARD_W = 100;
const HAND_CARD_H = 140;
const TOP_BAR_H = 40;
const OPENING_CARD_W = 72;
const OPENING_CARD_H = 100;
const BOTTOM_BAR_H = 160;
const SIDEBAR_W = 120;
const DEFAULT_BF_X = 20;
const DEFAULT_BF_Y = 24;

type FieldCard = { card: ScryfallCard; uid: string };

type BattlefieldCard = FieldCard & {
  x: number;
  y: number;
  tapped: boolean;
};

type CardWithStats = ScryfallCard & {
  power?: string | null;
  toughness?: string | null;
};

type ContextMenuState =
  | {
      x: number;
      y: number;
      zone: "hand" | "battlefield";
      uid: string;
    }
  | null;

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

function isCreature(card: ScryfallCard) {
  return /\bCreature\b/i.test(card.type_line);
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

function nextBattlefieldPosition(index: number) {
  const col = index % 10;
  const row = Math.floor(index / 10);
  return {
    x: DEFAULT_BF_X + col * (BF_CARD_W + 8),
    y: DEFAULT_BF_Y + row * (BF_CARD_H + 8),
  };
}

function BattlefieldCardView({
  fc,
  imageUrl,
  onPointerDown,
  onClick,
  onContextMenu,
}: {
  fc: BattlefieldCard;
  imageUrl: (card: ScryfallCard | null) => string;
  onPointerDown: (e: React.PointerEvent, uid: string) => void;
  onClick: (e: React.MouseEvent, uid: string) => void;
  onContextMenu: (e: React.MouseEvent, uid: string) => void;
}) {
  const { card, tapped } = fc;
  const stats = card as CardWithStats;
  const showPt = isCreature(card) && (stats.power != null || stats.toughness != null);

  return (
    <div
      className="absolute touch-none select-none"
      style={{
        left: fc.x,
        top: fc.y,
        width: tapped ? BF_CARD_H : BF_CARD_W,
        height: tapped ? BF_CARD_W : BF_CARD_H,
        zIndex: 10,
      }}
      onPointerDown={(e) => onPointerDown(e, fc.uid)}
      onClick={(e) => onClick(e, fc.uid)}
      onContextMenu={(e) => onContextMenu(e, fc.uid)}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-md border border-border/60 bg-card shadow-lg"
        style={{
          transform: tapped ? "rotate(90deg)" : "none",
          transformOrigin: "center center",
          transition: "transform 0.2s ease",
        }}
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
        {showPt ? (
          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 py-px text-[10px] font-bold leading-none text-white">
            {stats.power ?? "?"}/{stats.toughness ?? "?"}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function HandTab({
  deck,
  tagMap,
  onGoToImport,
}: {
  deck: Deck | null;
  tagMap: CardTagMap;
  /** Wire from parent: `() => setTab("import")` */
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

  const commanderEntry = React.useMemo(() => {
    if (!deck?.commanderName) return null;
    return (
      deck.entries.find(
        (e) => e.card.name.toLowerCase() === deck.commanderName!.toLowerCase()
      ) ?? null
    );
  }, [deck]);

  const uidCounter = React.useRef(0);
  const nextUid = () => `fc-${++uidCounter.current}`;

  const battlefieldRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{
    uid: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const dragMovedRef = React.useRef(false);

  const [library, setLibrary] = React.useState<ScryfallCard[]>([]);
  const [hand, setHand] = React.useState<FieldCard[]>([]);
  const [battlefield, setBattlefield] = React.useState<BattlefieldCard[]>([]);
  const [graveyard, setGraveyard] = React.useState<ScryfallCard[]>([]);
  const [exile, setExile] = React.useState<ScryfallCard[]>([]);
  const [turn, setTurn] = React.useState(1);
  const [life, setLife] = React.useState(40);
  const [imageStates, setImageStates] = React.useState<
    Record<string, { url: string; loading: boolean }>
  >({});
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState>(null);
  const [libraryModalOpen, setLibraryModalOpen] = React.useState(false);
  const [handExpanded, setHandExpanded] = React.useState(true);
  const [openingHandSize, setOpeningHandSize] = React.useState(7);

  const dealOpeningHand = React.useCallback(
    (size: number) => {
      const shuffled = shuffle(fullDeck);
      const count = Math.min(size, shuffled.length);
      setLibrary(shuffled.slice(count));
      setHand(
        shuffled.slice(0, count).map((card) => ({
          card,
          uid: nextUid(),
        }))
      );
      setBattlefield([]);
      setGraveyard([]);
      setExile([]);
      setTurn(1);
      setLife(40);
      setContextMenu(null);
    },
    [fullDeck]
  );

  const restartGame = React.useCallback(() => {
    setOpeningHandSize(7);
    dealOpeningHand(7);
  }, [dealOpeningHand]);

  const newOpeningHand = React.useCallback(() => {
    setOpeningHandSize(7);
    dealOpeningHand(7);
  }, [dealOpeningHand]);

  const mulliganOpening = React.useCallback(() => {
    const next = Math.max(0, openingHandSize - 1);
    setOpeningHandSize(next);
    dealOpeningHand(next);
  }, [openingHandSize, dealOpeningHand]);

  React.useEffect(() => {
    if (fullDeck.length === 0) return;
    restartGame();
  }, [fullDeck, restartGame]);

  const handAdvice = React.useMemo(() => {
    if (!deck || hand.length === 0) return null;
    const cards = hand.map((h) => h.card);
    return {
      baseline: verdictForHand(cards),
      advice: mulliganAdvice(cards, deck.archetype ?? "midrange", tagMap),
      landCount: cards.filter(isLand).length,
    };
  }, [hand, deck, tagMap]);

  const allVisibleCards = React.useMemo(() => {
    const cards: ScryfallCard[] = [...library];
    hand.forEach(({ card }) => cards.push(card));
    battlefield.forEach(({ card }) => cards.push(card));
    graveyard.forEach((card) => cards.push(card));
    exile.forEach((card) => cards.push(card));
    if (commanderEntry) cards.push(commanderEntry.card);
    return cards;
  }, [library, hand, battlefield, graveyard, exile, commanderEntry]);

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
    return () => {
      cancelled = true;
    };
  }, [allVisibleCards]);

  const imageUrl = (card: ScryfallCard | null) => {
    if (!card) return CARD_BACK_URL;
    return imageStates[normalizeImageKey(card.name)]?.url ?? CARD_BACK_URL;
  };

  const drawCard = React.useCallback(() => {
    if (!library.length) return;
    const [top, ...rest] = library;
    if (!top) return;
    setLibrary(rest);
    setHand((h) => [...h, { card: top, uid: nextUid() }]);
  }, [library]);

  const shuffleLibrary = React.useCallback(() => {
    setLibrary((lib) => shuffle(lib));
  }, []);

  const nextTurn = React.useCallback(() => {
    setTurn((t) => t + 1);
    drawCard();
  }, [drawCard]);

  const playHandCardToBattlefield = React.useCallback((uid: string) => {
    setHand((h) => {
      const idx = h.findIndex((c) => c.uid === uid);
      if (idx < 0) return h;
      const fc = h[idx]!;
      setBattlefield((bf) => {
        const pos = nextBattlefieldPosition(bf.length);
        return [...bf, { ...fc, x: pos.x, y: pos.y, tapped: false }];
      });
      return [...h.slice(0, idx), ...h.slice(idx + 1)];
    });
  }, []);

  const moveHandToGraveyard = React.useCallback((uid: string) => {
    setHand((h) => {
      const idx = h.findIndex((c) => c.uid === uid);
      if (idx < 0) return h;
      const fc = h[idx]!;
      setGraveyard((gy) => [...gy, fc.card]);
      return [...h.slice(0, idx), ...h.slice(idx + 1)];
    });
  }, []);

  const moveHandToExile = React.useCallback((uid: string) => {
    setHand((h) => {
      const idx = h.findIndex((c) => c.uid === uid);
      if (idx < 0) return h;
      const fc = h[idx]!;
      setExile((ex) => [...ex, fc.card]);
      return [...h.slice(0, idx), ...h.slice(idx + 1)];
    });
  }, []);

  const moveBattlefieldToHand = React.useCallback((uid: string) => {
    setBattlefield((bf) => {
      const fc = bf.find((c) => c.uid === uid);
      if (!fc) return bf;
      setHand((h) => [...h, { card: fc.card, uid: nextUid() }]);
      return bf.filter((c) => c.uid !== uid);
    });
  }, []);

  const moveBattlefieldToGraveyard = React.useCallback((uid: string) => {
    setBattlefield((bf) => {
      const fc = bf.find((c) => c.uid === uid);
      if (!fc) return bf;
      setGraveyard((gy) => [...gy, fc.card]);
      return bf.filter((c) => c.uid !== uid);
    });
  }, []);

  const moveBattlefieldToExile = React.useCallback((uid: string) => {
    setBattlefield((bf) => {
      const fc = bf.find((c) => c.uid === uid);
      if (!fc) return bf;
      setExile((ex) => [...ex, fc.card]);
      return bf.filter((c) => c.uid !== uid);
    });
  }, []);

  const toggleTap = React.useCallback((uid: string) => {
    setBattlefield((bf) =>
      bf.map((c) => (c.uid === uid ? { ...c, tapped: !c.tapped } : c))
    );
  }, []);

  const handleBattlefieldPointerDown = (e: React.PointerEvent, uid: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const fc = battlefield.find((c) => c.uid === uid);
    if (!fc || !battlefieldRef.current) return;
    dragMovedRef.current = false;
    dragRef.current = {
      uid,
      startX: e.clientX,
      startY: e.clientY,
      origX: fc.x,
      origY: fc.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleBattlefieldPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !battlefieldRef.current) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 4) dragMovedRef.current = true;
    const rect = battlefieldRef.current.getBoundingClientRect();
    const maxX = Math.max(0, rect.width - BF_CARD_W);
    const maxY = Math.max(0, rect.height - BF_CARD_H);
    const nx = Math.min(maxX, Math.max(0, drag.origX + dx));
    const ny = Math.min(maxY, Math.max(0, drag.origY + dy));
    setBattlefield((bf) =>
      bf.map((c) => (c.uid === drag.uid ? { ...c, x: nx, y: ny } : c))
    );
  };

  const handleBattlefieldPointerUp = () => {
    dragRef.current = null;
    window.setTimeout(() => {
      dragMovedRef.current = false;
    }, 0);
  };

  const openContextMenu = (
    e: React.MouseEvent,
    zone: "hand" | "battlefield",
    uid: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, zone, uid });
  };

  React.useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, []);

  const sidebarBtn =
    "w-full rounded-md border border-primary/30 bg-primary/90 px-2 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40";
  const sidebarBtnPrimary =
    "w-full rounded-md border border-primary bg-primary px-2 py-2.5 text-xs font-bold text-primary-foreground shadow-md ring-2 ring-primary/30 transition hover:bg-primary/90";

  const showEmpty = !deck || fullDeck.length === 0;
  const topGy = graveyard[graveyard.length - 1];
  const topExile = exile[exile.length - 1];

  return (
    <div
      className="flex overflow-hidden rounded-lg border border-border bg-background text-foreground"
      style={{ height: "calc(100vh - 11rem)", minHeight: 520 }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Top bar ── */}
        <div
          className="flex shrink-0 items-center justify-between border-b border-border bg-muted/40 px-3"
          style={{ height: TOP_BAR_H }}
        >
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted hover:bg-muted/80"
              onClick={() => setLife((l) => Math.max(0, l - 1))}
              aria-label="Decrease life"
            >
              —
            </button>
            <span className="min-w-[2.5rem] text-center tabular-nums">{life}</span>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted hover:bg-muted/80"
              onClick={() => setLife((l) => l + 1)}
              aria-label="Increase life"
            >
              +
            </button>
          </div>
          <span className="text-sm font-semibold text-muted-foreground">Turn {turn}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={restartGame}
            disabled={showEmpty}
          >
            Restart
          </Button>
        </div>

        {/* ── Opening hand + keep/mulligan (above field test) ── */}
        {!showEmpty && handAdvice ? (
          <div className="shrink-0 space-y-2 border-b border-border bg-muted/30 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Opening hand
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={newOpeningHand}
              >
                New hand
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={mulliganOpening}
                disabled={openingHandSize <= 0}
              >
                Mulligan → {Math.max(0, openingHandSize - 1)}
              </Button>
              <Badge
                variant={
                  handAdvice.advice.verdict === "Keep"
                    ? "default"
                    : handAdvice.advice.verdict === "Mulligan"
                      ? "destructive"
                      : "secondary"
                }
              >
                {handAdvice.advice.verdict}
              </Badge>
              <Badge variant="outline">Lands: {handAdvice.landCount}</Badge>
              <Badge variant="outline">Quick read: {handAdvice.baseline}</Badge>
              {deck?.archetype ? (
                <span className="text-xs capitalize text-muted-foreground">{deck.archetype}</span>
              ) : null}
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max items-end px-1">
                {hand.map((fc, idx) => {
                  const center = (hand.length - 1) / 2;
                  const offsetFromCenter = idx - center;
                  const angle = offsetFromCenter * 3;
                  const lift = Math.abs(offsetFromCenter) * 2;
                  return (
                    <div
                      key={fc.uid}
                      className="relative shrink-0"
                      style={{
                        marginLeft: idx === 0 ? 0 : -28,
                        transform: `translateY(${lift}px) rotate(${angle}deg)`,
                      }}
                    >
                      <div
                        className="overflow-hidden rounded-md border border-border bg-card shadow-md"
                        style={{ width: OPENING_CARD_W, height: OPENING_CARD_H }}
                      >
                        <img
                          src={imageUrl(fc.card)}
                          alt={fc.card.name}
                          className="h-full w-full object-cover"
                          draggable={false}
                          onError={(e) => {
                            e.currentTarget.src = CARD_BACK_URL;
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              {handAdvice.advice.reasons.map((reason, i) => (
                <li key={`${reason}-${i}`}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* ── Battlefield (field test) ── */}
        <div
          ref={battlefieldRef}
          className="relative min-h-0 flex-1 overflow-hidden bg-muted/20"
          onPointerMove={handleBattlefieldPointerMove}
          onPointerUp={handleBattlefieldPointerUp}
          onPointerLeave={handleBattlefieldPointerUp}
        >
          <div className="pointer-events-none absolute left-3 top-2 z-20 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            Battlefield
            <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
          </div>

          {showEmpty ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
              <p className="text-center text-sm text-muted-foreground">
                Import a deck to begin playtesting
              </p>
              <Button onClick={() => onGoToImport?.()} disabled={!onGoToImport}>
                Go to Import
              </Button>
            </div>
          ) : (
            battlefield.map((fc) => (
              <BattlefieldCardView
                key={fc.uid}
                fc={fc}
                imageUrl={imageUrl}
                onPointerDown={handleBattlefieldPointerDown}
                onClick={(e, uid) => {
                  if (dragMovedRef.current) return;
                  e.stopPropagation();
                  toggleTap(uid);
                }}
                onContextMenu={(e, uid) => openContextMenu(e, "battlefield", uid)}
              />
            ))
          )}
        </div>

        {/* ── Bottom bar ── */}
        <div
          className="flex shrink-0 border-t border-border bg-muted/40"
          style={{ height: BOTTOM_BAR_H }}
        >
          <div className="flex min-w-0 flex-1 flex-col border-r border-border px-3 py-2">
            <button
              type="button"
              className="mb-2 flex items-center gap-1 text-left text-xs font-semibold text-muted-foreground"
              onClick={() => setHandExpanded((v) => !v)}
            >
              Hand ({hand.length})
              <ChevronDown
                className={`h-3 w-3 transition-transform ${handExpanded ? "" : "-rotate-90"}`}
                aria-hidden
              />
            </button>
            {handExpanded ? (
              <div className="flex flex-1 items-end gap-2 overflow-x-auto pb-1">
                {hand.length === 0 ? (
                  <span className="text-xs text-muted-foreground/60">No cards in hand</span>
                ) : (
                  hand.map((fc) => (
                    <button
                      key={fc.uid}
                      type="button"
                      className="shrink-0 overflow-hidden rounded-md border border-border bg-card shadow-md transition hover:ring-2 hover:ring-primary/40"
                      style={{ width: HAND_CARD_W, height: HAND_CARD_H }}
                      onClick={() => playHandCardToBattlefield(fc.uid)}
                      onContextMenu={(e) => openContextMenu(e, "hand", fc.uid)}
                      disabled={showEmpty}
                    >
                      <img
                        src={imageUrl(fc.card)}
                        alt={fc.card.name}
                        className="h-full w-full object-cover"
                        draggable={false}
                        onError={(e) => {
                          e.currentTarget.src = CARD_BACK_URL;
                        }}
                      />
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-5 px-4">
            <ZoneTracker
              label="Library"
              count={library.length}
              imageSrc={CARD_BACK_URL}
              alt="Library"
            />
            <ZoneTracker
              label="Graveyard"
              count={graveyard.length}
              imageSrc={topGy ? imageUrl(topGy) : null}
              alt={topGy?.name ?? "Graveyard"}
            />
            <ZoneTracker
              label="Exile"
              count={exile.length}
              imageSrc={topExile ? imageUrl(topExile) : null}
              alt={topExile?.name ?? "Exile"}
            />
            <ZoneTracker
              label="Command"
              count={commanderEntry ? 1 : 0}
              imageSrc={commanderEntry ? imageUrl(commanderEntry.card) : null}
              alt={commanderEntry?.card.name ?? "Commander"}
            />
          </div>
        </div>
      </div>

      {/* ── Right sidebar ── */}
      <aside
        className="flex shrink-0 flex-col gap-2 border-l border-border bg-muted/40 p-2"
        style={{ width: SIDEBAR_W }}
      >
        <button type="button" className={sidebarBtn} onClick={restartGame} disabled={showEmpty}>
          Restart
        </button>
        <button type="button" className={sidebarBtn} onClick={shuffleLibrary} disabled={showEmpty}>
          Shuffle
        </button>
        <button
          type="button"
          className={sidebarBtn}
          onClick={() => setLibraryModalOpen(true)}
          disabled={showEmpty}
        >
          View Library
        </button>
        <button type="button" className={sidebarBtn} onClick={drawCard} disabled={showEmpty || !library.length}>
          Draw
        </button>
        <button type="button" className={sidebarBtnPrimary} onClick={nextTurn} disabled={showEmpty}>
          Next Turn
        </button>
      </aside>

      {contextMenu ? (
        <div
          className="fixed z-[100] min-w-[168px] overflow-hidden rounded-md border border-border bg-popover py-1 text-xs shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.zone === "hand" ? (
            <>
              <ContextMenuItem
                label="Play to Battlefield"
                onClick={() => {
                  playHandCardToBattlefield(contextMenu.uid);
                  setContextMenu(null);
                }}
              />
              <ContextMenuItem
                label="Move to Graveyard"
                onClick={() => {
                  moveHandToGraveyard(contextMenu.uid);
                  setContextMenu(null);
                }}
              />
              <ContextMenuItem
                label="Move to Exile"
                onClick={() => {
                  moveHandToExile(contextMenu.uid);
                  setContextMenu(null);
                }}
              />
            </>
          ) : (
            <>
              <ContextMenuItem
                label="Move to Hand"
                onClick={() => {
                  moveBattlefieldToHand(contextMenu.uid);
                  setContextMenu(null);
                }}
              />
              <ContextMenuItem
                label="Move to Graveyard"
                onClick={() => {
                  moveBattlefieldToGraveyard(contextMenu.uid);
                  setContextMenu(null);
                }}
              />
              <ContextMenuItem
                label="Move to Exile"
                onClick={() => {
                  moveBattlefieldToExile(contextMenu.uid);
                  setContextMenu(null);
                }}
              />
            </>
          )}
        </div>
      ) : null}

      {libraryModalOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setLibraryModalOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Library ({library.length} cards)</h3>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setLibraryModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <ol className="flex-1 overflow-y-auto px-4 py-3 text-sm">
              {library.length === 0 ? (
                <li className="text-muted-foreground">Library is empty.</li>
              ) : (
                library.map((card, i) => (
                  <li
                    key={`${card.id}-${i}`}
                    className="border-b border-border/50 py-1.5 text-foreground"
                  >
                    {i + 1}. {card.name}
                  </li>
                ))
              )}
            </ol>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ZoneTracker({
  label,
  count,
  imageSrc,
  alt,
}: {
  label: string;
  count: number;
  imageSrc: string | null;
  alt: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label} ({count})
      </span>
      <div
        className="overflow-hidden rounded border border-border bg-card"
        style={{ width: 48, height: 67 }}
      >
        {imageSrc ? (
          <img src={imageSrc} alt={alt} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[9px] text-muted-foreground/50">
            —
          </div>
        )}
      </div>
    </div>
  );
}

function ContextMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="block w-full px-3 py-1.5 text-left hover:bg-muted"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
