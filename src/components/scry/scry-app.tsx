"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { OrbHero } from "@/components/OrbHero";
import { CurveTab } from "@/components/scry/curve-tab";
import { HandTab } from "@/components/scry/hand-tab";
import { ImportTab } from "@/components/scry/import-tab";
import { OverviewTab } from "@/components/scry/overview-tab";
import { ProbabilitiesTab } from "@/components/scry/probabilities-tab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CardTagMap, Deck, DeckArchetype } from "@/lib/deck";
import { importDecklist } from "@/lib/deck-import";
import {
  generateCommanderSample,
  WISE_MOTHMAN_SAMPLE,
  type BudgetTier,
  type ManaColor,
  type PowerLevel,
} from "@/lib/sample-decks";

type TabKey = "overview" | "hand" | "curve" | "probabilities" | "import";

const MANA_PIPS: Record<ManaColor, { src: string; label: string }> = {
  W: { src: "https://svgs.scryfall.io/card-symbols/W.svg", label: "White" },
  U: { src: "https://svgs.scryfall.io/card-symbols/U.svg", label: "Blue" },
  B: { src: "https://svgs.scryfall.io/card-symbols/B.svg", label: "Black" },
  R: { src: "https://svgs.scryfall.io/card-symbols/R.svg", label: "Red" },
  G: { src: "https://svgs.scryfall.io/card-symbols/G.svg", label: "Green" },
};

