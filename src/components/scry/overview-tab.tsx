"use client";

import * as React from "react";
import { BarChart2, DollarSign, Hand, Percent } from "lucide-react";

import type { CardTagMap, Deck } from "@/lib/deck";
import { findCommanderEntry, getCommanderDisplayName } from "@/lib/deck";
import type { ScryfallCard } from "@/lib/scryfall";
import { fetchCardById } from "@/lib/scryfall";
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
import { estimateCommanderBracket, type BracketEstimate } from "@/lib/bracket";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MANA_COLORS: Record<string, { bg: string; label: string }> = {
  W: { bg: "#f8f4e8", label: "#1a1a1a" },
  U: { bg: "#0e4b6e", label: "#f8fafc" },
  B: { bg: "#3d3d3d", label: "#f8fafc" },
  R: { bg: "#9b1d20", label: "#f8fafc" },
  G: { bg: "#2d6a3e", label: "#f8fafc" },
};

function commanderArtUrl(card: ScryfallCard, large = false) {
  if (large) {
    return (
      card.image_url_large ||
      card.image_url_normal ||
      card.image_url ||
      card.image_url_art_crop ||
      null
    );
  }
  return (
    card.image_url_normal ||
    card.image_url_large ||
    card.image_url ||
    card.image_url_art_crop ||
    null
  );
}

function ColorIdentityPips({ colors }: { colors: string[] }) {
  if (colors.length === 0) {
    return <span className="text-xs text-muted-foreground">Colorless</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {colors.map((color) => {
        const style = MANA_COLORS[color];
        if (!style) return null;
        return (
          <span
            key={color}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none"
            style={{ backgroundColor: style.bg, color: style.label }}
            title={color}
          >
            {color}
          </span>
        );
      })}
    </div>
  );
}

