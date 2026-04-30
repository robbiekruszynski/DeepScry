"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { Loader2 } from "lucide-react";

import type { Deck, DeckArchetype } from "@/lib/deck";
import { importDecklist, type DeckImportResult } from "@/lib/deck-import";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export function ImportTab({
  deck,
  text,
  commanderName,
  archetype,
  onTextChange,
  onCommanderNameChange,
  onArchetypeChange,
  onDeckChange,
}: {
  deck: Deck | null;
  text: string;
  commanderName: string;
  archetype: DeckArchetype;
  onTextChange: (next: string) => void;
  onCommanderNameChange: (next: string) => void;
  onArchetypeChange: (next: DeckArchetype) => void;
  onDeckChange: (next: Deck | null) => void;
}) {
  const [isImporting, setIsImporting] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number }>(
    { done: 0, total: 0 }
  );
  const [importDetail, setImportDetail] = React.useState<string>("");
  const importStartedAt = React.useRef<number>(0);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [copyStatus, setCopyStatus] = React.useState<"idle" | "copied" | "error">(
    "idle"
  );
  const progressPercent =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const etaSeconds =
    progress.done > 0 && progress.total > 0 && progress.done < progress.total
      ? Math.max(
          0,
          Math.round(
            ((Date.now() - importStartedAt.current) / progress.done) *
              (progress.total - progress.done) /
              1000
          )
        )
      : null;

  async function runImport(): Promise<DeckImportResult> {
    importStartedAt.current = Date.now();
    flushSync(() => {
      setProgress({ done: 0, total: 0 });
      setImportDetail("Starting...");
    });

    return importDecklist({
      text,
      commanderName,
      archetype,
      onProgress: (p) => {
        flushSync(() => {
          setProgress({ done: p.done, total: p.total });
          setImportDetail(p.detail);
        });
      },
    });
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

  async function onCopyClick() {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    } finally {
      setTimeout(() => setCopyStatus("idle"), 1800);
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
              onChange={(e) => onCommanderNameChange(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="archetype">Archetype</Label>
            <select
              id="archetype"
              value={archetype}
              onChange={(e) => onArchetypeChange(e.target.value as DeckArchetype)}
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
              onChange={(e) => onTextChange(e.target.value)}
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
            <Button
              variant="outline"
              onClick={onCopyClick}
              disabled={!text.trim() || isImporting}
            >
              {copyStatus === "copied"
                ? "Copied"
                : copyStatus === "error"
                  ? "Copy failed"
                  : "Copy decklist"}
            </Button>
            {deck ? (
              <div className="text-sm text-muted-foreground">
                Current deck: <span className="text-foreground">{deck.entries.reduce((s, e) => s + e.count, 0)}</span>{" "}
                cards ({deck.entries.length} unique)
              </div>
            ) : null}
          </div>

          {isImporting ? (
            <div
              className="relative overflow-hidden rounded-xl border-2 border-primary/35 bg-muted/30 p-4 shadow-inner ring-1 ring-primary/15 animate-in fade-in duration-300"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-primary/5 via-transparent to-primary/5 animate-pulse" />
              <div className="relative space-y-3">
                <div className="flex items-start gap-3">
                  <Loader2
                    className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span>Resolving deck with Scryfall</span>
                      <span className="rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs tabular-nums text-foreground">
                        {progressPercent}%
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {importDetail || "Working…"}
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-2.5 rounded-full bg-primary transition-[width] duration-300 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="tabular-nums">
                      Progress: {progress.done}/{progress.total} unique names
                    </span>
                    {etaSeconds !== null ? (
                      <span className="tabular-nums">~{etaSeconds}s remaining (estimate)</span>
                    ) : (
                      <span>Keep this tab open</span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-dashed border-primary/25 bg-background/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Why it can take a minute: </span>
                  Scryfall is queried in small batches (rate limits). The app now uses bulk lookups
                  where possible; the first full import still needs network time. Re-imports reuse
                  your browser cache and are much faster.
                </div>
              </div>
            </div>
          ) : null}

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

