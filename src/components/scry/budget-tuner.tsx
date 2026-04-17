"use client";

import * as React from "react";

import type { Deck } from "@/lib/deck";
import type { ScryfallCard } from "@/lib/scryfall";
import { fetchCardById, fetchCardByNameFuzzy } from "@/lib/scryfall";
import { computeDeckStats, isInteraction, isLand, isRamp } from "@/lib/stats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Candidate = { name: string; reason: string };

const RAMP_CANDIDATES: Candidate[] = [
  { name: "Arcane Signet", reason: "cheap, universal mana rock" },
  { name: "Fellwar Stone", reason: "efficient color fixing" },
  { name: "Nature's Lore", reason: "2 mana land ramp" },
  { name: "Three Visits", reason: "2 mana land ramp" },
  { name: "Rampant Growth", reason: "budget land acceleration" },
];

const INTERACTION_CANDIDATES: Candidate[] = [
  { name: "Swords to Plowshares", reason: "efficient creature removal" },
  { name: "Path to Exile", reason: "efficient creature removal" },
  { name: "Generous Gift", reason: "broad permanent answer" },
  { name: "Pongify", reason: "1 mana creature interaction" },
  { name: "Counterspell", reason: "clean stack interaction" },
];

const DRAW_CANDIDATES: Candidate[] = [
  { name: "Mystic Remora", reason: "early draw engine" },
  { name: "Rhystic Study", reason: "high impact draw source" },
  { name: "Fact or Fiction", reason: "instant speed card advantage" },
  { name: "Night's Whisper", reason: "cheap card draw" },
  { name: "Read the Bones", reason: "selection + draw" },
];

function colorLegal(candidateColors: string[], commanderColors: Set<string>) {
  if (commanderColors.size === 0) return true;
  return candidateColors.every((c) => commanderColors.has(c));
}

