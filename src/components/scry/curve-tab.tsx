"use client";

import * as React from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { useTheme } from "next-themes";

import type { Deck } from "@/lib/deck";
import {
  colorIdentityCounts,
  manaCurveBuckets,
  typeDistribution,
} from "@/lib/analysis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

const MANA_CURVE_COLORS = [
  "#94a3b8",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#fb923c",
  "#f87171",
  "#a78bfa",
  "#e879f9",
  "#dc2626",
];

const TYPE_COLORS = [
  "#16a34a",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#6b7280",
  "#d97706",
  "#dc2626",
];
const TYPE_COLORS_DARK = [
  "#4ade80",
  "#60a5fa",
  "#c084fc",
  "#f472b6",
  "#9ca3af",
  "#fbbf24",
  "#f87171",
];

const WUBRG_COLORS = ["#fcd34d", "#2563eb", "#57534e", "#ef4444", "#16a34a"];
const MANA_PIPS = [
  { color: "W", src: "https://svgs.scryfall.io/card-symbols/W.svg", label: "White" },
  { color: "U", src: "https://svgs.scryfall.io/card-symbols/U.svg", label: "Blue" },
  { color: "B", src: "https://svgs.scryfall.io/card-symbols/B.svg", label: "Black" },
  { color: "R", src: "https://svgs.scryfall.io/card-symbols/R.svg", label: "Red" },
  { color: "G", src: "https://svgs.scryfall.io/card-symbols/G.svg", label: "Green" },
];

const chartBorder = {
  borderColor: "rgba(15, 23, 42, 0.25)",
  borderWidth: 1,
};

export function CurveTab({ deck }: { deck: Deck }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const curve = React.useMemo(() => manaCurveBuckets(deck), [deck]);
  const types = React.useMemo(() => typeDistribution(deck), [deck]);
  const colors = React.useMemo(() => colorIdentityCounts(deck), [deck]);

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { color: "rgba(148, 163, 184, 0.2)" },
        ticks: { color: isDark ? "#e2e8f0" : "#334155" },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(148, 163, 184, 0.2)" },
        ticks: { color: isDark ? "#e2e8f0" : "#334155", precision: 0 },
      },
    },
  } as const;

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right" as const,
        labels: {
          color: isDark ? "#ffffff" : "#0f172a",
          padding: 12,
          usePointStyle: true,
        },
      },
    },
  };
  const colorValues = [colors.W, colors.U, colors.B, colors.R, colors.G];
  const maxColorValue = Math.max(...colorValues, 1);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Mana curve (non-lands)</CardTitle>
        </CardHeader>
        <CardContent>
          <Bar
            data={{
              labels: curve.labels,
              datasets: [
                {
                  label: "Cards",
                  data: curve.values,
                  backgroundColor: curve.labels.map(
                    (_, i) => MANA_CURVE_COLORS[i] ?? MANA_CURVE_COLORS[MANA_CURVE_COLORS.length - 1]!
                  ),
                  ...chartBorder,
                },
              ],
            }}
            options={barOptions}
            height={240}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Card type distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <Doughnut
            data={{
              labels: types.labels,
              datasets: [
                {
                  data: types.values,
                  backgroundColor: types.labels.map(
                    (_, i) =>
                      (isDark ? TYPE_COLORS_DARK : TYPE_COLORS)[
                        i % TYPE_COLORS.length
                      ]!
                  ),
                  ...chartBorder,
                },
              ],
            }}
            options={doughnutOptions}
            height={260}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Color identity count</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="grid h-[260px] grid-cols-5 items-end gap-3 rounded-lg border bg-muted/10 px-4 pb-4 pt-6"
            aria-label="Color identity count"
          >
            {MANA_PIPS.map((pip, idx) => {
              const value = colorValues[idx] ?? 0;
              const height = value > 0 ? Math.max(10, (value / maxColorValue) * 170) : 4;

              return (
                <div key={pip.color} className="flex h-full flex-col items-center justify-end gap-2">
                  <div className="text-sm font-medium tabular-nums">{value}</div>
                  <div className="flex h-[170px] w-full items-end justify-center">
                    <div
                      className="w-full max-w-14 rounded-t-md border border-slate-950/20 transition-[height] duration-300"
                      style={{
                        height,
                        backgroundColor: WUBRG_COLORS[idx],
                      }}
                      title={`${pip.label}: ${value}`}
                    />
                  </div>
                  <img
                    src={pip.src}
                    alt={`${pip.label} mana`}
                    className="h-5 w-5"
                    height={20}
                    width={20}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Counts include colored mana symbols in mana costs, falling back to color identity for
            cards without a colored mana cost.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

