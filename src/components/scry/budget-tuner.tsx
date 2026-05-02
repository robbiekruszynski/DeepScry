"use client";

import * as React from "react";

import type { Deck } from "@/lib/deck";
import type { ScryfallCard } from "@/lib/scryfall";
import { fetchCardById, searchCards } from "@/lib/scryfall";
import { computeDeckStats } from "@/lib/stats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Candidate = {
  name: string;
  reason: string;
  /** Used for impact scoring and “why this add” copy */
  category: "ramp" | "interaction" | "draw";
};

type SearchPlan = {
  query: string;
  reason: string;
  category: Candidate["category"];
};

function colorLegal(candidateColors: string[], commanderColors: Set<string>) {
  if (commanderColors.size === 0) return true;
  return candidateColors.every((c) => commanderColors.has(c));
}

function deckColorIdentity(deck: Deck, commander?: ScryfallCard) {
  const colors = new Set(commander?.color_identity ?? []);
  if (colors.size > 0) return colors;
  for (const entry of deck.entries) {
    for (const color of entry.card.color_identity) colors.add(color);
  }
  return colors;
}

function commanderStrategyPlans(commander?: ScryfallCard): SearchPlan[] {
  if (!commander) return [];
  const text = `${commander.name} ${commander.type_line} ${commander.oracle_text ?? ""}`.toLowerCase();
  const plans: SearchPlan[] = [];

  if (text.includes("+1/+1 counter")) {
    plans.push({
      query: 'o:"+1/+1 counter"',
      reason: `supports ${commander.name}'s +1/+1 counter plan`,
      category: "draw",
    });
  }
  if (text.includes("token")) {
    plans.push({
      query: "o:token",
      reason: `supports ${commander.name}'s token plan`,
      category: "draw",
    });
  }
  if (text.includes("graveyard") || text.includes("mill")) {
    plans.push({
      query: "(o:graveyard or o:mill)",
      reason: `supports ${commander.name}'s graveyard plan`,
      category: "draw",
    });
  }
  if (text.includes("sacrifice") || text.includes("dies")) {
    plans.push({
      query: "(o:sacrifice or o:dies)",
      reason: `supports ${commander.name}'s sacrifice plan`,
      category: "draw",
    });
  }
  if (text.includes("artifact")) {
    plans.push({
      query: "t:artifact",
      reason: `fits ${commander.name}'s artifact strategy`,
      category: "draw",
    });
  }
  if (text.includes("enchantment")) {
    plans.push({
      query: "t:enchantment",
      reason: `fits ${commander.name}'s enchantment strategy`,
      category: "draw",
    });
  }
  if (text.includes("instant") || text.includes("sorcery")) {
    plans.push({
      query: "(t:instant or t:sorcery)",
      reason: `fits ${commander.name}'s spellslinger plan`,
      category: "draw",
    });
  }

  return plans;
}

function describeAddBenefit(
  c: Candidate,
  stats: ReturnType<typeof computeDeckStats>
): string {
  if (c.category === "ramp") {
    return `Ramp is at ${stats.rampCount} (this tool uses ~10 as a loose Commander baseline from card text + tags). ${c.name} helps you deploy your commander and mid-game plays sooner.`;
  }
  if (c.category === "interaction") {
    return `Interaction is at ${stats.interactionCount} (~10 baseline). ${c.name} improves answers to creatures, planeswalkers, and problem permanents so you can survive to your win condition.`;
  }
  return `Nonland average CMC is ${stats.avgCmcNonLands.toFixed(2)} (above ~3.3 triggers draw suggestions). ${c.name} helps you dig for lands and action in longer games.`;
}

/** Split ordered lists into three visual bands: best candidates, middle, weakest. */
function listTier(index: number, length: number): "high" | "mid" | "low" {
  if (length <= 0) return "mid";
  const third = Math.max(1, Math.ceil(length / 3));
  if (index < third) return "high";
  if (index < third * 2) return "mid";
  return "low";
}

