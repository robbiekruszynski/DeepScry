"use client";

import * as React from "react";

import type { Deck } from "@/lib/deck";
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

export function OverviewTab({ deck }: { deck: Deck }) {
  const stats = React.useMemo(() => computeDeckStats(deck), [deck]);

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
    </div>
  );
}