export function BudgetTuner({ deck }: { deck: Deck }) {
  const [targetBudget, setTargetBudget] = React.useState<string>("200");
  const [priceMap, setPriceMap] = React.useState<Record<string, number | null>>({});
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isHydratingEstimate, setIsHydratingEstimate] = React.useState(false);
  const [priceProgress, setPriceProgress] = React.useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [suggestions, setSuggestions] = React.useState<
    { card: ScryfallCard; price: number; reason: string; impact: number }[]
  >([]);
  const [hovered, setHovered] = React.useState<ScryfallCard | null>(null);
  const hydrationStateRef = React.useRef<{
    deckSignature: string;
    attemptedIds: Set<string>;
  }>({
    deckSignature: "",
    attemptedIds: new Set<string>(),
  });
  const stats = React.useMemo(() => computeDeckStats(deck), [deck]);
  const deckSignature = React.useMemo(
    () =>
      deck.entries
        .map((e) => `${e.card.id}:${e.count}`)
        .sort()
        .join("|"),
    [deck.entries]
  );

  const currentDeckPrice = React.useMemo(() => {
    return deck.entries.reduce((sum, e) => {
      const p =
        priceMap[e.card.id] !== undefined
          ? priceMap[e.card.id]
          : e.card.price_usd ?? null;
      return sum + (p ?? 0) * e.count;
    }, 0);
  }, [deck.entries, priceMap]);

  const pricedCardCount = React.useMemo(() => {
    return deck.entries.filter((e) => {
      const p =
        priceMap[e.card.id] !== undefined
          ? priceMap[e.card.id]
          : e.card.price_usd ?? null;
      return p !== null && p !== undefined;
    }).length;
  }, [deck.entries, priceMap]);

  const totalUniqueCount = deck.entries.length;
  const coverageRatio =
    totalUniqueCount > 0 ? pricedCardCount / totalUniqueCount : 0;
  const priceProgressPct =
    priceProgress.total > 0
      ? Math.round((priceProgress.done / priceProgress.total) * 100)
      : 0;
  const confidenceLabel =
    coverageRatio >= 0.95
      ? "High confidence"
      : coverageRatio >= 0.75
        ? "Medium confidence"
        : "Low confidence";

  const overBy = Math.max(0, currentDeckPrice - Number(targetBudget || 0));

  const profileNeed = React.useMemo(() => {
    return {
      needRamp: Math.max(0, 10 - stats.rampCount),
      needInteraction: Math.max(0, 10 - stats.interactionCount),
      needCurve: stats.avgCmcNonLands > 3.3 ? 1 : 0,
    };
  }, [stats.rampCount, stats.interactionCount, stats.avgCmcNonLands]);

  const cutSuggestions = React.useMemo(() => {
    const allCuts = deck.entries
      .filter((e) => !isLand(e.card))
      .map((e) => {
        const price =
          (priceMap[e.card.id] !== undefined
            ? priceMap[e.card.id]
            : e.card.price_usd) ?? 0;
        const rolePenalty =
          (isRamp(e.card) ? 0.45 : 0) +
          (isInteraction(e.card) ? 0.45 : 0) +
          (e.card.cmc <= 2 ? 0.2 : 0);
        const powerTax = Math.max(0, rolePenalty);
        const impact =
          price > 0
            ? Math.max(0, Math.min(1, (price / 40) * (1 - powerTax)))
            : Math.max(0, Math.min(1, (e.card.cmc - 2) / 5));
        return { ...e, price, impact };
      })
      .sort((a, b) => b.impact - a.impact);

    // If no reliable pricing exists, still provide structural cuts by CMC.
    if (allCuts.every((c) => c.price <= 0)) {
      return allCuts.slice(0, 12);
    }

    return deck.entries
      .flatMap((e) => allCuts.filter((c) => c.card.id === e.card.id))
      .slice(0, 12);
  }, [deck.entries, priceMap]);

  const refreshPrices = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const next: Record<string, number | null> = {};
      setPriceProgress({ done: 0, total: deck.entries.length });
      let done = 0;
      for (const e of deck.entries) {
        try {
          const card = await fetchCardById(e.card.id);
          next[e.card.id] = card.price_usd ?? null;
        } catch {
          next[e.card.id] = e.card.price_usd ?? null;
        }
        done += 1;
        setPriceProgress({ done, total: deck.entries.length });
      }
      setPriceMap(next);
    } finally {
      setIsRefreshing(false);
      setPriceProgress({ done: 0, total: 0 });
    }
  }, [deck.entries]);

  React.useEffect(() => {
    let active = true;
    if (hydrationStateRef.current.deckSignature !== deckSignature) {
      hydrationStateRef.current = {
        deckSignature,
        attemptedIds: new Set<string>(),
      };
    }

    const unresolved = deck.entries.filter((e) => {
      const p =
        priceMap[e.card.id] !== undefined
          ? priceMap[e.card.id]
          : e.card.price_usd ?? null;
      if (p !== null && p !== undefined) return false;
      return !hydrationStateRef.current.attemptedIds.has(e.card.id);
    });
    if (unresolved.length === 0) return;

    (async () => {
      setIsHydratingEstimate(true);
      try {
        const next: Record<string, number | null> = {};
        setPriceProgress({ done: 0, total: unresolved.length });
        let done = 0;
        for (const e of unresolved) {
          hydrationStateRef.current.attemptedIds.add(e.card.id);
          try {
            const card = await fetchCardById(e.card.id);
            next[e.card.id] = card.price_usd ?? null;
          } catch {
            next[e.card.id] = e.card.price_usd ?? null;
          }
          done += 1;
          setPriceProgress({ done, total: unresolved.length });
        }
        if (active) {
          setPriceMap((prev) => ({ ...prev, ...next }));
        }
      } finally {
        if (active) setIsHydratingEstimate(false);
        if (active) setPriceProgress({ done: 0, total: 0 });
      }
    })();

    return () => {
      active = false;
    };
  }, [deck.entries, priceMap, deckSignature]);

  const buildAddSuggestions = React.useCallback(async () => {
    const commander = deck.commanderName
      ? deck.entries.find(
          (e) => e.card.name.toLowerCase() === deck.commanderName!.toLowerCase()
        )?.card
      : undefined;
    const commanderColors = new Set(commander?.color_identity ?? []);
    const pool: Candidate[] = [];
    if (stats.rampCount < 10) pool.push(...RAMP_CANDIDATES);
    if (stats.interactionCount < 10) pool.push(...INTERACTION_CANDIDATES);
    if (stats.avgCmcNonLands > 3.3) pool.push(...DRAW_CANDIDATES);
    if (pool.length === 0) pool.push(...RAMP_CANDIDATES.slice(0, 2), ...INTERACTION_CANDIDATES.slice(0, 2));

    const out: { card: ScryfallCard; price: number; reason: string; impact: number }[] = [];
    const seen = new Set(deck.entries.map((e) => e.card.name.toLowerCase()));
    for (const c of pool) {
      if (seen.has(c.name.toLowerCase())) continue;
      const card = await fetchCardByNameFuzzy(c.name);
      if (!colorLegal(card.color_identity, commanderColors)) continue;
      const p = card.price_usd ?? 0;
      const impact =
        c.reason.includes("ramp")
          ? Math.min(1, 0.5 + profileNeed.needRamp * 0.08)
          : c.reason.includes("interaction") || c.reason.includes("answer")
            ? Math.min(1, 0.5 + profileNeed.needInteraction * 0.08)
            : Math.min(1, 0.45 + profileNeed.needCurve * 0.25);
      out.push({ card, price: p, reason: c.reason, impact });
    }
    out.sort((a, b) => b.impact - a.impact || a.price - b.price);
    setSuggestions(out.slice(0, 10));
  }, [
    deck,
    stats.rampCount,
    stats.interactionCount,
    stats.avgCmcNonLands,
    profileNeed.needRamp,
    profileNeed.needInteraction,
    profileNeed.needCurve,
  ]);

  React.useEffect(() => {
    void buildAddSuggestions();
  }, [buildAddSuggestions]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Budget tuner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Target budget (USD)</div>
                <Input
                  value={targetBudget}
                  onChange={(e) => setTargetBudget(e.target.value)}
                  className="w-36"
                />
              </div>
              <Button variant="outline" onClick={refreshPrices} disabled={isRefreshing}>
                {isRefreshing ? "Refreshing prices…" : "Refresh prices"}
              </Button>
            </div>

            <div className="rounded border bg-muted/20 p-2">
              <div>Current estimated deck value: ${currentDeckPrice.toFixed(2)}</div>
              <div>Budget target: ${Number(targetBudget || 0).toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">
                Pricing coverage: {pricedCardCount}/{totalUniqueCount} unique cards
                {isHydratingEstimate ? " (updating…)" : ""}
              </div>
              {isHydratingEstimate || isRefreshing ? (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      Fetching card prices: {priceProgress.done}/{priceProgress.total}
                    </span>
                    <span>{priceProgressPct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded bg-muted">
                    <div
                      className="h-2 rounded bg-primary transition-all duration-300"
                      style={{ width: `${priceProgressPct}%` }}
                    />
                  </div>
                </div>
              ) : null}
            <div className="mt-2 rounded border bg-background/70 px-2 py-1 text-xs text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Impact if cut</span>: estimated value
                of removing that card for budget reduction while preserving deck function. Higher %
                generally means a stronger budget-saving cut candidate.
              </div>
              <div className="mt-1">
                <span className="font-medium text-foreground">Impact if added</span>: estimated value
                of adding that card based on your deck's current needs (ramp, interaction, curve)
                and legality. Higher % generally means better upgrade fit right now.
              </div>
            </div>
              <div
                className={
                  confidenceLabel === "High confidence"
                    ? "text-xs text-emerald-600"
                    : confidenceLabel === "Medium confidence"
                      ? "text-xs text-amber-600"
                      : "text-xs text-destructive"
                }
              >
                {confidenceLabel}
              </div>
              <div className={overBy > 0 ? "text-destructive" : "text-emerald-600"}>
                {overBy > 0 ? `Over budget by $${overBy.toFixed(2)}` : "Within budget"}
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-medium">Suggested cuts</div>
              <div className="max-h-64 overflow-auto rounded border">
                {cutSuggestions.map((c) => (
                  <div
                    key={c.card.id}
                    className="border-b px-2 py-1 last:border-b-0"
                    onMouseEnter={() => setHovered(c.card)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={c.card.scryfall_uri}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate pr-2 underline-offset-2 hover:underline"
                      >
                        {c.card.name}
                      </a>
                      <span>${c.price.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Impact if cut: {(c.impact * 100).toFixed(0)}%
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-2 text-xs">
                      {c.card.purchase_uris?.tcgplayer ? (
                        <a
                          href={c.card.purchase_uris.tcgplayer}
                          target="_blank"
                          rel="noreferrer"
                          className="underline-offset-2 hover:underline"
                        >
                          Buy (TCGplayer)
                        </a>
                      ) : null}
                      {c.card.purchase_uris?.cardmarket ? (
                        <a
                          href={c.card.purchase_uris.cardmarket}
                          target="_blank"
                          rel="noreferrer"
                          className="underline-offset-2 hover:underline"
                        >
                          Buy (Cardmarket)
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded border bg-muted/20 p-2">
              {hovered?.image_url_large || hovered?.image_url ? (
                <div className="space-y-2">
                  <img
                    src={hovered?.image_url_large || hovered?.image_url}
                    alt={hovered?.name ?? "Card preview"}
                    className="mx-auto h-auto max-h-[360px] w-auto rounded-md border object-contain"
                  />
                  <div className="text-sm font-medium">{hovered?.name}</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {hovered?.scryfall_uri ? (
                      <a
                        href={hovered.scryfall_uri}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-2 hover:underline"
                      >
                        View on Scryfall
                      </a>
                    ) : null}
                    {hovered?.purchase_uris?.tcgplayer ? (
                      <a
                        href={hovered.purchase_uris.tcgplayer}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-2 hover:underline"
                      >
                        Buy on TCGplayer
                      </a>
                    ) : null}
                    {hovered?.purchase_uris?.cardmarket ? (
                      <a
                        href={hovered.purchase_uris.cardmarket}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-2 hover:underline"
                      >
                        Buy on Cardmarket
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Hover a suggested card to preview.
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="font-medium">Suggested adds</div>
              <div className="max-h-64 overflow-auto rounded border">
                {suggestions.map((s) => (
                  <div
                    key={s.card.name}
                    className="border-b px-2 py-1 last:border-b-0"
                    onMouseEnter={() => setHovered(s.card)}
                  >
                    <div className="flex items-center justify-between">
                      <a
                        href={s.card.scryfall_uri}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate pr-2 underline-offset-2 hover:underline"
                      >
                        {s.card.name}
                      </a>
                      <span>${s.price.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{s.reason}</div>
                    <div className="text-xs text-muted-foreground">
                      Impact if added: {(s.impact * 100).toFixed(0)}%
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-2 text-xs">
                      {s.card.purchase_uris?.tcgplayer ? (
                        <a
                          href={s.card.purchase_uris.tcgplayer}
                          target="_blank"
                          rel="noreferrer"
                          className="underline-offset-2 hover:underline"
                        >
                          Buy (TCGplayer)
                        </a>
                      ) : null}
                      {s.card.purchase_uris?.cardmarket ? (
                        <a
                          href={s.card.purchase_uris.cardmarket}
                          target="_blank"
                          rel="noreferrer"
                          className="underline-offset-2 hover:underline"
                        >
                          Buy (Cardmarket)
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Prices come from Scryfall and can be refreshed any time. Suggestions are based on
          current deck stats and commander color identity legality. Impact % is a weighted
          recommendation score based on current deck deficiencies and card role/cost.
        </div>
      </CardContent>
    </Card>
  );
}

