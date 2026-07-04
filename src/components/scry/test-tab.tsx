"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown } from "lucide-react";

import type { Deck } from "@/lib/deck";
import { expandDeck, findCommanderEntry } from "@/lib/deck";
import type { ScryfallCard } from "@/lib/scryfall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CARD_BACK_URL = "/card-back.jpg";
const IMAGE_FETCH_DELAY_MS = 90;
const imageUrlCache = new Map<string, string>();
let imageFetchQueue = Promise.resolve();

const BF_CARD_W = 72;
const BF_CARD_H = 100;
/** Magic card aspect ratio 63:88 */
const HAND_CARD_W = 118;
const HAND_CARD_H = Math.round((HAND_CARD_W * 88) / 63);
const HAND_CARD_ASPECT = "63 / 88";
const HAND_FAN_OVERLAP = 0.4;
const HAND_FAN_STEP = HAND_CARD_W * (1 - HAND_FAN_OVERLAP);
const HAND_CARD_GAP = 10;
const HAND_SPREAD_DELTA = HAND_CARD_W + HAND_CARD_GAP - HAND_FAN_STEP;
const HAND_HOVER_RISE_PX = 16;
const HAND_HOVER_SCALE = 1.15;
const HAND_HOVER_PART_PX = 12;
const HAND_FAN_ROTATE_DEG = 1.25;
const HAND_HOVER_TRANSITION = "transform 150ms ease-out";
const HAND_ROW_HEIGHT = HAND_CARD_H + 24;
const HAND_DRAW_ANIM_MS = 200;
const TOP_BAR_H = 40;
const BOTTOM_BAR_H = 176;
const DEFAULT_BF_X = 20;
const DEFAULT_BF_Y = 24;
const HOVER_SCALE_DELAY_MS = 300;
const TAP_TRANSITION_MS = 150;

const DND_ZONE = {
  HAND: "zone-hand",
  BATTLEFIELD: "zone-battlefield",
  GRAVEYARD: "zone-graveyard",
  EXILE: "zone-exile",
  LIBRARY_TOP: "zone-library-top",
  LIBRARY_BOTTOM: "zone-library-bottom",
  COMMANDER: "zone-commander",
} as const;

type ZoneId = "hand" | "battlefield" | "commander" | "graveyard" | "exile" | "library";
type DropZoneId = (typeof DND_ZONE)[keyof typeof DND_ZONE];

type FieldCard = { card: ScryfallCard; uid: string };

type BattlefieldCard = FieldCard & {
  x: number;
  y: number;
  tapped: boolean;
};

type CardDragData = {
  uid: string;
  card: ScryfallCard;
  sourceZone: ZoneId;
  tapped?: boolean;
};

type CardWithStats = ScryfallCard & {
  power?: string | null;
  toughness?: string | null;
};

type ContextMenuState = {
  x: number;
  y: number;
  zone: ZoneId;
  uid: string;
} | null;

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

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
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

function dropHighlightClass(isOver: boolean, canDrop: boolean) {
  if (!canDrop) return "";
  return isOver
    ? "ring-2 ring-inset ring-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)] bg-primary/5"
    : "ring-1 ring-inset ring-primary/20";
}

function useDelayedScale(uid: string | null, activeUid: string | null) {
  const [scaled, setScaled] = React.useState(false);

  React.useEffect(() => {
    if (!activeUid || activeUid !== uid) {
      setScaled(false);
      return;
    }
    const timer = window.setTimeout(() => setScaled(true), HOVER_SCALE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeUid, uid]);

  return scaled;
}

function useLongPress(
  onLongPress: (e: React.PointerEvent) => void,
  ms = 500
) {
  const timerRef = React.useRef<number | null>(null);
  const firedRef = React.useRef(false);

  const clear = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      firedRef.current = false;
      clear();
      timerRef.current = window.setTimeout(() => {
        firedRef.current = true;
        onLongPress(e);
      }, ms);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    wasLongPress: () => firedRef.current,
  };
}

function DroppableZone({
  id,
  children,
  className = "",
  highlight = true,
  disabled = false,
}: {
  id: DropZoneId;
  children: React.ReactNode;
  className?: string;
  highlight?: boolean;
  disabled?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      className={`transition-[box-shadow,background-color] duration-150 ${className} ${
        highlight ? dropHighlightClass(isOver, !disabled) : ""
      }`}
    >
      {children}
    </div>
  );
}

function fanRestWidth(count: number) {
  if (count <= 0) return 0;
  return HAND_CARD_W + (count - 1) * HAND_FAN_STEP;
}

function fanSpreadWidth(count: number) {
  if (count <= 0) return 0;
  return HAND_CARD_W + (count - 1) * (HAND_CARD_W + HAND_CARD_GAP);
}

