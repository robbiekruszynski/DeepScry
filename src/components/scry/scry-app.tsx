"use client";

import * as React from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { OrbHero } from "@/components/OrbHero";
import { CurveTab } from "@/components/scry/curve-tab";
import { HandTab } from "@/components/scry/hand-tab";
import { ImportTab } from "@/components/scry/import-tab";
import { OverviewTab } from "@/components/scry/overview-tab";
import { ProbabilitiesTab } from "@/components/scry/probabilities-tab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CardTagMap, Deck, DeckArchetype } from "@/lib/deck";
type TabKey = "overview" | "hand" | "curve" | "probabilities" | "import";

export function ScryApp() {
  const [hasEntered, setHasEntered] = React.useState(false);
  const [tab, setTab] = React.useState<TabKey>("overview");
  const [deck, setDeck] = React.useState<Deck | null>(null);
  const [tagMap, setTagMap] = React.useState<CardTagMap>({});
  const [importText, setImportText] = React.useState("");
  const [commanderName, setCommanderName] = React.useState("");
  const [archetype, setArchetype] = React.useState<DeckArchetype>("midrange");
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
    setTab("import");
  }, []);

  const startOver = React.useCallback(() => {
    setDeck(null);
    setTagMap({});
    setImportText("");
    setCommanderName("");
    setArchetype("midrange");
    setTab("overview");
  }, []);

  if (!hasEntered) {
    const enterApp = () => {
      setHasEntered(true);
      setTab("overview");
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070412]">
        <div className="w-full">
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
              <OverviewTab
                deck={deck}
                tagMap={tagMap}
                onRemoveCard={removeCard}
                onEditImport={editImport}
                onStartOver={startOver}
                onImport={() => setTab("import")}
              />
            </TabsContent>

            <TabsContent value="hand" className="m-0">
              {deck ? (
                <HandTab deck={deck} tagMap={tagMap} />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Test play & opening hands</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
                    <p className="max-w-md text-sm text-muted-foreground">
                      Load a deck to draw opening hands, get keep/mulligan advice, and play out
                      turns on a virtual battlefield.
                    </p>
                    <Button size="lg" onClick={() => setTab("import")}>
                      Import a deck
                    </Button>
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

