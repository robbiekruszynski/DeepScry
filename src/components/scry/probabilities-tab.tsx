"use client";

import * as React from "react";

import type { CardTag, CardTagMap, Deck } from "@/lib/deck";
import { computeProbabilities } from "@/lib/analysis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TAGS: CardTag[] = ["ramp", "interaction", "draw", "wincon"];

export function ProbabilitiesTab({
  deck,
  tagMap,
  onTagMapChange,
}: {
  deck: Deck;
  tagMap: CardTagMap;
  onTagMapChange: React.Dispatch<React.SetStateAction<CardTagMap>>;
}) {
  const rows = React.useMemo(() => computeProbabilities(deck, tagMap), [deck, tagMap]);
  const [query, setQuery] = React.useState("");
  const [isTagHelpOpen, setIsTagHelpOpen] = React.useState(false);
  const taggedCards = Object.keys(tagMap).length;

  const visibleEntries = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return deck.entries
      .filter((e) => (q ? e.card.name.toLowerCase().includes(q) : true))
      .slice(0, 30);
  }, [deck.entries, query]);

  const toggleTag = (cardId: string, tag: CardTag) => {
    onTagMapChange((prev) => {
      const existing = prev[cardId] ?? [];
      const next = existing.includes(tag)
        ? existing.filter((t) => t !== tag)
        : [...existing, tag];
      if (next.length === 0) {
        const clone = { ...prev };
        delete clone[cardId];
        return clone;
      }
      return { ...prev, [cardId]: next };
    });
  };

  return (
    <div className="space-y-4">
      {isTagHelpOpen ? (
        <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
          <div className="font-medium text-foreground">How tags affect probabilities</div>
          <div className="mt-1">
            DeepScry automatically classifies cards as ramp, interaction, draw, or wincons by
            reading card text — but it isn't always right for your specific deck. Manual tags let
            you override or add to that classification.
          </div>
          <div className="mt-1">
            Clicking a grey tag adds that card to the category. Clicking a lit tag removes it. The
            probability table updates live as you tag.
          </div>
          <div className="mt-1">
            Win condition odds only appear once DeepScry detects a known combo in your list, or you
            tag at least one card as [wincon].
          </div>
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Scenario</TableHead>
            <TableHead className="w-1/2">Probability</TableHead>
            <TableHead className="text-right">Percent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const pct = Math.max(0, Math.min(100, r.probability * 100));
            return (
              <TableRow key={r.label}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell>
                  <div className="h-2 w-full rounded bg-muted">
                    <div
                      className="h-2 rounded bg-primary"
                      style={{ width: `${pct.toFixed(2)}%` }}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right">{pct.toFixed(2)}%</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">
            Manual card tags{" "}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-expanded={isTagHelpOpen}
              aria-label="Toggle manual card tags explanation"
              onClick={() => setIsTagHelpOpen((open) => !open)}
            >
              (?)
            </Button>
          </div>
          <Input
            placeholder="Filter card names..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          Currently tagged cards: <span className="font-medium text-foreground">{taggedCards}</span>
        </div>
        <div className="max-h-64 space-y-2 overflow-auto">
          {visibleEntries.map((e) => (
            <div
              key={e.card.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1.5"
            >
              <div className="text-sm">{e.card.name}</div>
              <div className="flex flex-wrap gap-1">
                {TAGS.map((tag) => (
                  <Button
                    key={`${e.card.id}-${tag}`}
                    variant={
                      (tagMap[e.card.id] ?? []).includes(tag)
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    onClick={() => toggleTag(e.card.id, tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
          <span>Active tags:</span>
          {Object.entries(tagMap).length === 0 ? (
            <Badge variant="secondary">none</Badge>
          ) : (
            Object.entries(tagMap).slice(0, 8).map(([id, tags]) => (
              <Badge key={id} variant="secondary">
                {tags.join(",")}
              </Badge>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

