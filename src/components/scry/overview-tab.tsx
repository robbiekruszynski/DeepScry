"use client";

import * as React from "react";

import type { CardTagMap, Deck } from "@/lib/deck";
import { BudgetTuner } from "@/components/scry/budget-tuner";
import {
  deckHealthWarnings,
  deckBenchmarkScores,
  simulateCurveProbabilities,
  colorIdentityViolations,
} from "@/lib/commander-tools";
import {
  computeDeckStats,
  isArtifact,
  isCreature,
  isEnchantment,
  isInstant,
  isLand,
  isSorcery,
} from "@/lib/stats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {hint ? (
          <div className="mt-2 text-sm text-muted-foreground">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function OverviewTab({
  deck,
  tagMap,
  onRemoveCard,
  onEditImport,
  onStartOver,
}: {
  deck: Deck;
  tagMap: CardTagMap;
  onRemoveCard: (cardId: string) => void;
  onEditImport: () => void;
  onStartOver: () => void;
}) {
  const [isCommanderPreviewOpen, setIsCommanderPreviewOpen] = React.useState(false);
  const stats = React.useMemo(() => computeDeckStats(deck), [deck]);
  const warnings = React.useMemo(() => deckHealthWarnings(deck), [deck]);
  const benchmarkScores = React.useMemo(() => deckBenchmarkScores(deck), [deck]);
  const violations = React.useMemo(() => colorIdentityViolations(deck), [deck]);
  const curveOdds = React.useMemo(() => simulateCurveProbabilities(deck, 1200), [
    deck,
    tagMap,
  ]);
  const commanderEntry = React.useMemo(() => {
    if (!deck.commanderName) return null;
    const commanderName = deck.commanderName.toLowerCase();
    return (
      deck.entries.find((entry) => entry.card.name.toLowerCase() === commanderName) ??
      null
    );
  }, [deck.commanderName, deck.entries]);
  const groupedDecklist = React.useMemo(() => {
    const groups = [
      { label: "Creatures", test: isCreature },
      { label: "Instants", test: isInstant },
      { label: "Sorceries", test: isSorcery },
      { label: "Artifacts", test: isArtifact },
      { label: "Enchantments", test: isEnchantment },
      { label: "Lands", test: isLand },
    ];
    const assigned = new Set<string>();
    const out = groups.map((group) => {
      const entries = deck.entries
        .filter((entry) => {
          if (assigned.has(entry.card.id) || !group.test(entry.card)) return false;
          assigned.add(entry.card.id);
          return true;
        })
        .sort((a, b) => a.card.name.localeCompare(b.card.name));

      return {
        label: group.label,
        count: entries.reduce((sum, entry) => sum + entry.count, 0),
        entries,
      };
    });
    const otherEntries = deck.entries
      .filter((entry) => !assigned.has(entry.card.id))
      .sort((a, b) => a.card.name.localeCompare(b.card.name));
    if (otherEntries.length) {
      out.push({
        label: "Other",
        count: otherEntries.reduce((sum, entry) => sum + entry.count, 0),
        entries: otherEntries,
      });
    }
    return out.filter((group) => group.entries.length > 0);
  }, [deck.entries]);

  const commanderPreviewPanel = (
    <div
      className="rounded-lg border bg-muted/30 p-2 shadow-sm backdrop-blur-sm"
      aria-live="polite"
    >
      {isCommanderPreviewOpen &&
      (commanderEntry?.card.image_url_large || commanderEntry?.card.image_url) ? (
        <div className="space-y-2">
          <img
            src={commanderEntry.card.image_url_large || commanderEntry.card.image_url}
            alt={`${commanderEntry.card.name} preview`}
            className="mx-auto h-auto max-h-[320px] w-auto rounded-md border object-contain"
          />
          <div className="text-sm font-medium">{commanderEntry.card.name}</div>
          <div className="text-xs text-muted-foreground">{commanderEntry.card.type_line}</div>
          {commanderEntry.card.scryfall_uri ? (
            <a
              href={commanderEntry.card.scryfall_uri}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline-offset-2 hover:underline"
            >
              View on Scryfall
            </a>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-[180px] items-center justify-center px-2 text-center text-xs text-muted-foreground">
          Hover the commander to preview.
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-4">
      <Card className="overflow-visible">
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div
            className="relative flex min-w-0 gap-3 outline-none"
            tabIndex={commanderEntry ? 0 : undefined}
            onMouseEnter={() => setIsCommanderPreviewOpen(true)}
            onFocus={() => setIsCommanderPreviewOpen(true)}
          >
            {commanderEntry?.card.image_url ? (
              <img
                src={commanderEntry.card.image_url}
                alt={commanderEntry.card.name}
                className="h-20 w-14 shrink-0 rounded border object-cover transition-transform hover:-translate-y-0.5"
              />
            ) : null}
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Commander
              </div>
              <div className="truncate text-xl font-semibold">
                {deck.commanderName ?? "No commander set"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {commanderEntry?.card.type_line ??
                  "Set a commander in Import to enable color identity checks."}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{stats.uniqueCards} unique</Badge>
                <Badge variant="secondary">{stats.totalCards} total</Badge>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {commanderPreviewPanel}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onEditImport}>
                Edit / re-import
              </Button>
              <Button variant="secondary" onClick={onStartOver}>
                Start over
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Ramp and interaction are automatically classified from card text and tags.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total cards" value={stats.totalCards} />
        <StatCard
          title="Lands"
          value={stats.landCount}
          hint={`${stats.landPercent.toFixed(1)}%`}
        />
        <StatCard
          title="Average CMC (non-lands)"
          value={stats.avgCmcNonLands.toFixed(2)}
        />
        <StatCard title="Creatures" value={stats.creatureCount} />
        <StatCard title="Ramp" value={stats.rampCount} />
        <StatCard title="Interaction" value={stats.interactionCount} />
      </div>

      <Card>
        <details>
          <summary className="cursor-pointer list-none px-4 text-base font-medium [&::-webkit-details-marker]:hidden">
            Decklist ({stats.totalCards} cards)
          </summary>
          <CardContent className="mt-3 space-y-4">
            {groupedDecklist.map((group) => (
              <div key={group.label} className="space-y-2">
                <div className="flex items-center justify-between border-b pb-1 text-sm font-medium">
                  <span>{group.label}</span>
                  <Badge variant="secondary">{group.count}</Badge>
                </div>
                <div className="space-y-1">
                  {group.entries.map((entry) => (
                    <div
                      key={entry.card.id}
                      className="flex items-center justify-between gap-3 rounded border bg-muted/20 px-2 py-1.5 text-sm"
                    >
                      <div className="min-w-0">
                        <span className="truncate">{entry.card.name}</span>
                        {entry.count > 1 ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            x{entry.count}
                          </span>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${entry.card.name}`}
                        onClick={() => onRemoveCard(entry.card.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </details>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What these counts mean</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Metric</TableHead>
                <TableHead>What it means for deckbuilding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium text-foreground">
                  Total cards
                </TableCell>
                <TableCell>
                  Total list size. Commander lists are typically 100 cards.
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-foreground">
                  Lands / Land %
                </TableCell>
                <TableCell>
                  Mana base density. Too low can cause missed land drops; too high can reduce spell
                  density.
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-foreground">
                  Average CMC
                </TableCell>
                <TableCell>
                  Average mana value of nonland cards. Higher values usually mean slower starts.
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-foreground">
                  Creatures
                </TableCell>
                <TableCell>
                  Number of creature cards; indicates board presence and combat focus.
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-foreground">Ramp</TableCell>
                <TableCell>
                  Cards that increase available mana (rocks, land ramp, treasure generation, etc.).
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-foreground">
                  Interaction
                </TableCell>
                <TableCell>
                  Cards that answer threats (removal, counters, bounce, damage-based answers).
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Deck health vs benchmark metas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="text-xs leading-relaxed text-muted-foreground">
              These profiles are reference targets for common Commander environments (precon,
              upgraded precon, local tournament, and cEDH-style). The score compares your deck's
              lands, ramp, interaction, and average CMC to each profile. Higher percentages mean
              your current build structure is closer to that environment's typical pacing and
              density.
            </div>
            {benchmarkScores.map((b) => {
              const pct = Math.round(b.score * 100);
              return (
                <div key={b.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>{b.label}</span>
                    <span className="font-medium text-foreground">{pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded bg-muted">
                    <div
                      className="h-2 rounded bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="rounded border bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
              Benchmarks compare: lands, ramp, interaction, and average CMC.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Deck health notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {warnings.length === 0 ? (
              <div className="space-y-2 text-muted-foreground">
                <div>No major warnings detected.</div>
                <div className="rounded border bg-muted/20 px-2 py-1 text-xs">
                  Example warnings you might see in other lists: low ramp density, low interaction
                  density, average CMC too high for the selected benchmark, or non-100 card deck
                  size.
                </div>
              </div>
            ) : (
              warnings.map((w, idx) => (
                <div
                  key={`${w.text}-${idx}`}
                  className={
                    w.tone === "concern"
                      ? "rounded border border-red-500/45 bg-red-500/10 px-2 py-1.5 text-foreground shadow-[inset_3px_0_0_0_rgba(239,68,68,0.75)] dark:bg-red-950/35"
                      : w.tone === "positive"
                        ? "rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-foreground shadow-[inset_3px_0_0_0_rgba(34,197,94,0.75)] dark:bg-emerald-950/30"
                        : "rounded border border-border/80 bg-muted/25 px-2 py-1.5 text-muted-foreground"
                  }
                >
                  {w.text}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Commander legality</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!deck.commanderName ? (
              <div className="text-muted-foreground">
                Set a commander in Import to run color identity checks.
              </div>
            ) : violations.length === 0 ? (
              <div className="text-muted-foreground">
                No off-color cards detected for commander identity.
              </div>
            ) : (
              <>
                <div className="text-destructive">
                  {violations.length} off-color card(s) detected.
                </div>
                <div className="max-h-28 overflow-auto rounded border px-2 py-1 text-muted-foreground">
                  {violations.slice(0, 30).join(", ")}
                  {violations.length > 30 ? "…" : ""}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">On-curve mana odds (simulated)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {([1, 2, 3, 4] as const).map((turn) => (
            <div key={turn} className="rounded border px-3 py-2">
              <div className="text-xs text-muted-foreground">By turn {turn}</div>
              <div className="text-xl font-semibold">
                {(curveOdds[turn] * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">
                Hit at least {turn} land{turn === 1 ? "" : "s"}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <BudgetTuner deck={deck} />
    </div>
  );
}