const ADD_TIER_ROW: Record<
  "high" | "mid" | "low",
  { row: string; label: string }
> = {
  high: {
    row: "border-l-[3px] border-l-emerald-500 bg-emerald-500/[0.12] dark:bg-emerald-950/35",
    label: "Priority add",
  },
  mid: {
    row: "border-l-[3px] border-l-amber-500 bg-amber-500/[0.12] dark:bg-amber-950/35",
    label: "Consider",
  },
  low: {
    row: "border-l-[3px] border-l-red-500 bg-red-500/[0.12] dark:bg-red-950/35",
    label: "Optional / if owned",
  },
};

export function BudgetTuner({ deck }: { deck: Deck }) {
  const [targetBudget, setTargetBudget] = React.useState<string>("0.00");
  const [priceMap, setPriceMap] = React.useState<Record<string, number | null>>({});
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isHydratingEstimate, setIsHydratingEstimate] = React.useState(false);
  const [priceProgress, setPriceProgress] = React.useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [suggestions, setSuggestions] = React.useState<
    {
      card: ScryfallCard;
      price: number;
      reason: string;
      impact: number;
      category: Candidate["category"];
      deckBenefit: string;
    }[]
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

  const prevDeckSigRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const sigChanged = prevDeckSigRef.current !== deckSignature;
    if (prevDeckSigRef.current === null) {
      prevDeckSigRef.current = deckSignature;
      setTargetBudget("0.00");
      return;
    }
    if (sigChanged) {
      prevDeckSigRef.current = deckSignature;
      setTargetBudget("0.00");
    }
  }, [deckSignature]);

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

  const budgetAmount = Number(targetBudget);
  const budgetNum = Number.isFinite(budgetAmount) ? budgetAmount : 0;
  const priceCeiling = budgetNum > 0 ? budgetNum : null;

  const profileNeed = React.useMemo(() => {
    return {
      needRamp: Math.max(0, 10 - stats.rampCount),
      needInteraction: Math.max(0, 10 - stats.interactionCount),
      needCurve: stats.avgCmcNonLands > 3.3 ? 1 : 0,
    };
  }, [stats.rampCount, stats.interactionCount, stats.avgCmcNonLands]);

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
  }, [deck.entries, deckSignature]); // priceMap intentionally excluded — ref tracks attempted IDs

  const buildAddSuggestions = React.useCallback(async () => {
    const commander = deck.commanderName
      ? deck.entries.find(
          (e) => e.card.name.toLowerCase() === deck.commanderName!.toLowerCase()
        )?.card
      : undefined;
    const commanderColors = deckColorIdentity(deck, commander);
    const colorFilter =
      commanderColors.size > 0
        ? `ci<=${Array.from(commanderColors).join("").toLowerCase()}`
        : "";
    const priceFilter = priceCeiling ? `usd<=${priceCeiling.toFixed(2)}` : "";
    const baseFilter = ["legal:commander", "-t:land", colorFilter, priceFilter]
      .filter(Boolean)
      .join(" ");
    const plans: SearchPlan[] = [];
    if (stats.rampCount < 10) {
      plans.push(
        {
          query: "o:add t:artifact cmc<=3",
          reason: "efficient mana acceleration within your color identity",
          category: "ramp",
        },
        {
          query: 'o:"search your library" o:"land card" cmc<=3',
          reason: "low-cost land ramp within your color identity",
          category: "ramp",
        }
      );
    }
    if (stats.interactionCount < 10) {
      plans.push({
        query: '(o:"destroy target" or o:"exile target" or o:"counter target") cmc<=3',
        reason: "efficient interaction within your color identity",
        category: "interaction",
      });
    }
    if (stats.avgCmcNonLands > 3.3) {
      plans.push({
        query: 'o:"draw a card" cmc<=3',
        reason: "cheap card flow to smooth a higher curve",
        category: "draw",
      });
    }
    plans.push(...commanderStrategyPlans(commander));
    if (plans.length === 0) {
      plans.push(
        {
          query: "o:add t:artifact cmc<=3",
          reason: "efficient mana acceleration within your color identity",
          category: "ramp",
        },
        {
          query: '(o:"destroy target" or o:"exile target" or o:"counter target") cmc<=3',
          reason: "flexible interaction within your color identity",
          category: "interaction",
        }
      );
    }

    const out: {
      card: ScryfallCard;
      price: number;
      reason: string;
      impact: number;
      category: Candidate["category"];
      deckBenefit: string;
    }[] = [];
    const seen = new Set(deck.entries.map((e) => e.card.name.toLowerCase()));
    for (const plan of plans) {
      let cards: ScryfallCard[] = [];
      try {
        cards = await searchCards(`${baseFilter} ${plan.query}`);
      } catch {
        continue;
      }

      for (const card of cards.slice(0, 8)) {
        if (seen.has(card.name.toLowerCase())) continue;
        if (!colorLegal(card.color_identity, commanderColors)) continue;
        if (priceCeiling !== null && card.price_usd === null) continue;
        const p = card.price_usd ?? 0;
        if (priceCeiling !== null && p > priceCeiling) continue;
        const impact =
          plan.category === "ramp"
            ? Math.min(1, 0.5 + profileNeed.needRamp * 0.08)
            : plan.category === "interaction"
              ? Math.min(1, 0.5 + profileNeed.needInteraction * 0.08)
              : Math.min(1, 0.45 + profileNeed.needCurve * 0.25);
        const candidate = {
          name: card.name,
          reason: plan.reason,
          category: plan.category,
        };
        seen.add(card.name.toLowerCase());
        out.push({
          card,
          price: p,
          reason: plan.reason,
          impact,
          category: plan.category,
          deckBenefit: describeAddBenefit(candidate, stats),
        });
      }
    }
    out.sort((a, b) => b.impact - a.impact || a.price - b.price);
    setSuggestions(out.slice(0, 10));
  }, [
    deck,
    stats.rampCount,
    stats.interactionCount,
    stats.avgCmcNonLands,
    priceCeiling,
    profileNeed.needRamp,
    profileNeed.needInteraction,
    profileNeed.needCurve,
  ]);

  const deckSignatureForSuggestions = deckSignature;
  React.useEffect(() => {
    void buildAddSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckSignatureForSuggestions, priceCeiling]);

  const addCount = suggestions.length;

  const previewPanel = (
    <div
      className="rounded-lg border bg-muted/30 p-2 shadow-sm backdrop-blur-sm lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
      aria-live="polite"
    >
      {hovered?.image_url_large || hovered?.image_url ? (
        <div className="space-y-2">
          <img
            src={hovered?.image_url_large || hovered?.image_url}
            alt={hovered?.name ?? "Card preview"}
            className="mx-auto h-auto max-h-[min(320px,calc(100vh-10rem))] w-auto rounded-md border object-contain"
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
        <div className="flex min-h-[160px] items-center justify-center px-2 text-center text-xs text-muted-foreground lg:min-h-[200px]">
          Hover a suggested add to preview.
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Budget tuner</CardTitle>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Set a per-card price ceiling for suggested upgrades. Leave it at 0 for unlimited/no
          budget, or enter a cap like 10 or 50. Suggestions are searched through Scryfall with
          your deck’s color identity, commander strategy, and cards you already own excluded.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-x-6">
          {/* Left column: controls + mobile preview + suggestions */}
          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Price ceiling per card (USD)</div>
                  <Input
                    value={targetBudget}
                    onChange={(e) => setTargetBudget(e.target.value)}
                    className="w-36"
                    inputMode="decimal"
                    aria-label="Price ceiling in US dollars"
                  />
                  <div className="text-[11px] text-muted-foreground">Use 0 for no budget cap.</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs"
                  onClick={() => setTargetBudget("0.00")}
                >
                  No price cap
                </Button>
                <Button variant="outline" onClick={refreshPrices} disabled={isRefreshing}>
                  {isRefreshing ? "Refreshing prices…" : "Refresh prices"}
                </Button>
              </div>

              <div className="rounded border bg-muted/20 p-3 space-y-1">
                <div className="flex items-baseline gap-2">
                  <span>
                    Estimated deck value:{" "}
                    <span className="font-semibold">
                      {isHydratingEstimate
                        ? "loading…"
                        : `$${currentDeckPrice.toFixed(2)}`}
                    </span>
                  </span>
                  {isHydratingEstimate ? null : coverageRatio < 0.75 ? (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      (partial — {pricedCardCount}/{totalUniqueCount} cards priced)
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  Pricing coverage: {pricedCardCount}/{totalUniqueCount} unique cards
                </div>
                {isHydratingEstimate || isRefreshing ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        Fetching prices: {priceProgress.done}/{priceProgress.total}
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
                <div
                  className={
                    confidenceLabel === "High confidence"
                      ? "text-xs text-emerald-600 dark:text-emerald-500"
                      : confidenceLabel === "Medium confidence"
                        ? "text-xs text-amber-600 dark:text-amber-500"
                        : "text-xs text-destructive"
                  }
                >
                  {isHydratingEstimate ? "Fetching prices from Scryfall…" : confidenceLabel}
                </div>
                <div className="text-xs text-muted-foreground">
                  Suggestion price cap:{" "}
                  {priceCeiling === null || priceCeiling <= 0.01
                    ? "No ceiling (unlimited)"
                    : `$${priceCeiling.toFixed(2)} per card`}
                </div>
              </div>

              <div className="rounded border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Impact if added</span>: fit for
                current gaps (ramp, interaction, curve), commander strategy, color identity, and
                your price ceiling. Higher % is a stronger upgrade candidate for this list.
              </div>
            </div>

            {/* Mobile-only preview */}
            <div className="lg:hidden">{previewPanel}</div>

            <div className="space-y-2">
              <div>
                <div className="font-medium">Suggested adds</div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Green = priority add · Orange = consider · Red = optional / nice-to-have if you
                  already own it. Suggested adds never include cards already in your decklist.
                </p>
              </div>
              <div className="rounded border">
                {suggestions.map((s, idx) => {
                  const tier = listTier(idx, addCount);
                  const tierStyle = ADD_TIER_ROW[tier];
                  const withinPriceCeiling =
                    priceCeiling !== null && s.price <= priceCeiling + 0.005;
                  return (
                    <div
                      key={s.card.name}
                      className={`border-b px-2 py-2 last:border-b-0 ${tierStyle.row}`}
                      onMouseEnter={() => setHovered(s.card)}
                    >
                      <div className="mb-0.5 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground">
                          {tierStyle.label}
                        </span>
                        {withinPriceCeiling ? (
                          <span className="rounded border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                            Within price cap
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <a
                          href={s.card.scryfall_uri}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate pr-2 underline-offset-2 hover:underline"
                        >
                          {s.card.name}
                        </a>
                        <span className="shrink-0">${s.price.toFixed(2)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{s.reason}</div>
                      <div className="text-xs text-muted-foreground">
                        Impact if added: {(s.impact * 100).toFixed(0)}%
                      </div>
                      <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                        <span className="font-medium text-foreground/90">How this helps: </span>
                        {s.deckBenefit}
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
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right column: sticky preview (desktop only) */}
          <div className="hidden lg:sticky lg:top-28 lg:z-20 lg:block lg:w-[280px] lg:shrink-0 lg:self-start">
            {previewPanel}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Prices come from Scryfall and can be refreshed any time.
        </div>
      </CardContent>
    </Card>
  );
}