function indexAtFanPointer(
  clientX: number,
  fanRect: DOMRect,
  scrollLeft: number,
  count: number
): number | null {
  if (count <= 0) return null;
  const x = clientX - fanRect.left + scrollLeft;
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < count; i++) {
    const center = i * HAND_FAN_STEP + HAND_CARD_W / 2;
    const dist = Math.abs(x - center);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function handCardTransform(
  index: number,
  count: number,
  hoveredIndex: number | null,
  spread: boolean
): string {
  const parts: string[] = [];
  const center = (count - 1) / 2;

  if (spread) {
    parts.push(`translateX(${index * HAND_SPREAD_DELTA}px)`);
  } else if (hoveredIndex !== null) {
    if (index < hoveredIndex) {
      parts.push(`translateX(${-HAND_HOVER_PART_PX}px)`);
    } else if (index > hoveredIndex) {
      parts.push(`translateX(${HAND_HOVER_PART_PX}px)`);
    }
    if (index === hoveredIndex) {
      parts.push(`translateY(${-HAND_HOVER_RISE_PX}px)`, `scale(${HAND_HOVER_SCALE})`);
    } else {
      const rot = (index - center) * HAND_FAN_ROTATE_DEG;
      parts.push(`rotate(${rot}deg)`);
    }
  } else {
    const rot = (index - center) * HAND_FAN_ROTATE_DEG;
    parts.push(`rotate(${rot}deg)`);
  }

  return parts.join(" ");
}

function handCardZIndex(
  index: number,
  hoveredIndex: number | null,
  isDragging: boolean
): number {
  if (isDragging) return 60;
  if (hoveredIndex === index) return 50;
  return 10 + index;
}

const FannedHandRow = React.memo(function FannedHandRow({
  cards,
  handSpread,
  enteringUids,
  activeDragId,
  imageUrl,
  onHover,
  onContextMenu,
}: {
  cards: FieldCard[];
  handSpread: boolean;
  enteringUids: Set<string>;
  activeDragId: string | null;
  imageUrl: (card: ScryfallCard) => string;
  onHover: (uid: string | null, card: ScryfallCard | null) => void;
  onContextMenu: (e: React.MouseEvent | React.PointerEvent, uid: string) => void;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fanInnerRef = React.useRef<HTMLDivElement>(null);
  const [fadeLeft, setFadeLeft] = React.useState(false);
  const [fadeRight, setFadeRight] = React.useState(false);
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  const spread = handSpread || activeDragId?.startsWith("hand-") === true;
  const trackWidth = spread ? fanSpreadWidth(cards.length) : fanRestWidth(cards.length);

  React.useEffect(() => {
    if (!spread) return;
    setHoveredIndex(null);
    onHover(null, null);
  }, [spread, onHover]);

  const updateFades = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setFadeLeft(el.scrollLeft > 4);
    setFadeRight(maxScroll > 4 && el.scrollLeft < maxScroll - 4);
  }, []);

  const handleFanPointerMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const fan = fanInnerRef.current;
      const scroll = scrollRef.current;
      if (!fan || cards.length === 0) return;
      const idx = indexAtFanPointer(
        e.clientX,
        fan.getBoundingClientRect(),
        scroll?.scrollLeft ?? 0,
        cards.length
      );
      if (idx === null || idx === hoveredIndex) return;
      setHoveredIndex(idx);
      const fc = cards[idx];
      if (fc) onHover(fc.uid, fc.card);
    },
    [cards, hoveredIndex, onHover]
  );

  const handleFanPointerLeave = React.useCallback(() => {
    setHoveredIndex(null);
    onHover(null, null);
  }, [onHover]);

  React.useEffect(() => {
    updateFades();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateFades);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cards.length, spread, updateFades]);

  React.useEffect(() => {
    if (!enteringUids.size || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    const t = window.setTimeout(updateFades, HAND_DRAW_ANIM_MS);
    return () => window.clearTimeout(t);
  }, [enteringUids, cards.length, updateFades]);

  if (cards.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground/60"
        style={{ height: HAND_ROW_HEIGHT }}
      >
        Drag cards to play
      </div>
    );
  }

  return (
    <div className="relative overflow-visible" style={{ height: HAND_ROW_HEIGHT }}>
      {fadeLeft ? (
        <div
          className="pointer-events-none absolute left-0 top-0 z-40 h-full w-8 bg-gradient-to-r from-muted/90 to-transparent"
          aria-hidden
        />
      ) : null}
      {fadeRight ? (
        <div
          className="pointer-events-none absolute right-0 top-0 z-40 h-full w-8 bg-gradient-to-l from-muted/90 to-transparent"
          aria-hidden
        />
      ) : null}
      <div
        ref={scrollRef}
        className="h-full overflow-x-auto overflow-y-visible [scrollbar-width:thin]"
        onScroll={updateFades}
      >
        <div
          ref={fanInnerRef}
          className="relative mx-auto overflow-visible"
          style={{ width: Math.max(trackWidth, 1), height: HAND_ROW_HEIGHT }}
          onMouseMove={handleFanPointerMove}
          onMouseLeave={handleFanPointerLeave}
        >
          {cards.map((fc, index) => {
            const isDragging = activeDragId === `hand-${fc.uid}`;
            const isHovered = hoveredIndex === index;
            const isEntering = enteringUids.has(fc.uid);
            const slotLeft = index * HAND_FAN_STEP;
            const transform = handCardTransform(index, cards.length, hoveredIndex, spread);
            const zIndex = handCardZIndex(index, hoveredIndex, isDragging);

            return (
              <div
                key={fc.uid}
                className="absolute bottom-0 overflow-visible"
                style={{
                  left: slotLeft,
                  width: HAND_CARD_W,
                  height: HAND_CARD_H,
                  zIndex,
                }}
              >
                <HandCardInner
                  fc={fc}
                  imageSrc={imageUrl(fc.card)}
                  isDragging={isDragging}
                  isHovered={isHovered}
                  isEntering={isEntering}
                  transform={transform}
                  onContextMenu={onContextMenu}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

const HandCardInner = React.memo(function HandCardInner({
  fc,
  imageSrc,
  isDragging,
  isHovered,
  isEntering,
  transform,
  onContextMenu,
}: {
  fc: FieldCard;
  imageSrc: string;
  isDragging: boolean;
  isHovered: boolean;
  isEntering: boolean;
  transform: string;
  onContextMenu: (e: React.MouseEvent | React.PointerEvent, uid: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform: dragTransform } = useDraggable({
    id: `hand-${fc.uid}`,
    data: { uid: fc.uid, card: fc.card, sourceZone: "hand" } satisfies CardDragData,
  });
  const longPress = useLongPress((e) => onContextMenu(e as React.PointerEvent, fc.uid));

  const dragOffset = dragTransform ? CSS.Translate.toString(dragTransform) : "";
  const composedTransform =
    dragOffset && transform !== "none"
      ? `${dragOffset} ${transform}`
      : dragOffset || transform;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`h-full w-full touch-none select-none overflow-hidden rounded-md border bg-card shadow-md sm:rounded-lg ${
        isDragging
          ? "cursor-grabbing opacity-35 shadow-2xl"
          : "cursor-grab opacity-100"
      } ${
        isHovered
          ? "border-primary shadow-xl ring-2 ring-primary/50"
          : "border-border"
      } ${isEntering ? "hand-card-entering" : ""}`}
      style={{
        width: HAND_CARD_W,
        height: HAND_CARD_H,
        transform: composedTransform === "none" ? undefined : composedTransform,
        transformOrigin: "center bottom",
        transition: isEntering ? undefined : HAND_HOVER_TRANSITION,
        willChange: "transform",
      }}
      onPointerDown={(e) => {
        longPress.onPointerDown(e);
        listeners?.onPointerDown?.(e);
      }}
      onPointerUp={longPress.onPointerUp}
      onPointerLeave={longPress.onPointerLeave}
      onPointerCancel={longPress.onPointerCancel}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, fc.uid);
      }}
    >
      <img
        src={imageSrc}
        alt={fc.card.name}
        width={HAND_CARD_W}
        height={HAND_CARD_H}
        className="pointer-events-none h-full w-full object-cover"
        draggable={false}
        onError={(e) => {
          e.currentTarget.src = CARD_BACK_URL;
        }}
      />
    </div>
  );
});

function BattlefieldCardView({
  fc,
  imageUrl,
  isDragging,
  hoverUid,
  onTap,
  onHover,
  onContextMenu,
}: {
  fc: BattlefieldCard;
  imageUrl: (card: ScryfallCard) => string;
  isDragging: boolean;
  hoverUid: string | null;
  onTap: (uid: string) => void;
  onHover: (uid: string | null, card: ScryfallCard | null) => void;
  onContextMenu: (e: React.MouseEvent | React.PointerEvent, uid: string) => void;
}) {
  const { card, tapped } = fc;
  const stats = card as CardWithStats;
  const showPt = isCreature(card) && (stats.power != null || stats.toughness != null);
  const scaled = useDelayedScale(fc.uid, hoverUid);
  const longPress = useLongPress((e) => onContextMenu(e as React.PointerEvent, fc.uid));

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `bf-${fc.uid}`,
    data: {
      uid: fc.uid,
      card: fc.card,
      sourceZone: "battlefield",
      tapped: fc.tapped,
    } satisfies CardDragData,
  });

  return (
    <div
      ref={setNodeRef}
      className={`absolute touch-none select-none ${isDragging ? "cursor-grabbing opacity-40" : "cursor-grab"}`}
      style={{
        left: fc.x,
        top: fc.y,
        width: tapped ? BF_CARD_H : BF_CARD_W,
        height: tapped ? BF_CARD_W : BF_CARD_H,
        zIndex: scaled ? 40 : isDragging ? 35 : 10,
        transform: transform ? CSS.Translate.toString(transform) : undefined,
      }}
      {...listeners}
      {...attributes}
      onPointerDown={(e) => {
        longPress.onPointerDown(e);
        listeners?.onPointerDown?.(e);
      }}
      onPointerUp={longPress.onPointerUp}
      onPointerLeave={(e) => {
        longPress.onPointerLeave();
        onHover(null, null);
      }}
      onPointerCancel={longPress.onPointerCancel}
      onClick={(e) => {
        if (longPress.wasLongPress()) return;
        e.stopPropagation();
        onTap(fc.uid);
      }}
      onMouseEnter={() => onHover(fc.uid, fc.card)}
      onFocus={() => onHover(fc.uid, fc.card)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, fc.uid);
      }}
    >
      <div
        className={`absolute overflow-hidden rounded-md border bg-card ${
          scaled
            ? "border-primary shadow-2xl ring-2 ring-primary/50"
            : isDragging
              ? "border-primary shadow-2xl"
              : "border-border/60 shadow-lg hover:shadow-xl"
        }`}
        style={{
          width: BF_CARD_W,
          height: BF_CARD_H,
          left: tapped ? (BF_CARD_H - BF_CARD_W) / 2 : 0,
          top: tapped ? (BF_CARD_W - BF_CARD_H) / 2 : 0,
          transform: `${tapped ? "rotate(90deg)" : "none"}${scaled ? " scale(1.6)" : ""}`,
          transformOrigin: "center center",
          transition: `transform ${TAP_TRANSITION_MS}ms ease, left ${TAP_TRANSITION_MS}ms ease, top ${TAP_TRANSITION_MS}ms ease, box-shadow 150ms ease`,
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

function DraggableZoneCard({
  id,
  data,
  imageSrc,
  alt,
  faceDown = false,
  className = "",
  onHover,
  onContextMenu,
}: {
  id: string;
  data: CardDragData;
  imageSrc: string;
  alt: string;
  faceDown?: boolean;
  className?: string;
  onHover?: (card: ScryfallCard | null) => void;
  onContextMenu?: (e: React.MouseEvent | React.PointerEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data,
  });
  const longPress = useLongPress((e) => onContextMenu?.(e));

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`overflow-hidden rounded border border-border bg-card ${isDragging ? "cursor-grabbing opacity-40" : "cursor-grab"} transition hover:border-primary hover:ring-2 hover:ring-primary/40 ${className}`}
      style={{
        width: 48,
        height: 67,
        transform: transform ? CSS.Translate.toString(transform) : undefined,
      }}
      onPointerDown={(e) => {
        longPress.onPointerDown(e);
        listeners?.onPointerDown?.(e);
      }}
      onPointerUp={longPress.onPointerUp}
      onPointerLeave={longPress.onPointerLeave}
      onPointerCancel={longPress.onPointerCancel}
      onMouseEnter={() => onHover?.(data.card)}
      onMouseLeave={() => onHover?.(null)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
    >
      <img
        src={imageSrc}
        alt={alt}
        className={`h-full w-full ${faceDown ? "object-cover object-center bg-[#0a1628]" : "object-cover"}`}
        draggable={false}
        onError={
          faceDown
            ? undefined
            : (e) => {
                e.currentTarget.src = CARD_BACK_URL;
              }
        }
      />
    </div>
  );
}

export function TestTab({
  deck,
  onGoToImport,
}: {
  deck: Deck | null;
  onGoToImport?: () => void;
}) {
  const commanderEntry = React.useMemo(
    () => (deck ? findCommanderEntry(deck) : null),
    [deck]
  );

  const fullDeck = React.useMemo(() => {
    if (!deck) return [];
    const expanded = expandDeck(deck);
    if (!commanderEntry) return expanded;
    const commanderId = commanderEntry.card.id;
    return expanded.filter((c) => c.id !== commanderId);
  }, [deck, commanderEntry]);

  const uidCounter = React.useRef(0);
  const nextUid = () => `fc-${++uidCounter.current}`;

  const battlefieldRef = React.useRef<HTMLDivElement>(null);
  const bfDragOriginRef = React.useRef<{ uid: string; x: number; y: number } | null>(null);

  const [library, setLibrary] = React.useState<ScryfallCard[]>([]);
  const [commandZone, setCommandZone] = React.useState<FieldCard | null>(null);
  const [hand, setHand] = React.useState<FieldCard[]>([]);
  const [battlefield, setBattlefield] = React.useState<BattlefieldCard[]>([]);
  const [graveyard, setGraveyard] = React.useState<FieldCard[]>([]);
  const [exile, setExile] = React.useState<FieldCard[]>([]);
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
  const [hoverUid, setHoverUid] = React.useState<string | null>(null);
  const [handExpanded, setHandExpanded] = React.useState(true);
  const [handSpread, setHandSpread] = React.useState(false);
  const [enteringHandUids, setEnteringHandUids] = React.useState<Set<string>>(
    () => new Set()
  );
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);
  const [activeDragData, setActiveDragData] = React.useState<CardDragData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 6 } })
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
      setCommandZone(
        commanderEntry ? { card: commanderEntry.card, uid: nextUid() } : null
      );
      setBattlefield([]);
      setGraveyard([]);
      setExile([]);
      setTurn(1);
      setLife(40);
      setContextMenu(null);
    },
    [fullDeck, commanderEntry]
  );

  const restartGame = React.useCallback(() => dealOpeningHand(7), [dealOpeningHand]);

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

  const imageUrl = React.useCallback((card: ScryfallCard | null) => {
    if (!card) return CARD_BACK_URL;
    return imageStates[normalizeImageKey(card.name)]?.url ?? CARD_BACK_URL;
  }, [imageStates]);

  const previewImageUrl = (card: ScryfallCard | null) => {
    if (!card) return CARD_BACK_URL;
    return card.image_url_large || card.image_url || imageUrl(card);
  };

  const setHover = React.useCallback((uid: string | null, card: ScryfallCard | null) => {
    setHoverUid(uid);
    setHoveredCard(card);
  }, []);

  const markHandEntering = React.useCallback((uids: string[]) => {
    if (!uids.length) return;
    setEnteringHandUids((prev) => {
      const next = new Set(prev);
      for (const uid of uids) next.add(uid);
      return next;
    });
    window.setTimeout(() => {
      setEnteringHandUids((prev) => {
        const next = new Set(prev);
        for (const uid of uids) next.delete(uid);
        return next;
      });
    }, HAND_DRAW_ANIM_MS);
  }, []);

  const removeFromZone = React.useCallback(
    (zone: ZoneId, uid: string): FieldCard | null => {
      switch (zone) {
        case "hand": {
          const idx = hand.findIndex((c) => c.uid === uid);
          if (idx < 0) return null;
          const fc = hand[idx]!;
          setHand((h) => h.filter((c) => c.uid !== uid));
          return fc;
        }
        case "battlefield": {
          const fc = battlefield.find((c) => c.uid === uid);
          if (!fc) return null;
          setBattlefield((bf) => bf.filter((c) => c.uid !== uid));
          return fc;
        }
        case "commander": {
          if (!commandZone || commandZone.uid !== uid) return null;
          const fc = commandZone;
          setCommandZone(null);
          return fc;
        }
        case "graveyard": {
          const idx = graveyard.findIndex((c) => c.uid === uid);
          if (idx < 0) return null;
          const fc = graveyard[idx]!;
          setGraveyard((gy) => gy.filter((c) => c.uid !== uid));
          return fc;
        }
        case "exile": {
          const idx = exile.findIndex((c) => c.uid === uid);
          if (idx < 0) return null;
          const fc = exile[idx]!;
          setExile((ex) => ex.filter((c) => c.uid !== uid));
          return fc;
        }
        case "library": {
          if (uid !== "library-top" || !library.length) return null;
          const card = library[0]!;
          setLibrary((lib) => lib.slice(1));
          return { card, uid: nextUid() };
        }
        default:
          return null;
      }
    },
    [hand, battlefield, commandZone, graveyard, exile, library]
  );

  const battlefieldDropPosition = React.useCallback(
    (event: DragEndEvent | DragMoveEvent, tapped = false) => {
      const rect = battlefieldRef.current?.getBoundingClientRect();
      if (!rect) return nextBattlefieldPosition(battlefield.length);
      const translated = event.active.rect.current.translated;
      if (!translated) return nextBattlefieldPosition(battlefield.length);
      const { w, h } = battlefieldCardSize(tapped);
      return clampBattlefieldPosition(
        translated.left - rect.left,
        translated.top - rect.top,
        tapped,
        rect
      );
    },
    [battlefield.length]
  );

  const addToBattlefield = React.useCallback(
    (fc: FieldCard, x: number, y: number, tapped = false) => {
      setBattlefield((bf) => [...bf, { ...fc, x, y, tapped }]);
    },
    []
  );

  const addToHand = React.useCallback(
    (fc: FieldCard, opts?: { animate?: boolean }) => {
      setHand((h) => [...h, fc]);
      if (opts?.animate) markHandEntering([fc.uid]);
    },
    [markHandEntering]
  );

  const addToGraveyard = React.useCallback((fc: FieldCard) => {
    setGraveyard((gy) => [...gy, fc]);
  }, []);

  const addToExile = React.useCallback((fc: FieldCard) => {
    setExile((ex) => [...ex, fc]);
  }, []);

  const addToLibraryTop = React.useCallback((card: ScryfallCard) => {
    setLibrary((lib) => [card, ...lib]);
  }, []);

  const addToLibraryBottom = React.useCallback((card: ScryfallCard) => {
    setLibrary((lib) => [...lib, card]);
  }, []);

  const addToCommandZone = React.useCallback((fc: FieldCard) => {
    setCommandZone(fc);
  }, []);

  const moveCardToZone = React.useCallback(
    (
      data: CardDragData,
      target: DropZoneId,
      opts?: { bfX?: number; bfY?: number }
    ) => {
      if (target === DND_ZONE.COMMANDER && commandZone) return;

      const fc = removeFromZone(data.sourceZone, data.uid);
      if (!fc) return;

      switch (target) {
        case DND_ZONE.HAND:
          addToHand(fc, { animate: data.sourceZone === "library" });
          break;
        case DND_ZONE.BATTLEFIELD: {
          const pos =
            opts?.bfX != null && opts?.bfY != null
              ? { x: opts.bfX, y: opts.bfY }
              : nextBattlefieldPosition(battlefield.length);
          addToBattlefield(fc, pos.x, pos.y, data.tapped ?? false);
          break;
        }
        case DND_ZONE.GRAVEYARD:
          addToGraveyard(fc);
          break;
        case DND_ZONE.EXILE:
          addToExile(fc);
          break;
        case DND_ZONE.LIBRARY_TOP:
          addToLibraryTop(fc.card);
          break;
        case DND_ZONE.LIBRARY_BOTTOM:
          addToLibraryBottom(fc.card);
          break;
        case DND_ZONE.COMMANDER:
          addToCommandZone(fc);
          break;
      }
    },
    [
      removeFromZone,
      addToHand,
      addToBattlefield,
      addToGraveyard,
      addToExile,
      addToLibraryTop,
      addToLibraryBottom,
      addToCommandZone,
      commandZone,
      battlefield.length,
    ]
  );

  const drawCards = React.useCallback(
    (count: number) => {
      const n = Math.max(1, Math.floor(count));
      if (!library.length) return;
      const take = Math.min(n, library.length);
      const drawn = library.slice(0, take);
      const newCards = drawn.map((card) => ({ card, uid: nextUid() }));
      setLibrary((lib) => lib.slice(take));
      setHand((h) => [...h, ...newCards]);
      markHandEntering(newCards.map((c) => c.uid));
    },
    [library, markHandEntering]
  );

  const drawCard = React.useCallback(() => drawCards(1), [drawCards]);

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

  const drawLibraryIndexToHand = React.useCallback((index: number) => {
    setLibrary((lib) => {
      const card = lib[index];
      if (!card) return lib;
      const fc = { card, uid: nextUid() };
      setHand((h) => [...h, fc]);
      markHandEntering([fc.uid]);
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
  }, [markHandEntering]);

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
        c.tapped ? { ...c, tapped: false, x: c.x + offset, y: c.y - offset } : c
      )
    );
  }, []);

  const duplicateBattlefieldToken = React.useCallback((uid: string) => {
    const fc = battlefield.find((c) => c.uid === uid);
    if (!fc) return;
    const pos = nextBattlefieldPosition(battlefield.length);
    setBattlefield((bf) => [
      ...bf,
      { card: fc.card, uid: nextUid(), x: pos.x + 12, y: pos.y + 12, tapped: false },
    ]);
  }, [battlefield]);

  const isCommanderCard = React.useCallback(
    (card: ScryfallCard) =>
      !!commanderEntry && card.id === commanderEntry.card.id,
    [commanderEntry]
  );

  const menuMove = React.useCallback(
    (zone: ZoneId, uid: string, target: DropZoneId) => {
      let data: CardDragData | null = null;
      if (zone === "hand") {
        const fc = hand.find((c) => c.uid === uid);
        if (fc) data = { uid, card: fc.card, sourceZone: "hand" };
      } else if (zone === "battlefield") {
        const fc = battlefield.find((c) => c.uid === uid);
        if (fc) data = { uid, card: fc.card, sourceZone: "battlefield", tapped: fc.tapped };
      } else if (zone === "commander" && commandZone?.uid === uid) {
        data = { uid, card: commandZone.card, sourceZone: "commander" };
      } else if (zone === "graveyard") {
        const fc = graveyard.find((c) => c.uid === uid);
        if (fc) data = { uid, card: fc.card, sourceZone: "graveyard" };
      } else if (zone === "exile") {
        const fc = exile.find((c) => c.uid === uid);
        if (fc) data = { uid, card: fc.card, sourceZone: "exile" };
      } else if (zone === "library") {
        if (library[0]) data = { uid: "library-top", card: library[0], sourceZone: "library" };
      }
      if (!data) return;
      if (target === DND_ZONE.BATTLEFIELD) {
        const pos = nextBattlefieldPosition(battlefield.length);
        moveCardToZone(data, target, { bfX: pos.x, bfY: pos.y });
      } else {
        moveCardToZone(data, target);
      }
    },
    [hand, battlefield, commandZone, graveyard, exile, library, moveCardToZone, battlefield.length]
  );

  const openContextMenu = (
    e: React.MouseEvent | React.PointerEvent,
    zone: ZoneId,
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
    setActiveDragData((event.active.data.current as CardDragData) ?? null);
    const data = event.active.data.current as CardDragData | undefined;
    if (data?.sourceZone === "hand") setHandSpread(true);
    if (data?.sourceZone === "battlefield") {
      const fc = battlefield.find((c) => c.uid === data.uid);
      if (fc) bfDragOriginRef.current = { uid: fc.uid, x: fc.x, y: fc.y };
    } else {
      bfDragOriginRef.current = null;
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const data = event.active.data.current as CardDragData | undefined;
    if (data?.sourceZone !== "battlefield" || !bfDragOriginRef.current) return;
    const overId = event.over?.id;
    if (overId && overId !== DND_ZONE.BATTLEFIELD) return;

    const origin = bfDragOriginRef.current;
    const rect = battlefieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const tapped = data.tapped ?? false;
    const next = clampBattlefieldPosition(
      origin.x + event.delta.x,
      origin.y + event.delta.y,
      tapped,
      rect
    );
    setBattlefield((bf) =>
      bf.map((c) => (c.uid === origin.uid ? { ...c, x: next.x, y: next.y } : c))
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as CardDragData | undefined;
    const overId = event.over?.id as DropZoneId | undefined;

    setActiveDragId(null);
    setActiveDragData(null);
    setHandSpread(false);

    if (!data) {
      bfDragOriginRef.current = null;
      return;
    }

    if (data.sourceZone === "library" && data.uid === "library-top" && !overId) {
      bfDragOriginRef.current = null;
      return;
    }

    if (!overId) {
      if (data.sourceZone === "battlefield" && bfDragOriginRef.current) {
        const pos = battlefieldDropPosition(event, data.tapped);
        setBattlefield((bf) =>
          bf.map((c) =>
            c.uid === data.uid ? { ...c, x: pos.x, y: pos.y } : c
          )
        );
      }
      bfDragOriginRef.current = null;
      return;
    }

    if (overId === DND_ZONE.BATTLEFIELD) {
      if (data.sourceZone === "battlefield") {
        const pos = battlefieldDropPosition(event, data.tapped);
        setBattlefield((bf) =>
          bf.map((c) =>
            c.uid === data.uid ? { ...c, x: pos.x, y: pos.y } : c
          )
        );
      } else {
        const pos = battlefieldDropPosition(event, false);
        moveCardToZone(data, overId, { bfX: pos.x, bfY: pos.y });
      }
      bfDragOriginRef.current = null;
      return;
    }

    if (overId === DND_ZONE.COMMANDER && commandZone && data.sourceZone !== "commander") {
      bfDragOriginRef.current = null;
      return;
    }

    if (data.sourceZone === "library" && data.uid === "library-top") {
      if (overId === DND_ZONE.LIBRARY_TOP) {
        bfDragOriginRef.current = null;
        return;
      }
      if (overId === DND_ZONE.LIBRARY_BOTTOM) {
        setLibrary((lib) => (lib.length ? [...lib.slice(1), lib[0]!] : lib));
        bfDragOriginRef.current = null;
        return;
      }
    }

    moveCardToZone(data, overId);
    bfDragOriginRef.current = null;
  };

  const sidebarBtn =
    "w-full rounded-md border border-primary/30 bg-primary/90 px-2 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40";
  const sidebarBtnPrimary =
    "w-full rounded-md border border-primary bg-primary px-2 py-2.5 text-xs font-bold text-primary-foreground shadow-md ring-2 ring-primary/30 transition hover:bg-primary/90";

  const showEmpty = !deck || fullDeck.length === 0;
  const topGy = graveyard[graveyard.length - 1];
  const topExile = exile[exile.length - 1];
  const libraryTopCard = library[0] ?? null;
  const isDragging = !!activeDragId;

  const contextMenuCard = React.useMemo(() => {
    if (!contextMenu) return null;
    const { zone, uid } = contextMenu;
    if (zone === "hand") return hand.find((c) => c.uid === uid)?.card ?? null;
    if (zone === "battlefield")
      return battlefield.find((c) => c.uid === uid)?.card ?? null;
    if (zone === "commander" && commandZone?.uid === uid) return commandZone.card;
    if (zone === "graveyard") return graveyard.find((c) => c.uid === uid)?.card ?? null;
    if (zone === "exile") return exile.find((c) => c.uid === uid)?.card ?? null;
    return null;
  }, [contextMenu, hand, battlefield, commandZone, graveyard, exile]);

  const contextMenuBfCard =
    contextMenu?.zone === "battlefield"
      ? battlefield.find((c) => c.uid === contextMenu.uid)
      : null;

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
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex min-h-[520px] w-full overflow-hidden rounded-lg border border-border bg-background text-foreground xl:min-h-[calc(100dvh-10rem)]"
        style={{ height: "calc(100dvh - 10rem)" }}
      >
        <div className="flex min-w-0 flex-1 flex-col">
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
                disabled={!battlefield.some((c) => c.tapped)}
              >
                Untap All
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={restartGame}>
                Restart
              </Button>
            </div>
          </div>

          <DroppableZone
            id={DND_ZONE.BATTLEFIELD}
            className="relative min-h-0 flex-1 overflow-hidden bg-muted/20"
          >
            <div ref={battlefieldRef} className="absolute inset-0">
              <div className="pointer-events-none absolute left-3 top-2 z-20 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                Battlefield
                <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
              </div>
              {isDragging ? (
                <p className="pointer-events-none absolute right-3 top-2 z-20 text-[10px] text-muted-foreground/70">
                  Drop cards here · click to tap
                </p>
              ) : null}

              {battlefield.map((fc) => (
                <BattlefieldCardView
                  key={fc.uid}
                  fc={fc}
                  imageUrl={imageUrl}
                  isDragging={activeDragId === `bf-${fc.uid}`}
                  hoverUid={hoverUid}
                  onTap={toggleTap}
                  onHover={setHover}
                  onContextMenu={(e, uid) => openContextMenu(e, "battlefield", uid)}
                />
              ))}
            </div>
          </DroppableZone>

          <div
            className="flex shrink-0 border-t border-border bg-muted/40"
            style={{ height: BOTTOM_BAR_H }}
          >
            <DroppableZone
              id={DND_ZONE.HAND}
              className="flex min-w-0 flex-1 flex-col overflow-visible border-r border-border px-3 py-1.5"
            >
              <button
                type="button"
                className="mb-1 flex shrink-0 items-center gap-1 text-left text-xs font-semibold text-muted-foreground"
                onClick={() => setHandExpanded((v) => !v)}
              >
                Hand ({hand.length})
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${handExpanded ? "" : "-rotate-90"}`}
                  aria-hidden
                />
              </button>
              {handExpanded ? (
                <FannedHandRow
                  cards={hand}
                  handSpread={handSpread}
                  enteringUids={enteringHandUids}
                  activeDragId={activeDragId}
                  imageUrl={imageUrl}
                  onHover={setHover}
                  onContextMenu={(e, uid) => openContextMenu(e, "hand", uid)}
                />
              ) : (
                <div style={{ height: HAND_ROW_HEIGHT }} />
              )}
            </DroppableZone>

            <div className="flex shrink-0 items-center justify-end gap-3 px-3">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Library ({library.length})
                </span>
                <div className="flex flex-col gap-0.5">
                  <DroppableZone
                    id={DND_ZONE.LIBRARY_TOP}
                    className="rounded"
                    highlight={isDragging}
                    disabled={!isDragging}
                  >
                    {isDragging ? (
                      <span className="block px-1 py-0.5 text-center text-[8px] font-medium uppercase text-primary">
                        Top
                      </span>
                    ) : null}
                  </DroppableZone>
                  {libraryTopCard ? (
                    <DraggableZoneCard
                      id="library-top-card"
                      data={{
                        uid: "library-top",
                        card: libraryTopCard,
                        sourceZone: "library",
                      }}
                      imageSrc={CARD_BACK_URL}
                      alt="Library top"
                      faceDown
                      onHover={setHoveredCard}
                      onContextMenu={(e) => openContextMenu(e, "library", "library-top")}
                    />
                  ) : (
                    <ZoneTracker
                      label=""
                      count={0}
                      imageSrc={CARD_BACK_URL}
                      alt="Library"
                      faceDown
                      hideLabel
                    />
                  )}
                  <DroppableZone
                    id={DND_ZONE.LIBRARY_BOTTOM}
                    className="rounded"
                    highlight={isDragging}
                    disabled={!isDragging}
                  >
                    {isDragging ? (
                      <span className="block px-1 py-0.5 text-center text-[8px] font-medium uppercase text-primary">
                        Bottom
                      </span>
                    ) : null}
                  </DroppableZone>
                </div>
              </div>

              <DroppableZone id={DND_ZONE.GRAVEYARD} highlight={isDragging}>
                {topGy ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Graveyard ({graveyard.length})
                    </span>
                    <DraggableZoneCard
                      id={`gy-${topGy.uid}`}
                      data={{
                        uid: topGy.uid,
                        card: topGy.card,
                        sourceZone: "graveyard",
                      }}
                      imageSrc={imageUrl(topGy.card)}
                      alt={topGy.card.name}
                      onHover={setHoveredCard}
                      onContextMenu={(e) => openContextMenu(e, "graveyard", topGy.uid)}
                    />
                  </div>
                ) : (
                  <ZoneTracker
                    label="Graveyard"
                    count={graveyard.length}
                    imageSrc={null}
                    alt="Graveyard"
                  />
                )}
              </DroppableZone>

              <DroppableZone id={DND_ZONE.EXILE} highlight={isDragging}>
                {topExile ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Exile ({exile.length})
                    </span>
                    <DraggableZoneCard
                      id={`ex-${topExile.uid}`}
                      data={{
                        uid: topExile.uid,
                        card: topExile.card,
                        sourceZone: "exile",
                      }}
                      imageSrc={imageUrl(topExile.card)}
                      alt={topExile.card.name}
                      onHover={setHoveredCard}
                      onContextMenu={(e) => openContextMenu(e, "exile", topExile.uid)}
                    />
                  </div>
                ) : (
                  <ZoneTracker
                    label="Exile"
                    count={exile.length}
                    imageSrc={null}
                    alt="Exile"
                  />
                )}
              </DroppableZone>

              <DroppableZone id={DND_ZONE.COMMANDER} highlight={isDragging}>
                {commandZone ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Commander (1)
                    </span>
                    <DraggableZoneCard
                      id={`cmd-${commandZone.uid}`}
                      data={{
                        uid: commandZone.uid,
                        card: commandZone.card,
                        sourceZone: "commander",
                      }}
                      imageSrc={imageUrl(commandZone.card)}
                      alt={commandZone.card.name}
                      onHover={setHoveredCard}
                      onContextMenu={(e) => openContextMenu(e, "commander", commandZone.uid)}
                    />
                  </div>
                ) : (
                  <ZoneTracker
                    label="Commander"
                    count={0}
                    imageSrc={null}
                    alt="Commander"
                  />
                )}
              </DroppableZone>
            </div>
          </div>
        </div>

        <aside className="flex w-64 shrink-0 flex-col border-l border-border bg-muted/40 xl:w-56 2xl:w-52">
          <div className="shrink-0 border-b border-border p-2" aria-live="polite">
            {hoveredCard ? (
              <div className="space-y-2">
                <img
                  src={previewImageUrl(hoveredCard)}
                  alt={hoveredCard.name}
                  className="mx-auto h-auto max-h-[min(320px,38vh)] w-auto rounded-md border object-contain shadow-md"
                  draggable={false}
                  onError={(e) => {
                    e.currentTarget.src = CARD_BACK_URL;
                  }}
                />
                <div className="text-sm font-medium leading-tight">{hoveredCard.name}</div>
                <div className="text-xs text-muted-foreground">{hoveredCard.type_line}</div>
              </div>
            ) : (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 px-2 text-center text-xs text-muted-foreground">
                <p>Hover a card to preview it.</p>
                <p className="text-[10px] text-muted-foreground/70">
                  Drag between zones · right-click for actions
                </p>
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
                  disabled={!library.length}
                >
                  Draw
                </button>
              </div>
              <button type="button" className={sidebarBtn} onClick={shuffleLibrary}>
                Shuffle
              </button>
              <button type="button" className={sidebarBtn} onClick={openLibraryModal}>
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
                        src={CARD_BACK_URL}
                        alt=""
                        className="h-8 w-6 shrink-0 rounded object-cover object-center bg-[#0a1628]"
                        draggable={false}
                      />
                      <span className="truncate">{card.name}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            <div className="mt-auto space-y-2 pt-2">
              <button type="button" className={sidebarBtn} onClick={restartGame}>
                Restart
              </button>
              <button type="button" className={sidebarBtnPrimary} onClick={nextTurn}>
                Next Turn
              </button>
            </div>
          </div>
        </aside>

        {contextMenu ? (
          <ContextMenuPanel
            contextMenu={contextMenu}
            contextMenuCard={contextMenuCard}
            contextMenuBfCard={contextMenuBfCard}
            commandZone={commandZone}
            isCommanderCard={isCommanderCard}
            onClose={() => setContextMenu(null)}
            onTap={() => {
              if (contextMenuBfCard) toggleTap(contextMenuBfCard.uid);
              setContextMenu(null);
            }}
            onMove={(target) => {
              menuMove(contextMenu.zone, contextMenu.uid, target);
              setContextMenu(null);
            }}
            onDuplicate={() => {
              duplicateBattlefieldToken(contextMenu.uid);
              setContextMenu(null);
            }}
            onDrawLibraryTop={() => {
              menuMove("library", "library-top", DND_ZONE.HAND);
              setContextMenu(null);
            }}
          />
        ) : null}

        {libraryModalOpen ? (
          <LibraryModal
            library={library}
            librarySearch={librarySearch}
            setLibrarySearch={setLibrarySearch}
            filteredLibrary={filteredLibrary}
            libraryPreviewIndex={libraryPreviewIndex}
            setLibraryPreviewIndex={setLibraryPreviewIndex}
            libraryPreviewCard={libraryPreviewCard}
            setHoveredCard={setHoveredCard}
            drawLibraryIndexToHand={drawLibraryIndexToHand}
            shuffleLibrary={shuffleLibrary}
            moveLibraryIndexToTop={moveLibraryIndexToTop}
            moveLibraryIndexToBottom={moveLibraryIndexToBottom}
            onClose={() => setLibraryModalOpen(false)}
            sidebarBtn={sidebarBtn}
            sidebarBtnPrimary={sidebarBtnPrimary}
          />
        ) : null}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18, 0.67, 0.6, 1)" }}>
        {activeDragData ? (
          <div
            className="overflow-hidden rounded-md border-2 border-primary bg-card shadow-[0_20px_40px_rgba(0,0,0,0.45)]"
            style={{
              width:
                activeDragData.sourceZone === "hand" ? HAND_CARD_W : BF_CARD_W,
              height:
                activeDragData.sourceZone === "hand" ? HAND_CARD_H : BF_CARD_H,
              cursor: "grabbing",
            }}
          >
            <img
              src={imageUrl(activeDragData.card)}
              alt={activeDragData.card.name}
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function ZoneTracker({
  label,
  count,
  imageSrc,
  alt,
  faceDown = false,
  hideLabel = false,
}: {
  label: string;
  count: number;
  imageSrc: string | null;
  alt: string;
  faceDown?: boolean;
  hideLabel?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {!hideLabel ? (
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label} ({count})
        </span>
      ) : null}
      <div
        className="overflow-hidden rounded border border-dashed border-border/70 bg-card/50"
        style={{ width: 48, height: 67 }}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={alt}
            className={`h-full w-full ${faceDown ? "object-cover object-center bg-[#0a1628]" : "object-cover"}`}
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

function ContextMenuPanel({
  contextMenu,
  contextMenuCard,
  contextMenuBfCard,
  commandZone,
  isCommanderCard,
  onClose,
  onTap,
  onMove,
  onDuplicate,
  onDrawLibraryTop,
}: {
  contextMenu: ContextMenuState;
  contextMenuCard: ScryfallCard | null;
  contextMenuBfCard: BattlefieldCard | null | undefined;
  commandZone: FieldCard | null;
  isCommanderCard: (card: ScryfallCard) => boolean;
  onClose: () => void;
  onTap: () => void;
  onMove: (target: DropZoneId) => void;
  onDuplicate: () => void;
  onDrawLibraryTop: () => void;
}) {
  if (!contextMenu) return null;

  const canReturnCommander =
    !!contextMenuCard &&
    isCommanderCard(contextMenuCard) &&
    !commandZone &&
    contextMenu.zone === "battlefield";

  return (
    <div
      className="fixed z-[100] min-w-[188px] overflow-hidden rounded-md border border-border bg-popover py-1 text-xs shadow-xl"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {contextMenu.zone === "battlefield" ? (
        <>
          <ContextMenuItem
            label={contextMenuBfCard?.tapped ? "Untap" : "Tap"}
            onClick={onTap}
          />
          <ContextMenuItem label="To Hand" onClick={() => onMove(DND_ZONE.HAND)} />
          <ContextMenuItem label="To Graveyard" onClick={() => onMove(DND_ZONE.GRAVEYARD)} />
          <ContextMenuItem label="To Exile" onClick={() => onMove(DND_ZONE.EXILE)} />
          <ContextMenuItem label="To Top of Library" onClick={() => onMove(DND_ZONE.LIBRARY_TOP)} />
          <ContextMenuItem
            label="To Bottom of Library"
            onClick={() => onMove(DND_ZONE.LIBRARY_BOTTOM)}
          />
          {canReturnCommander ? (
            <ContextMenuItem
              label="To Command Zone"
              onClick={() => onMove(DND_ZONE.COMMANDER)}
            />
          ) : null}
          <ContextMenuItem label="Duplicate Token" onClick={onDuplicate} />
        </>
      ) : null}

      {contextMenu.zone === "hand" ? (
        <>
          <ContextMenuItem label="To Battlefield" onClick={() => onMove(DND_ZONE.BATTLEFIELD)} />
          <ContextMenuItem label="To Graveyard" onClick={() => onMove(DND_ZONE.GRAVEYARD)} />
          <ContextMenuItem label="To Exile" onClick={() => onMove(DND_ZONE.EXILE)} />
          <ContextMenuItem label="To Top of Library" onClick={() => onMove(DND_ZONE.LIBRARY_TOP)} />
          <ContextMenuItem
            label="To Bottom of Library"
            onClick={() => onMove(DND_ZONE.LIBRARY_BOTTOM)}
          />
        </>
      ) : null}

      {contextMenu.zone === "commander" ? (
        <>
          <ContextMenuItem label="Cast to Battlefield" onClick={() => onMove(DND_ZONE.BATTLEFIELD)} />
          <ContextMenuItem label="To Hand" onClick={() => onMove(DND_ZONE.HAND)} />
          <ContextMenuItem label="To Graveyard" onClick={() => onMove(DND_ZONE.GRAVEYARD)} />
          <ContextMenuItem label="To Exile" onClick={() => onMove(DND_ZONE.EXILE)} />
        </>
      ) : null}

      {contextMenu.zone === "library" ? (
        <>
          <ContextMenuItem label="Draw to Hand" onClick={onDrawLibraryTop} />
          <ContextMenuItem label="To Battlefield" onClick={() => onMove(DND_ZONE.BATTLEFIELD)} />
          <ContextMenuItem label="To Graveyard" onClick={() => onMove(DND_ZONE.GRAVEYARD)} />
          <ContextMenuItem label="To Exile" onClick={() => onMove(DND_ZONE.EXILE)} />
        </>
      ) : null}

      {contextMenu.zone === "graveyard" || contextMenu.zone === "exile" ? (
        <>
          <ContextMenuItem label="To Hand" onClick={() => onMove(DND_ZONE.HAND)} />
          <ContextMenuItem label="To Battlefield" onClick={() => onMove(DND_ZONE.BATTLEFIELD)} />
          <ContextMenuItem label="To Top of Library" onClick={() => onMove(DND_ZONE.LIBRARY_TOP)} />
          <ContextMenuItem
            label="To Bottom of Library"
            onClick={() => onMove(DND_ZONE.LIBRARY_BOTTOM)}
          />
          {contextMenu.zone === "graveyard" ? (
            <ContextMenuItem label="To Exile" onClick={() => onMove(DND_ZONE.EXILE)} />
          ) : (
            <ContextMenuItem label="To Graveyard" onClick={() => onMove(DND_ZONE.GRAVEYARD)} />
          )}
        </>
      ) : null}

      <ContextMenuItem label="Close" onClick={onClose} />
    </div>
  );
}

function LibraryModal({
  library,
  librarySearch,
  setLibrarySearch,
  filteredLibrary,
  libraryPreviewIndex,
  setLibraryPreviewIndex,
  libraryPreviewCard,
  setHoveredCard,
  drawLibraryIndexToHand,
  shuffleLibrary,
  moveLibraryIndexToTop,
  moveLibraryIndexToBottom,
  onClose,
  sidebarBtn,
  sidebarBtnPrimary,
}: {
  library: ScryfallCard[];
  librarySearch: string;
  setLibrarySearch: (v: string) => void;
  filteredLibrary: { card: ScryfallCard; index: number }[];
  libraryPreviewIndex: number | null;
  setLibraryPreviewIndex: (v: number | null) => void;
  libraryPreviewCard: ScryfallCard | null;
  setHoveredCard: (c: ScryfallCard | null) => void;
  drawLibraryIndexToHand: (index: number) => void;
  shuffleLibrary: () => void;
  moveLibraryIndexToTop: (index: number) => void;
  moveLibraryIndexToBottom: (index: number) => void;
  onClose: () => void;
  sidebarBtn: string;
  sidebarBtnPrimary: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
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
            onClick={onClose}
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
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
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
                      >
                        <img
                          src={CARD_BACK_URL}
                          alt=""
                          className="h-12 w-9 shrink-0 rounded object-cover object-center bg-[#0a1628]"
                          draggable={false}
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
                  src={CARD_BACK_URL}
                  alt="Card back"
                  className="mx-auto w-full max-w-[180px] rounded-md border object-cover object-center bg-[#0a1628] shadow-md"
                  style={{ aspectRatio: HAND_CARD_ASPECT }}
                  draggable={false}
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
                Hover a card in the list to preview it.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
