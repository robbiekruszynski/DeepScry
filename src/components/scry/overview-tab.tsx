"use client";

import * as React from "react";

import type { CardTagMap, Deck } from "@/lib/deck";
import {
  deckHealthWarnings,
  simulateCurveProbabilities,
  colorIdentityViolations,
} from "@/lib/commander-tools";
import { computeDeckStats } from "@/lib/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
}: {
  deck: Deck;
  tagMap: CardTagMap;
}) {
  const stats = React.useMemo(() => computeDeckStats(deck), [deck]);
  const warnings = React.useMemo(() => deckHealthWarnings(deck), [deck]);
  const violations = React.useMemo(() => colorIdentityViolations(deck), [deck]);
  const curveOdds = React.useMemo(() => simulateCurveProbabilities(deck, 1200), [
    deck,
    tagMap,
  ]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">{stats.uniqueCards} unique</Badge>
        <Badge variant="secondary">{stats.totalCards} total</Badge>
        <span className="text-xs">
          Ramp/interaction are best-effort heuristics (based on oracle text).
        </span>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Deck health warnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {warnings.length === 0 ? (
              <div className="text-muted-foreground">No major warnings detected.</div>
            ) : (
              warnings.map((w, idx) => (
                <div
                  key={`${w.text}-${idx}`}
                  className={
                    w.level === "warn"
                      ? "rounded border border-destructive/50 bg-destructive/10 px-2 py-1"
                      : "rounded border border-border px-2 py-1 text-muted-foreground"
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
    </div>
  );
}

