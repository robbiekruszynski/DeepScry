"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import type { Deck } from "@/lib/deck";
import { expandDeck } from "@/lib/deck";
import { isLand } from "@/lib/stats";
import type { ScryfallCard } from "@/lib/scryfall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CARD_BACK_URL = "https://cards.scryfall.io/back.jpg";
const LIBRARY_BACK_URL = "https://cards.scryfall.io/back.jpg";
const IMAGE_FETCH_DELAY_MS = 90;
const imageUrlCache = new Map<string, string>();
let imageFetchQueue = Promise.resolve();

const BF_CARD_W = 72;
const BF_CARD_H = 100;
const HAND_CARD_ASPECT = "5 / 7";
const TOP_BAR_H = 40;
const BOTTOM_BAR_H = 176;
const SIDEBAR_W = 280;
const DEFAULT_BF_X = 20;
const DEFAULT_BF_Y = 24;

function battlefieldCardSize(tapped: boolean) {
  return tapped ? { w: BF_CARD_H, h: BF_CARD_W } : { w: BF_CARD_W, h: BF_CARD_H };
}

function clampBattlefieldPosition(
  x: number,
  y: number,
  tapped: boolean,
  rect: DOMRect
) {
  const { w, h } = battlefieldCardSize(tapped);
  const maxX = Math.max(0, rect.width - w);
  const maxY = Math.max(0, rect.height - h);
  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y)),
  };
}

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
        `/api/scryfall/card?fuzzy=${encodeURIComponent(cardName)}`,
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
  isHovered,
  isBeingDragged,
  onPointerDown,
  onClick,
  onContextMenu,
  onHover,
}: {
  fc: BattlefieldCard;
  imageUrl: (card: ScryfallCard | null) => string;
  isHovered: boolean;
  isBeingDragged?: boolean;
  onPointerDown: (e: React.PointerEvent, uid: string) => void;
  onClick: (e: React.MouseEvent, uid: string) => void;
  onContextMenu: (e: React.MouseEvent, uid: string) => void;
  onHover: (card: ScryfallCard | null) => void;
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
        zIndex: isBeingDragged ? 20 : 10,
        opacity: isBeingDragged ? 0.35 : 1,
      }}
      onPointerDown={(e) => onPointerDown(e, fc.uid)}
      onClick={(e) => onClick(e, fc.uid)}
      onContextMenu={(e) => onContextMenu(e, fc.uid)}
      onMouseEnter={() => onHover(fc.card)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(fc.card)}
    >
      <div
        className={`absolute overflow-hidden rounded-md border bg-card shadow-lg ${
          isHovered ? "border-primary ring-2 ring-primary/50" : "border-border/60"
        }`}
        style={{
          width: BF_CARD_W,
          height: BF_CARD_H,
          left: tapped ? (BF_CARD_H - BF_CARD_W) / 2 : 0,
          top: tapped ? (BF_CARD_W - BF_CARD_H) / 2 : 0,
          transform: tapped ? "rotate(90deg)" : "none",
          transformOrigin: "center center",
          transition: "transform 0.2s ease, left 0.2s ease, top 0.2s ease",
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
        {showPt && !tapped ? (
          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 py-px text-[10px] font-bold leading-none text-white">
            {stats.power ?? "?"}/{stats.toughness ?? "?"}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function TestTab({
  deck,
  onGoToImport,
}: {
  deck: Deck | null;
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
  const handZoneRef = React.useRef<HTMLDivElement>(null);
  const handStateRef = React.useRef<FieldCard[]>([]);
  const battlefieldStateRef = React.useRef<BattlefieldCard[]>([]);
  const dragListenersCleanupRef = React.useRef<(() => void) | null>(null);
  const dragRef = React.useRef<
    | {
        source: "battlefield";
        uid: string;
        startX: number;
        startY: number;
        origX: number;
        origY: number;
        tapped: boolean;
      }
    | {
        source: "hand";
        uid: string;
        startX: number;
        startY: number;
      }
    | null
  >(null);
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
  const [librarySearch, setLibrarySearch] = React.useState("");
  const [libraryPreviewIndex, setLibraryPreviewIndex] = React.useState<number | null>(null);
  const [drawCount, setDrawCount] = React.useState("1");
  const [hoveredCard, setHoveredCard] = React.useState<ScryfallCard | null>(null);
  const [handExpanded, setHandExpanded] = React.useState(true);
  const [handDragGhost, setHandDragGhost] = React.useState<{
    uid: string;
    card: ScryfallCard;
    x: number;
    y: number;
  } | null>(null);
  const [handDragOverBattlefield, setHandDragOverBattlefield] = React.useState(false);
  const [handDragOverHand, setHandDragOverHand] = React.useState(false);

  React.useEffect(() => {
    handStateRef.current = hand;
  }, [hand]);

  React.useEffect(() => {
    battlefieldStateRef.current = battlefield;
  }, [battlefield]);

  React.useEffect(
    () => () => {
      dragListenersCleanupRef.current?.();
    },
    []
  );

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
    dealOpeningHand(7);
  }, [dealOpeningHand]);

  React.useEffect(() => {
    if (fullDeck.length === 0) return;
    restartGame();
  }, [fullDeck, restartGame]);

  const deckCardsForImages = React.useMemo(() => {
    const cards = [...fullDeck];
    if (commanderEntry) cards.push(commanderEntry.card);
    return cards;
  }, [fullDeck, commanderEntry]);

  React.useEffect(() => {
    let cancelled = false;
    const unique = Array.from(
      new Map(deckCardsForImages.map((c) => [normalizeImageKey(c.name), c])).values()
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
  }, [deckCardsForImages]);

  const imageUrl = (card: ScryfallCard | null) => {
    if (!card) return CARD_BACK_URL;
    return imageStates[normalizeImageKey(card.name)]?.url ?? CARD_BACK_URL;
  };

  const previewImageUrl = (card: ScryfallCard | null) => {
    if (!card) return CARD_BACK_URL;
    return card.image_url_large || card.image_url || imageUrl(card);
  };

  const drawCards = React.useCallback(
    (count: number) => {
      const n = Math.max(1, Math.floor(count));
      if (!library.length) return;
      const take = Math.min(n, library.length);
      const drawn = library.slice(0, take);
      setLibrary((lib) => lib.slice(take));
      setHand((h) => [...h, ...drawn.map((card) => ({ card, uid: nextUid() }))]);
    },
    [library]
  );

  const drawCard = React.useCallback(() => {
    drawCards(1);
  }, [drawCards]);

  const shuffleLibrary = React.useCallback(() => {
    setLibrary((lib) => shuffle(lib));
  }, []);

  const moveLibraryIndexToTop = React.useCallback((index: number) => {
    setLibrary((lib) => {
      const card = lib[index];
      if (!card) return lib;
      return [card, ...lib.slice(0, index), ...lib.slice(index + 1)];
    });
  }, []);

  const moveLibraryIndexToBottom = React.useCallback((index: number) => {
    setLibrary((lib) => {
      const card = lib[index];
      if (!card) return lib;
      return [...lib.slice(0, index), ...lib.slice(index + 1), card];
    });
  }, []);

  const returnHandToLibraryTop = React.useCallback((uid: string) => {
    setHand((h) => {
      const idx = h.findIndex((c) => c.uid === uid);
      if (idx < 0) return h;
      const fc = h[idx]!;
      setLibrary((lib) => [fc.card, ...lib]);
      return [...h.slice(0, idx), ...h.slice(idx + 1)];
    });
  }, []);

  const returnHandToLibraryBottom = React.useCallback((uid: string) => {
    setHand((h) => {
      const idx = h.findIndex((c) => c.uid === uid);
      if (idx < 0) return h;
      const fc = h[idx]!;
      setLibrary((lib) => [...lib, fc.card]);
      return [...h.slice(0, idx), ...h.slice(idx + 1)];
    });
  }, []);

  const drawLibraryIndexToHand = React.useCallback((index: number) => {
    setLibrary((lib) => {
      const card = lib[index];
      if (!card) return lib;
      setHand((h) => [...h, { card, uid: nextUid() }]);
      const next = [...lib.slice(0, index), ...lib.slice(index + 1)];
      setLibraryPreviewIndex((prevIdx) => {
        if (next.length === 0) return null;
        if (prevIdx === null) return 0;
        if (prevIdx === index) return Math.min(index, next.length - 1);
        if (prevIdx > index) return prevIdx - 1;
        return prevIdx;
      });
      return next;
    });
  }, []);

  const filteredLibrary = React.useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return library.map((card, index) => ({ card, index }));
    return library
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card.name.toLowerCase().includes(q));
  }, [library, librarySearch]);

  const libraryPreviewCard =
    libraryPreviewIndex !== null ? library[libraryPreviewIndex] ?? null : null;

  const openLibraryModal = React.useCallback(() => {
    setLibraryPreviewIndex(library.length > 0 ? 0 : null);
    setLibraryModalOpen(true);
  }, [library.length]);

  const nextTurn = React.useCallback(() => {
    setTurn((t) => t + 1);
    drawCard();
  }, [drawCard]);

  const playHandCardToBattlefieldAt = React.useCallback(
    (uid: string, x: number, y: number) => {
      const idx = handStateRef.current.findIndex((c) => c.uid === uid);
      if (idx < 0) return;
      const fc = handStateRef.current[idx]!;
      if (battlefieldStateRef.current.some((c) => c.uid === uid)) return;
      const nextHand = handStateRef.current.filter((c) => c.uid !== uid);
      const nextBattlefield = [
        ...battlefieldStateRef.current,
        { ...fc, x, y, tapped: false },
      ];
      handStateRef.current = nextHand;
      battlefieldStateRef.current = nextBattlefield;
      setHand(nextHand);
      setBattlefield(nextBattlefield);
    },
    []
  );

  const playHandCardToBattlefield = React.useCallback(
    (uid: string) => {
      const idx = handStateRef.current.findIndex((c) => c.uid === uid);
      if (idx < 0) return;
      const fc = handStateRef.current[idx]!;
      if (battlefieldStateRef.current.some((c) => c.uid === uid)) return;
      const pos = nextBattlefieldPosition(battlefieldStateRef.current.length);
      const nextHand = handStateRef.current.filter((c) => c.uid !== uid);
      const nextBattlefield = [
        ...battlefieldStateRef.current,
        { ...fc, x: pos.x, y: pos.y, tapped: false },
      ];
      handStateRef.current = nextHand;
      battlefieldStateRef.current = nextBattlefield;
      setHand(nextHand);
      setBattlefield(nextBattlefield);
    },
    []
  );

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
    const fc = battlefieldStateRef.current.find((c) => c.uid === uid);
    if (!fc) return;
    if (handStateRef.current.some((c) => c.uid === uid)) return;
    const returning = { card: fc.card, uid: fc.uid };
    const nextBattlefield = battlefieldStateRef.current.filter((c) => c.uid !== uid);
    battlefieldStateRef.current = nextBattlefield;
    handStateRef.current = [...handStateRef.current, returning];
    setBattlefield(nextBattlefield);
    setHand(handStateRef.current);
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
    const offset = (BF_CARD_H - BF_CARD_W) / 2;
    setBattlefield((bf) =>
      bf.map((c) => {
        if (c.uid !== uid) return c;
        const nextTapped = !c.tapped;
        return nextTapped
          ? { ...c, tapped: true, x: c.x - offset, y: c.y + offset }
          : { ...c, tapped: false, x: c.x + offset, y: c.y - offset };
      })
    );
  }, []);

  const untapAll = React.useCallback(() => {
    const offset = (BF_CARD_H - BF_CARD_W) / 2;
    setBattlefield((bf) =>
      bf.map((c) =>
        c.tapped
          ? { ...c, tapped: false, x: c.x + offset, y: c.y - offset }
          : c
      )
    );
  }, []);

  const isPointOverHand = (clientX: number, clientY: number) => {
    const rect = handZoneRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  };

  const isPointOverBattlefield = (clientX: number, clientY: number) => {
    const rect = battlefieldRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  };

  const clientToBattlefieldPosition = (
    clientX: number,
    clientY: number,
    tapped = false
  ) => {
    const rect = battlefieldRef.current!.getBoundingClientRect();
    const { w, h } = battlefieldCardSize(tapped);
    return clampBattlefieldPosition(
      clientX - rect.left - w / 2,
      clientY - rect.top - h / 2,
      tapped,
      rect
    );
  };

  const setBattlefieldSynced = React.useCallback(
    (updater: (bf: BattlefieldCard[]) => BattlefieldCard[]) => {
      setBattlefield((bf) => {
        const next = updater(bf);
        battlefieldStateRef.current = next;
        return next;
      });
    },
    []
  );

  const handleBattlefieldPointerDown = (e: React.PointerEvent, uid: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const fc = battlefieldStateRef.current.find((c) => c.uid === uid);
    if (!fc || !battlefieldRef.current) return;
    dragMovedRef.current = false;
    dragRef.current = {
      source: "battlefield",
      uid,
      startX: e.clientX,
      startY: e.clientY,
      origX: fc.x,
      origY: fc.y,
      tapped: fc.tapped,
    };
    attachDragListeners();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleHandPointerDown = (e: React.PointerEvent, fc: FieldCard) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragMovedRef.current = false;
    dragRef.current = {
      source: "hand",
      uid: fc.uid,
      startX: e.clientX,
      startY: e.clientY,
    };
    setHandDragGhost({ uid: fc.uid, card: fc.card, x: e.clientX, y: e.clientY });
    attachDragListeners();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleDragPointerMove = React.useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 4) dragMovedRef.current = true;

    if (drag.source === "hand") {
      const handCard = handStateRef.current.find((c) => c.uid === drag.uid);
      if (!handCard) return;
      setHandDragGhost({
        uid: drag.uid,
        card: handCard.card,
        x: e.clientX,
        y: e.clientY,
      });
      setHandDragOverBattlefield(isPointOverBattlefield(e.clientX, e.clientY));
      setHandDragOverHand(false);
      return;
    }

    const bfCard = battlefieldStateRef.current.find((c) => c.uid === drag.uid);
    if (!bfCard) return;

    const overHand = isPointOverHand(e.clientX, e.clientY);
    setHandDragOverHand(overHand);
    setHandDragOverBattlefield(isPointOverBattlefield(e.clientX, e.clientY));

    if (overHand) {
      if (dragMovedRef.current) {
        setHandDragGhost({
          uid: drag.uid,
          card: bfCard.card,
          x: e.clientX,
          y: e.clientY,
        });
      }
      return;
    }

    setHandDragGhost(null);

    if (!battlefieldRef.current) return;
    const rect = battlefieldRef.current.getBoundingClientRect();
    const next = clampBattlefieldPosition(
      drag.origX + dx,
      drag.origY + dy,
      drag.tapped,
      rect
    );
    setBattlefieldSynced((bf) =>
      bf.map((c) => (c.uid === drag.uid ? { ...c, x: next.x, y: next.y } : c))
    );
  }, [setBattlefieldSynced]);

  const finishDrag = React.useCallback(
    (e: PointerEvent) => {
      dragListenersCleanupRef.current?.();
      dragListenersCleanupRef.current = null;

      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;

      if (drag.source === "hand" && dragMovedRef.current && battlefieldRef.current) {
        if (isPointOverBattlefield(e.clientX, e.clientY)) {
          const { x, y } = clientToBattlefieldPosition(e.clientX, e.clientY);
          playHandCardToBattlefieldAt(drag.uid, x, y);
        }
      }

      if (drag.source === "battlefield" && dragMovedRef.current) {
        if (isPointOverHand(e.clientX, e.clientY)) {
          moveBattlefieldToHand(drag.uid);
        } else if (isPointOverBattlefield(e.clientX, e.clientY)) {
          const { x, y } = clientToBattlefieldPosition(
            e.clientX,
            e.clientY,
            drag.tapped
          );
          setBattlefieldSynced((bf) =>
            bf.map((c) => (c.uid === drag.uid ? { ...c, x, y } : c))
          );
        }
      }

      setHandDragGhost(null);
      setHandDragOverBattlefield(false);
      setHandDragOverHand(false);
      window.setTimeout(() => {
        dragMovedRef.current = false;
      }, 0);
    },
    [moveBattlefieldToHand, playHandCardToBattlefieldAt, setBattlefieldSynced]
  );

  const attachDragListeners = React.useCallback(() => {
    dragListenersCleanupRef.current?.();
    const onMove = (e: PointerEvent) => handleDragPointerMove(e);
    const onUp = (e: PointerEvent) => finishDrag(e);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    dragListenersCleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [finishDrag, handleDragPointerMove]);

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

  if (showEmpty) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-border bg-background">
        <div className="flex flex-col items-center gap-4 px-4 text-center">
          <p className="text-sm text-muted-foreground">Import a deck to begin playtesting</p>
          <Button onClick={() => onGoToImport?.()} disabled={!onGoToImport}>
            Go to Import →
          </Button>
        </div>
      </div>
    );
  }

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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={untapAll}
              disabled={showEmpty || !battlefield.some((c) => c.tapped)}
            >
              Untap All
            </Button>
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
        </div>


        {/* ── Battlefield (field test) ── */}
        <div
          ref={battlefieldRef}
          className={`relative min-h-0 flex-1 overflow-hidden bg-muted/20 transition-shadow ${
            handDragOverBattlefield ? "ring-2 ring-inset ring-primary/50" : ""
          }`}
        >
          <div className="pointer-events-none absolute left-3 top-2 z-20 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            Battlefield
            <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
          </div>

          {battlefield.map((fc) => (
            <BattlefieldCardView
              key={fc.uid}
              fc={fc}
              imageUrl={imageUrl}
              isHovered={hoveredCard === fc.card}
              isBeingDragged={handDragGhost?.uid === fc.uid}
              onPointerDown={handleBattlefieldPointerDown}
              onClick={(e, uid) => {
                if (dragMovedRef.current) return;
                e.stopPropagation();
                toggleTap(uid);
              }}
              onContextMenu={(e, uid) => openContextMenu(e, "battlefield", uid)}
              onHover={setHoveredCard}
            />
          ))}
        </div>

        {/* ── Bottom bar ── */}
        <div
          className="flex shrink-0 border-t border-border bg-muted/40"
          style={{ height: BOTTOM_BAR_H }}
        >
          <div
            ref={handZoneRef}
            className={`flex min-w-0 flex-1 flex-col border-r border-border px-3 py-2 transition-shadow ${
              handDragOverHand ? "ring-2 ring-inset ring-primary/50" : ""
            }`}
          >
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
              <div
                className="grid w-full flex-1 gap-1 sm:gap-1.5"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(hand.length, 1)}, minmax(0, 1fr))`,
                }}
              >
                {hand.length === 0 ? (
                  <span className="col-span-full self-center text-xs text-muted-foreground/60">
                    No cards in hand
                  </span>
                ) : (
                  hand.map((fc) => {
                    const isHovered = hoveredCard === fc.card;
                    const isDragging = handDragGhost?.uid === fc.uid;
                    return (
                      <div
                        key={fc.uid}
                        role="button"
                        tabIndex={0}
                        className={`min-w-0 touch-none select-none overflow-hidden rounded-md border bg-card shadow-md transition hover:ring-2 hover:ring-primary/40 sm:rounded-lg ${
                          isHovered ? "border-primary ring-2 ring-primary/50" : "border-border"
                        } ${isDragging ? "opacity-40" : "cursor-grab active:cursor-grabbing"}`}
                        style={{ aspectRatio: HAND_CARD_ASPECT, maxHeight: 132 }}
                        onPointerDown={(e) => handleHandPointerDown(e, fc)}
                        onClick={() => {
                          if (dragMovedRef.current) return;
                          playHandCardToBattlefield(fc.uid);
                        }}
                        onContextMenu={(e) => openContextMenu(e, "hand", fc.uid)}
                        onMouseEnter={() => setHoveredCard(fc.card)}
                        onFocus={() => setHoveredCard(fc.card)}
                      >
                        <img
                          src={imageUrl(fc.card)}
                          alt={fc.card.name}
                          className="pointer-events-none h-full w-full object-cover"
                          draggable={false}
                          onError={(e) => {
                            e.currentTarget.src = CARD_BACK_URL;
                          }}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-5 px-4">
            <ZoneTracker
              label="Library"
              count={library.length}
              imageSrc={LIBRARY_BACK_URL}
              alt="Library"
              faceDown
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

      {/* ── Right sidebar: preview + library controls ── */}
      <aside
        className="flex shrink-0 flex-col border-l border-border bg-muted/40"
        style={{ width: SIDEBAR_W }}
      >
        <div
          className="shrink-0 border-b border-border p-2"
          aria-live="polite"
        >
          {hoveredCard ? (
            <div className="space-y-2">
              <img
                src={previewImageUrl(hoveredCard)}
                alt={hoveredCard.name}
                className="mx-auto h-auto max-h-[min(320px,38vh)] w-auto rounded-md border object-contain"
                draggable={false}
                onError={(e) => {
                  e.currentTarget.src = CARD_BACK_URL;
                }}
              />
              <div className="text-sm font-medium leading-tight">{hoveredCard.name}</div>
              <div className="text-xs text-muted-foreground">{hoveredCard.type_line}</div>
            </div>
          ) : (
            <div className="flex min-h-[200px] items-center justify-center px-2 text-center text-xs text-muted-foreground">
              Hover a card to preview it.
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Library ({library.length})
            </p>
            <Input
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              placeholder="Search library…"
              className="h-8 text-xs"
            />
            <div className="flex gap-1">
              <Input
                type="number"
                min={1}
                max={99}
                value={drawCount}
                onChange={(e) => setDrawCount(e.target.value)}
                className="h-8 w-16 text-xs tabular-nums"
                aria-label="Cards to draw"
              />
              <button
                type="button"
                className={`${sidebarBtn} flex-1`}
                onClick={() => drawCards(Number(drawCount) || 1)}
                disabled={showEmpty || !library.length}
              >
                Draw
              </button>
            </div>
            <button type="button" className={sidebarBtn} onClick={shuffleLibrary} disabled={showEmpty}>
              Shuffle
            </button>
            <button
              type="button"
              className={sidebarBtn}
              onClick={openLibraryModal}
              disabled={showEmpty}
            >
              View Library
            </button>
          </div>

          {librarySearch.trim() ? (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/60 bg-background/50 p-1">
              {filteredLibrary.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">No matches.</p>
              ) : (
                filteredLibrary.slice(0, 12).map(({ card, index }) => (
                  <button
                    key={`${card.id}-${index}`}
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-xs hover:bg-muted"
                    onMouseEnter={() => {
                      setLibraryPreviewIndex(index);
                      setHoveredCard(card);
                    }}
                    onClick={() => drawLibraryIndexToHand(index)}
                  >
                    <img
                      src={LIBRARY_BACK_URL}
                      alt=""
                      className="h-8 w-6 shrink-0 rounded object-contain bg-[#0a1628]"
                      draggable={false}
                    />
                    <span className="truncate">{card.name}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}

          <div className="mt-auto space-y-2 pt-2">
            <button type="button" className={sidebarBtn} onClick={restartGame} disabled={showEmpty}>
              Restart
            </button>
            <button type="button" className={sidebarBtnPrimary} onClick={nextTurn} disabled={showEmpty}>
              Next Turn
            </button>
          </div>
        </div>
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
              <ContextMenuItem
                label="Return to top of library"
                onClick={() => {
                  returnHandToLibraryTop(contextMenu.uid);
                  setContextMenu(null);
                }}
              />
              <ContextMenuItem
                label="Return to bottom of library"
                onClick={() => {
                  returnHandToLibraryBottom(contextMenu.uid);
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
            className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Library ({library.length} cards)</h3>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setLibraryModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="border-b border-border px-4 py-3">
              <Input
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Search by card name…"
                className="h-9 text-sm"
              />
            </div>

            <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
              <div
                className="min-h-0 flex-1 overflow-y-auto pr-1"
                onMouseLeave={() => {
                  if (library.length > 0 && libraryPreviewIndex === null) {
                    setLibraryPreviewIndex(0);
                  }
                }}
              >
                {filteredLibrary.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No cards found.</p>
                ) : (
                  <ul className="space-y-1">
                    {filteredLibrary.map(({ card, index }) => {
                      const isPreviewed = libraryPreviewIndex === index;
                      return (
                        <li key={`${card.id}-${index}`}>
                          <button
                            type="button"
                            className={`flex w-full items-center gap-3 rounded-md border px-2 py-1.5 text-left text-sm transition ${
                              isPreviewed
                                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                : "border-transparent hover:bg-muted/60"
                            }`}
                            onClick={() => drawLibraryIndexToHand(index)}
                            onMouseEnter={() => {
                              setLibraryPreviewIndex(index);
                              setHoveredCard(card);
                            }}
                            onFocus={() => {
                              setLibraryPreviewIndex(index);
                              setHoveredCard(card);
                            }}
                          >
                            <img
                              src={LIBRARY_BACK_URL}
                              alt=""
                              className="h-12 w-9 shrink-0 rounded object-contain bg-[#0a1628]"
                              draggable={false}
                              onError={(e) => {
                                e.currentTarget.src = CARD_BACK_URL;
                              }}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {index + 1}. {card.name}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex w-52 shrink-0 flex-col gap-2 border-l border-border/60 pl-4">
                <button type="button" className={sidebarBtn} onClick={shuffleLibrary}>
                  Shuffle library
                </button>

                {libraryPreviewCard && libraryPreviewIndex !== null ? (
                  <>
                    <img
                      src={LIBRARY_BACK_URL}
                      alt="Card back"
                      className="mx-auto w-full max-w-[180px] rounded-md border object-contain bg-[#0a1628] shadow-md"
                      style={{ aspectRatio: HAND_CARD_ASPECT }}
                      draggable={false}
                      onError={(e) => {
                        e.currentTarget.src = CARD_BACK_URL;
                      }}
                    />
                    <div className="space-y-0.5 text-center">
                      <div className="text-sm font-medium leading-tight">
                        {libraryPreviewCard.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {libraryPreviewCard.type_line}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={sidebarBtnPrimary}
                      onClick={() => drawLibraryIndexToHand(libraryPreviewIndex)}
                    >
                      Draw to hand
                    </button>
                    <button
                      type="button"
                      className={sidebarBtn}
                      onClick={() => moveLibraryIndexToTop(libraryPreviewIndex)}
                    >
                      Put on top
                    </button>
                    <button
                      type="button"
                      className={sidebarBtn}
                      onClick={() => moveLibraryIndexToBottom(libraryPreviewIndex)}
                    >
                      Put on bottom
                    </button>
                  </>
                ) : (
                  <p className="text-center text-xs text-muted-foreground">
                    Hover a card in the list to preview it. Click a card to draw it.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {handDragGhost ? (
        <div
          className="pointer-events-none fixed z-[200] overflow-hidden rounded-md border-2 border-primary bg-card shadow-2xl"
          style={{
            left: handDragGhost.x - BF_CARD_W / 2,
            top: handDragGhost.y - BF_CARD_H / 2,
            width: BF_CARD_W,
            height: BF_CARD_H,
            opacity: 0.92,
          }}
        >
          <img
            src={imageUrl(handDragGhost.card)}
            alt={handDragGhost.card.name}
            className="h-full w-full object-cover"
            draggable={false}
          />
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
  faceDown = false,
}: {
  label: string;
  count: number;
  imageSrc: string | null;
  alt: string;
  faceDown?: boolean;
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
          <img
            src={imageSrc}
            alt={alt}
            className={`h-full w-full ${faceDown ? "object-contain bg-[#0a1628]" : "object-cover"}`}
            draggable={false}
          />
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