function CommanderArtPanel({
  commanderEntry,
  commanderName,
}: {
  commanderEntry: ReturnType<typeof findCommanderEntry>;
  commanderName: string | null;
}) {
  const [card, setCard] = React.useState<ScryfallCard | null>(
    commanderEntry?.card ?? null
  );
  const [status, setStatus] = React.useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [enlarged, setEnlarged] = React.useState(false);
  const [imgFailed, setImgFailed] = React.useState(false);

  React.useEffect(() => {
    setImgFailed(false);
    setEnlarged(false);
    if (!commanderName) {
      setCard(null);
      setStatus("idle");
      return;
    }

    const initial = commanderEntry?.card ?? null;
    setCard(initial);
    if (initial && commanderArtUrl(initial)) {
      setStatus("ready");
      return;
    }

    if (!initial?.id) {
      setStatus("error");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    void fetchCardById(initial.id)
      .then((fetched) => {
        if (cancelled) return;
        setCard(fetched);
        setStatus(commanderArtUrl(fetched) ? "ready" : "error");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [commanderEntry?.card.id, commanderName]);

  if (!commanderName) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-lg border bg-muted/30 px-2 text-center text-xs text-muted-foreground">
        Set a commander in Import to preview it here.
      </div>
    );
  }

  const artSrc = card ? commanderArtUrl(card, enlarged) : null;

  return (
    <div
      className="rounded-lg border bg-muted/30 p-2 shadow-sm backdrop-blur-sm"
      aria-live="polite"
      onMouseEnter={() => setEnlarged(true)}
      onMouseLeave={() => setEnlarged(false)}
      onFocus={() => setEnlarged(true)}
      onBlur={() => setEnlarged(false)}
    >
      {status === "loading" ? (
        <div className="space-y-2">
          <div className="mx-auto aspect-[5/7] w-full max-w-[220px] animate-pulse rounded-md bg-muted" />
          <div className="mx-auto h-3 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      ) : status === "ready" && artSrc && !imgFailed ? (
        <div className="space-y-2">
          <img
            src={artSrc}
            alt={card?.name ?? commanderName}
            className={`mx-auto w-full rounded-md border object-contain transition-transform duration-200 ${
              enlarged ? "max-h-[min(420px,55vh)]" : "max-h-[min(280px,38vh)]"
            }`}
            onError={() => setImgFailed(true)}
          />
          <div className="text-sm font-medium">{card?.name ?? commanderName}</div>
          {card?.type_line ? (
            <div className="text-xs text-muted-foreground">{card.type_line}</div>
          ) : null}
          {card?.scryfall_uri ? (
            <a
              href={card.scryfall_uri}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline-offset-2 hover:underline"
            >
              View on Scryfall
            </a>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 px-2 text-center text-xs text-muted-foreground">
          <span>Card image unavailable.</span>
          <span className="font-medium text-foreground">{commanderName}</span>
        </div>
      )}
    </div>
  );
}

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

const LANDING_FEATURES = [
  {
    icon: BarChart2,
    title: "Mana Curve",
    description:
      "Visualize your CMC distribution and spot dead turns before they happen.",
  },
  {
    icon: Hand,
    title: "Opening Hand Sim",
    description:
      "Simulate thousands of opening hands and see your real keep rate.",
  },
  {
    icon: Percent,
    title: "Probability Engine",
    description:
      "Calculate the odds of drawing any card or combination by any turn.",
  },
  {
    icon: DollarSign,
    title: "Budget Analyzer",
    description:
      "See your deck's current value and get ranked upgrade suggestions with live pricing.",
  },
] as const;

function OverviewLanding({ onImport }: { onImport: () => void }) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="space-y-1">
          <CardTitle className="text-xl">Welcome to DeepScry</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            The fastest way to analyze, test, and upgrade your Commander deck.
          </CardDescription>
        </div>
        <Button size="lg" onClick={onImport}>
          Go to Import →
        </Button>
      </CardHeader>
      <CardContent className="space-y-8 text-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING_FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-lg border border-border/80 bg-muted/20 p-3"
            >
              <Icon className="mb-2 h-5 w-5 text-primary" aria-hidden />
              <div className="font-medium text-foreground">{title}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">How to import your deck</h3>
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>Open your deck on Moxfield, Archidekt, or EDHREC</li>
            <li>
              Export or copy as plain text (one card per line, e.g. &quot;1 Sol Ring&quot;)
            </li>
            <li>Paste into the Import tab and click Import</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Moxfield users: use Copy → Plain Text for best results.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}

function BracketEstimateCard({ estimate }: { estimate: BracketEstimate }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Bracket Estimate</CardTitle>
        <CardDescription>
          Commander Brackets (1–5) from measurable deck signals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="text-5xl font-bold tabular-nums leading-none">
            {estimate.primary}
          </div>
          <div className="min-w-0 pb-1">
            <div className="text-lg font-medium">{estimate.label}</div>
            <div className="text-sm text-muted-foreground">{estimate.bracketName}</div>
          </div>
        </div>

        <details className="group rounded-md border bg-muted/20">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            Why
          </summary>
          <ul className="space-y-3 border-t px-3 py-3 text-sm">
            {estimate.evidence.map((item) => (
              <li key={item.id} className="space-y-1">
                <div className="font-medium text-foreground">{item.label}</div>
                {item.cards.length > 0 ? (
                  <div className="text-muted-foreground">{item.cards.join(", ")}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </details>

        <p className="text-xs text-muted-foreground">{estimate.disclaimer}</p>
      </CardContent>
    </Card>
  );
}

function OverviewDeckContent({
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
  const stats = React.useMemo(() => computeDeckStats(deck), [deck]);
  const bracketEstimate = React.useMemo(
    () => estimateCommanderBracket(deck),
    [deck]
  );
  const warnings = React.useMemo(() => deckHealthWarnings(deck, tagMap), [deck, tagMap]);
  const benchmarkScores = React.useMemo(() => deckBenchmarkScores(deck), [deck]);
  const violations = React.useMemo(() => colorIdentityViolations(deck), [deck]);
  const curveOdds = React.useMemo(() => simulateCurveProbabilities(deck, 1200), [
    deck,
    tagMap,
  ]);
  const commanderEntry = React.useMemo(() => findCommanderEntry(deck), [deck]);
  const commanderDisplayName = React.useMemo(() => getCommanderDisplayName(deck), [deck]);
  const commanderColors = commanderEntry?.card.color_identity ?? [];
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

  const commanderThumbUrl = commanderEntry
    ? commanderArtUrl(commanderEntry.card, false)
    : null;

  return (
    <div className="grid gap-4">
      <Card className="overflow-visible">
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="relative flex min-w-0 gap-3">
            {commanderThumbUrl ? (
              <img
                src={commanderThumbUrl}
                alt=""
                className="h-20 w-14 shrink-0 rounded border object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Commander
              </div>
              <div className="truncate text-xl font-semibold">
                {commanderDisplayName ?? "No commander set"}
              </div>
              {commanderDisplayName ? (
                <div className="mt-2 space-y-1">
                  {commanderEntry?.card.type_line ? (
                    <div className="text-sm text-muted-foreground">
                      {commanderEntry.card.type_line}
                    </div>
                  ) : null}
                  <ColorIdentityPips colors={commanderColors} />
                </div>
              ) : (
                <div className="mt-1 text-sm text-muted-foreground">
                  Set a commander in Import to enable color identity checks.
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{stats.uniqueCards} unique</Badge>
                <Badge variant="secondary">{stats.totalCards} total</Badge>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <CommanderArtPanel
              commanderEntry={commanderEntry}
              commanderName={commanderDisplayName}
            />
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

      <div className="max-w-prose text-xs text-muted-foreground">
        Ramp and interaction are automatically classified from card text and tags.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
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

      <BracketEstimateCard estimate={bracketEstimate} />

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

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Deck health vs benchmark metas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="max-w-prose text-xs leading-relaxed text-muted-foreground">
              Heuristic comparison against four typical Commander power environments. Targets
              (lands, ramp, interaction, fast mana, tutors, average CMC) are based on established
              deckbuilding guidelines — not live tournament data. A high score means your build
              structure resembles that tier, not that it performs at that level.
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
                  • {w.text}
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

export function OverviewTab({
  deck,
  tagMap,
  onRemoveCard,
  onEditImport,
  onStartOver,
  onImport,
}: {
  deck: Deck | null;
  tagMap: CardTagMap;
  onRemoveCard: (cardId: string) => void;
  onEditImport: () => void;
  onStartOver: () => void;
  onImport?: () => void;
}) {
  if (!deck) {
    if (!onImport) return null;
    return <OverviewLanding onImport={onImport} />;
  }

  return (
    <OverviewDeckContent
      deck={deck}
      tagMap={tagMap}
      onRemoveCard={onRemoveCard}
      onEditImport={onEditImport}
      onStartOver={onStartOver}
    />
  );
}

