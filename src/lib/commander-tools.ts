import type { CardTagMap, Deck, DeckArchetype } from "@/lib/deck";
import { expandDeck } from "@/lib/deck";
import type { ScryfallCard } from "@/lib/scryfall";
import {
  computeDeckStats,
  isInteraction,
  isLand,
  isRamp,
} from "@/lib/stats";

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function hasTag(
  card: ScryfallCard,
  tagMap: CardTagMap,
  tag: "ramp" | "interaction"
) {
  return (tagMap[card.id] ?? []).includes(tag);
}

export function countRampInCards(cards: ScryfallCard[], tagMap: CardTagMap) {
  return cards.filter((c) => hasTag(c, tagMap, "ramp") || isRamp(c)).length;
}

export function countInteractionInCards(cards: ScryfallCard[], tagMap: CardTagMap) {
  return cards.filter((c) => hasTag(c, tagMap, "interaction") || isInteraction(c))
    .length;
}

export function colorIdentityViolations(deck: Deck) {
  if (!deck.commanderName) return [];
  const commander = deck.entries.find(
    (e) => e.card.name.toLowerCase() === deck.commanderName!.toLowerCase()
  )?.card;
  if (!commander) return [];

  const commanderSet = new Set(commander.color_identity);
  return deck.entries
    .filter((e) => e.card.id !== commander.id)
    .filter((e) =>
      e.card.color_identity.some((c) => !commanderSet.has(c))
    )
    .map((e) => e.card.name);
}

export type HealthWarning = { level: "warn" | "info"; text: string };

export function deckHealthWarnings(deck: Deck): HealthWarning[] {
  const s = computeDeckStats(deck);
  const warnings: HealthWarning[] = [];
  if (s.totalCards !== 100) {
    warnings.push({
      level: "warn",
      text: `Deck size is ${s.totalCards}; Commander decks are usually 100 cards.`,
    });
  }
  if (s.landPercent < 33) {
    warnings.push({
      level: "warn",
      text: `Land ratio is ${s.landPercent.toFixed(1)}%. Consider ~36-38 lands for consistency.`,
    });
  }
  if (s.avgCmcNonLands > 3.6) {
    warnings.push({
      level: "info",
      text: `Average nonland CMC is ${s.avgCmcNonLands.toFixed(2)}; curve may be top-heavy.`,
    });
  }
  if (s.interactionCount < 8) {
    warnings.push({
      level: "info",
      text: `Interaction count is ${s.interactionCount}; many decks want 8-12 pieces.`,
    });
  }
  if (s.rampCount < 10) {
    warnings.push({
      level: "info",
      text: `Ramp count is ${s.rampCount}; many decks want around 10 pieces.`,
    });
  }
  return warnings;
}

export function mulliganAdvice(
  hand: ScryfallCard[],
  archetype: DeckArchetype,
  tagMap: CardTagMap
) {
  const lands = hand.filter(isLand).length;
  const ramp = countRampInCards(hand, tagMap);
  const interaction = countInteractionInCards(hand, tagMap);
  const lowCurve = hand.filter((c) => !isLand(c) && c.cmc <= 3).length;

  const reasons: string[] = [];
  let verdict: "Keep" | "Mulligan" | "Risky" = "Risky";

  if (lands >= 2 && lands <= 4) {
    verdict = "Keep";
    reasons.push("Solid land count for opening turns.");
  } else if (lands <= 1 || lands >= 6) {
    verdict = "Mulligan";
    reasons.push("Mana base in hand is too extreme.");
  }

  if (archetype === "ramp" && ramp === 0) {
    reasons.push("Ramp deck with no early ramp piece.");
    if (verdict === "Keep") verdict = "Risky";
  }
  if (archetype === "aggro" && lowCurve < 2) {
    reasons.push("Aggro hand lacks enough low-curve plays.");
    if (verdict === "Keep") verdict = "Risky";
  }
  if (archetype === "control" && interaction === 0) {
    reasons.push("Control hand has no interaction.");
    if (verdict === "Keep") verdict = "Risky";
  }
  if (archetype === "combo" && ramp + lowCurve < 2) {
    reasons.push("Combo hand may be too slow to assemble setup.");
    if (verdict === "Keep") verdict = "Risky";
  }

  if (reasons.length === 0) reasons.push("Hand is playable but context-dependent.");

  return { verdict, reasons, lands, ramp, interaction };
}

export function simulateCurveProbabilities(
  deck: Deck,
  iterations = 2000
): Record<1 | 2 | 3 | 4, number> {
  const expanded = expandDeck(deck);
  if (expanded.length === 0) return { 1: 0, 2: 0, 3: 0, 4: 0 };

  let hit1 = 0;
  let hit2 = 0;
  let hit3 = 0;
  let hit4 = 0;

  for (let i = 0; i < iterations; i++) {
    const cards = shuffle(expanded);
    let landsSeen = cards.slice(0, 7).filter(isLand).length;
    if (landsSeen >= 1) hit1++;
    if (landsSeen >= 2) hit2++;

    if (cards[7] && isLand(cards[7]!)) landsSeen++;
    if (landsSeen >= 3) hit3++;

    if (cards[8] && isLand(cards[8]!)) landsSeen++;
    if (landsSeen >= 4) hit4++;
  }
  return {
    1: hit1 / iterations,
    2: hit2 / iterations,
    3: hit3 / iterations,
    4: hit4 / iterations,
  };
}

