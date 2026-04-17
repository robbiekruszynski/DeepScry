"use client";

import * as React from "react";

import {
  buildEntries,
  parseDecklist,
  type Deck,
  type DeckArchetype,
} from "@/lib/deck";
import {
  fetchCardByNameFuzzy,
  getCachedCardByName,
  type ScryfallCard,
} from "@/lib/scryfall";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type ImportResult = {
  deck: Deck | null;
  errors: string[];
};

export function ImportTab({
  deck,
  onDeckChange,
}: {
  deck: Deck | null;
  onDeckChange: (next: Deck | null) => void;
}) {
  const [text, setText] = React.useState<string>("");
  const [commanderName, setCommanderName] = React.useState<string>("");
  const [archetype, setArchetype] = React.useState<DeckArchetype>("midrange");
  const [isImporting, setIsImporting] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number }>(
    { done: 0, total: 0 }
  );
  const [errors, setErrors] = React.useState<string[]>([]);

  async function runImport(): Promise<ImportResult> {
    const parsed = parseDecklist(text);
    if (parsed.errors.length) return { deck: null, errors: parsed.errors };

    const commanderInput = commanderName.trim();
    const namesToResolve = parsed.lines.map((l) => l.name);
    if (commanderInput) namesToResolve.push(commanderInput);

    const uniqueNames = Array.from(new Set(namesToResolve));
    setProgress({ done: 0, total: uniqueNames.length });

    const cardsByRequestedName = new Map<string, ScryfallCard>();

    let done = 0;
    for (const name of uniqueNames) {
      const cached = getCachedCardByName(name);
      const card = cached ?? (await fetchCardByNameFuzzy(name));
      cardsByRequestedName.set(name, card);
      done += 1;
      setProgress({ done, total: uniqueNames.length });
    }

    const { entries, missingNames } = buildEntries(cardsByRequestedName, parsed.lines);
    if (missingNames.length) {
      return {
        deck: null,
        errors: [
          `Could not match ${missingNames.length} card name(s) after fetch: ${missingNames.slice(0, 8).join(", ")}${missingNames.length > 8 ? "…" : ""}`,
        ],
      };
    }
    if (entries.length === 0 && parsed.lines.length > 0) {
      return {
        deck: null,
        errors: ["Deck resolved to zero cards. Check the decklist format and try again."],
      };
    }

    if (commanderInput) {
      const commanderCard = cardsByRequestedName.get(commanderInput);
      if (!commanderCard) {
        return {
          deck: null,
          errors: [`Could not resolve commander: ${commanderInput}`],
        };
      }

      const alreadyInDeck = entries.some((e) => e.card.id === commanderCard.id);
      if (!alreadyInDeck) {
        entries.push({ card: commanderCard, count: 1 });
        entries.sort((a, b) => a.card.name.localeCompare(b.card.name));
      }
    }

    return {
      deck: {
        entries,
        commanderName: commanderInput || undefined,
        archetype,
      },
      errors: [],
    };
  }

  async function onImportClick() {
    setIsImporting(true);
    setErrors([]);
    try {
      const res = await runImport();
      setErrors(res.errors);
      onDeckChange(res.deck);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrors([msg]);
      onDeckChange(null);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Import decklist</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="commander">Commander (optional)</Label>
            <Input
              id="commander"
              placeholder="Atraxa, Praetors' Voice"
              value={commanderName}
              onChange={(e) => setCommanderName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="archetype">Archetype</Label>
            <select
              id="archetype"
              value={archetype}
              onChange={(e) => setArchetype(e.target.value as DeckArchetype)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="midrange">Midrange</option>
              <option value="ramp">Ramp</option>
              <option value="aggro">Aggro</option>
              <option value="control">Control</option>
              <option value="combo">Combo</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="decklist">Decklist</Label>
            <Textarea
              id="decklist"
              placeholder={
                "Paste Moxfield plain text export here.\nExample:\n1 Sol Ring\n1 Command Tower\n1 Swords to Plowshares"
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-48"
            />
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">Moxfield: Copy → Plain Text</Badge>
              <Badge variant="secondary">1 card per line</Badge>
              <Badge variant="secondary">Optional leading count</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Best results: in Moxfield, use the plain text export/import format
              (one card per line, e.g. <span className="font-mono">1 Sol Ring</span>).
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={onImportClick} disabled={isImporting || !text.trim()}>
              {isImporting ? "Importing…" : "Import"}
            </Button>
            {isImporting ? (
              <div className="text-sm text-muted-foreground">
                Fetching cards: {progress.done}/{progress.total}
              </div>
            ) : null}
            {deck ? (
              <div className="text-sm text-muted-foreground">
                Current deck: <span className="text-foreground">{deck.entries.reduce((s, e) => s + e.count, 0)}</span>{" "}
                cards ({deck.entries.length} unique)
              </div>
            ) : null}
          </div>

          {errors.length ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="font-medium">Import error</div>
              <ul className="mt-2 list-disc pl-5">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