export function ScryApp() {
  const [hasEntered, setHasEntered] = React.useState(false);
  const [tab, setTab] = React.useState<TabKey>("overview");
  const [deck, setDeck] = React.useState<Deck | null>(null);
  const [tagMap, setTagMap] = React.useState<CardTagMap>({});
  const [importText, setImportText] = React.useState("");
  const [commanderName, setCommanderName] = React.useState("");
  const [archetype, setArchetype] = React.useState<DeckArchetype>("midrange");
  const [isSampleImporting, setIsSampleImporting] = React.useState(false);
  const [sampleError, setSampleError] = React.useState<string | null>(null);
  const [selectedColors, setSelectedColors] = React.useState<ManaColor[]>([]);
  const [sampleCommander, setSampleCommander] = React.useState("");
  const [sampleBudget, setSampleBudget] = React.useState<BudgetTier>("budget");
  const [samplePowerLevel, setSamplePowerLevel] = React.useState<PowerLevel>("casual");
  const [importDraftLoaded, setImportDraftLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!deck) {
      setTagMap({});
      return;
    }
    const validIds = new Set(deck.entries.map((e) => e.card.id));
    setTagMap((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([cardId]) => validIds.has(cardId))
      )
    );
  }, [deck]);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem("scry:import-draft:v1");
      if (!saved) return;
      const parsed = JSON.parse(saved) as {
        text?: string;
        commanderName?: string;
        archetype?: DeckArchetype;
      };
      if (parsed.text) setImportText(parsed.text);
      if (parsed.commanderName) setCommanderName(parsed.commanderName);
      if (parsed.archetype) setArchetype(parsed.archetype);
    } catch {
    } finally {
      setImportDraftLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    if (!importDraftLoaded) return;
    try {
      window.localStorage.setItem(
        "scry:import-draft:v1",
        JSON.stringify({ text: importText, commanderName, archetype })
      );
    } catch {}
  }, [importText, commanderName, archetype, importDraftLoaded]);

  const removeCard = React.useCallback((cardId: string) => {
    setDeck((prev) => {
      if (!prev) return prev;
      const entries = prev.entries
        .map((entry) =>
          entry.card.id === cardId
            ? { ...entry, count: entry.count - 1 }
            : entry
        )
        .filter((entry) => entry.count > 0);
      return { ...prev, entries };
    });
  }, []);

  const editImport = React.useCallback(() => {
    setSampleError(null);
    setTab("import");
  }, []);

  const startOver = React.useCallback(() => {
    setDeck(null);
    setTagMap({});
    setImportText("");
    setCommanderName("");
    setArchetype("midrange");
    setSampleError(null);
    setTab("overview");
  }, []);

  async function loadSampleDeck() {
    await importSample({
      decklist: WISE_MOTHMAN_SAMPLE.decklist,
      commanderName: WISE_MOTHMAN_SAMPLE.commanderName,
      archetype: WISE_MOTHMAN_SAMPLE.archetype,
    });
  }

  async function loadGeneratedSample() {
    const sample = generateCommanderSample({
      colors: selectedColors,
      commanderName: sampleCommander,
      budget: sampleBudget,
      powerLevel: samplePowerLevel,
    });
    await importSample({
      decklist: sample.decklist,
      commanderName: sample.commanderName,
      archetype: sample.archetype,
    });
  }

  async function importSample(sample: {
    decklist: string;
    commanderName: string;
    archetype: DeckArchetype;
  }) {
    setIsSampleImporting(true);
    setSampleError(null);
    setImportText(sample.decklist);
    setCommanderName(sample.commanderName);
    setArchetype(sample.archetype);

    try {
      const result = await importDecklist({
        text: sample.decklist,
        commanderName: sample.commanderName,
        archetype: sample.archetype,
      });

      if (result.deck) {
        setDeck(result.deck);
        setTab("overview");
      } else {
        setDeck(null);
        setSampleError(result.errors.join(" "));
        setTab("overview");
      }
    } catch (error) {
      setDeck(null);
      setSampleError(error instanceof Error ? error.message : String(error));
      setTab("overview");
    } finally {
      setIsSampleImporting(false);
    }
  }

  const toggleSampleColor = (color: ManaColor) => {
    setSelectedColors((prev) =>
      prev.includes(color)
        ? prev.filter((c) => c !== color)
        : [...prev, color]
    );
  };

  if (!hasEntered) {
    const enterApp = () => {
      setHasEntered(true);
      setTab("overview");
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070412] px-4 py-6">
        <div className="w-full max-w-4xl">
          <OrbHero onEnter={enterApp} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div
              className="truncate"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "36px",
                fontWeight: 500,
                letterSpacing: "-1px",
                color: "#C4B5FD",
                lineHeight: 1,
              }}
            >
              Deep
              <span style={{ color: "#7C3AED", fontWeight: 400 }}>Scry</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Import a decklist, simulate hands, and inspect curve, colors, and
              probabilities.
            </div>
          </div>
          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <div className="flex flex-col gap-4">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="hand">Hand</TabsTrigger>
              <TabsTrigger value="curve">Curve</TabsTrigger>
              <TabsTrigger value="probabilities">Probabilities</TabsTrigger>
              <TabsTrigger value="import">Import</TabsTrigger>
            </TabsList>

            <Separator />

            <TabsContent value="overview" className="m-0">
              {deck ? (
                <OverviewTab
                  deck={deck}
                  tagMap={tagMap}
                  onRemoveCard={removeCard}
                  onEditImport={editImport}
                  onStartOver={startOver}
                />
              ) : (
                <div className="grid gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Welcome to DeepScry</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <p>
                      DeepScry analyzes Commander decklists with opening-hand simulation, mana
                      curve charts, color identity counts, probability checks, and editable
                      deck stats.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button onClick={loadSampleDeck} disabled={isSampleImporting}>
                        {isSampleImporting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            Loading sample...
                          </>
                        ) : (
                          "Load sample deck"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setTab("import")}
                        disabled={isSampleImporting}
                      >
                        Import your own
                      </Button>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="font-medium text-foreground">
                        Build a sample from your preferences
                      </div>
                      <p className="mt-1 text-xs">
                        Pick colors and a budget/power target, or type a commander name to seed
                        the list. DeepScry fills the Import tab and runs the import for you.
                      </p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-foreground">Colors</div>
                          <div className="flex flex-wrap gap-2">
                            {(["W", "U", "B", "R", "G"] as ManaColor[]).map((color) => (
                              <Button
                                key={color}
                                type="button"
                                variant={selectedColors.includes(color) ? "default" : "outline"}
                                size="icon"
                                onClick={() => toggleSampleColor(color)}
                                disabled={isSampleImporting}
                                aria-label={`Toggle ${MANA_PIPS[color].label} sample color`}
                                title={MANA_PIPS[color].label}
                              >
                                <img
                                  src={MANA_PIPS[color].src}
                                  alt=""
                                  className="h-5 w-5"
                                  height={20}
                                  width={20}
                                  aria-hidden
                                />
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-foreground">
                            Commander search
                          </div>
                          <Input
                            value={sampleCommander}
                            onChange={(event) => setSampleCommander(event.target.value)}
                            placeholder="Optional, e.g. Aesi, Tyrant of Gyre Strait"
                            disabled={isSampleImporting}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-foreground">Budget</div>
                          <select
                            value={sampleBudget}
                            onChange={(event) => setSampleBudget(event.target.value as BudgetTier)}
                            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                            disabled={isSampleImporting}
                          >
                            <option value="budget">Budget</option>
                            <option value="upgraded">Upgraded</option>
                            <option value="optimized">Optimized</option>
                            <option value="cedh">No budget / cEDH staples</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-foreground">Power level</div>
                          <select
                            value={samplePowerLevel}
                            onChange={(event) =>
                              setSamplePowerLevel(event.target.value as PowerLevel)
                            }
                            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                            disabled={isSampleImporting}
                          >
                            <option value="casual">Casual</option>
                            <option value="focused">Focused</option>
                            <option value="optimized">Optimized</option>
                            <option value="cedh">cEDH</option>
                          </select>
                        </div>
                      </div>
                      <Button
                        className="mt-3"
                        onClick={loadGeneratedSample}
                        disabled={isSampleImporting || selectedColors.length === 0}
                      >
                        Generate sample deck
                      </Button>
                    </div>
                    {sampleError ? (
                      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                        {sampleError}
                      </div>
                    ) : null}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="hand" className="m-0">
              {deck ? (
                <HandTab deck={deck} tagMap={tagMap} />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Opening hand</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Import a deck to simulate opening hands.
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="curve" className="m-0">
              {deck ? (
                <CurveTab deck={deck} />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Mana curve & distributions</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Import a deck to generate charts.
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="probabilities" className="m-0">
              {deck ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Probabilities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ProbabilitiesTab
                      deck={deck}
                      tagMap={tagMap}
                      onTagMapChange={setTagMap}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Probabilities</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Import a deck to calculate odds.
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="import" className="m-0">
              <ImportTab
                deck={deck}
                text={importText}
                commanderName={commanderName}
                archetype={archetype}
                onTextChange={setImportText}
                onCommanderNameChange={setCommanderName}
                onArchetypeChange={setArchetype}
                onDeckChange={setDeck}
              />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}

