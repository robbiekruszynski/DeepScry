"use client";

import * as React from "react";

import { ModeToggle } from "@/components/mode-toggle";
import { ImportTab } from "@/components/scry/import-tab";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Deck } from "@/lib/deck";

type TabKey = "overview" | "hand" | "curve" | "probabilities" | "import";

export function ScryApp() {
  const [tab, setTab] = React.useState<TabKey>("overview");
  const [deck, setDeck] = React.useState<Deck | null>(null);

  return (
    <div className="flex-1">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="truncate text-lg font-semibold tracking-tight">
                Scry
              </div>
              <Badge variant="secondary">Commander deck analyzer</Badge>
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
              <Card>
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {deck ? (
                    <>
                      Deck imported. Next up: stats overview.
                      <div className="mt-2">
                        {deck.entries.reduce((s, e) => s + e.count, 0)} cards (
                        {deck.entries.length} unique)
                      </div>
                    </>
                  ) : (
                    "Import a deck to see stats here."
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="hand" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle>Opening hand</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Hand simulator will live here.
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="curve" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle>Mana curve & distributions</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Curve/type/color charts will render here.
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="probabilities" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle>Probabilities</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Hypergeometric odds table will render here.
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="import" className="m-0">
              <ImportTab deck={deck} onDeckChange={setDeck} />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}

