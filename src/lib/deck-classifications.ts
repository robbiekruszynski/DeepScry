import type { CardTagMap, Deck } from "@/lib/deck";
import type { ScryfallCard } from "@/lib/scryfall";
import {
  getInteractionReasons,
  getRampReasons,
  isCreature,
  isInteraction,
  isLand,
  isRamp,
} from "@/lib/stats";

export type OverviewStatId =
  | "total"
  | "lands"
  | "creatures"
  | "ramp"
  | "interaction"
  | "avgCmc";

export type ClassifiedDeckEntry = {
  card: ScryfallCard;
  count: number;
  reasons: string[];
};

export type CmcBucket = {
  cmc: number;
  entries: ClassifiedDeckEntry[];
  totalCount: number;
};

export type DeckClassifications = {
  total: ClassifiedDeckEntry[];
  lands: ClassifiedDeckEntry[];
  creatures: ClassifiedDeckEntry[];
  ramp: ClassifiedDeckEntry[];
  interaction: ClassifiedDeckEntry[];
  cmcBuckets: CmcBucket[];
  counts: {
    total: number;
    lands: number;
    creatures: number;
    ramp: number;
    interaction: number;
    avgCmcNonLands: number;
  };
};

function entryCount(entries: ClassifiedDeckEntry[]) {
  return entries.reduce((sum, e) => sum + e.count, 0);
}

export function getCardRampReasons(
  card: ScryfallCard,
  tagMap: CardTagMap
): string[] {
  const reasons: string[] = [];
  const tags = tagMap[card.id] ?? [];
  if (tags.includes("ramp")) reasons.push("tag: ramp");
  for (const reason of getRampReasons(card)) {
    if (!reasons.includes(reason)) reasons.push(reason);
  }
  return reasons;
}

export function getCardInteractionReasons(
  card: ScryfallCard,
  tagMap: CardTagMap
): string[] {
  const reasons: string[] = [];
  const tags = tagMap[card.id] ?? [];
  if (tags.includes("interaction")) reasons.push("tag: interaction");
  for (const reason of getInteractionReasons(card)) {
    if (!reasons.includes(reason)) reasons.push(reason);
  }
  return reasons;
}

export function isClassifiedRamp(card: ScryfallCard, tagMap: CardTagMap): boolean {
  return (tagMap[card.id] ?? []).includes("ramp") || isRamp(card);
}

export function isClassifiedInteraction(
  card: ScryfallCard,
  tagMap: CardTagMap
): boolean {
  return (tagMap[card.id] ?? []).includes("interaction") || isInteraction(card);
}

export function buildDeckClassifications(
  deck: Deck,
  tagMap: CardTagMap
): DeckClassifications {
  const total: ClassifiedDeckEntry[] = [];
  const lands: ClassifiedDeckEntry[] = [];
  const creatures: ClassifiedDeckEntry[] = [];
  const ramp: ClassifiedDeckEntry[] = [];
  const interaction: ClassifiedDeckEntry[] = [];
  const cmcMap = new Map<number, ClassifiedDeckEntry[]>();

  let cmcSum = 0;
  let cmcCount = 0;

  for (const entry of deck.entries) {
    const { card, count } = entry;

    total.push({ card, count, reasons: ["in deck"] });

    if (isLand(card)) {
      lands.push({ card, count, reasons: ["land"] });
    } else {
      cmcSum += card.cmc * count;
      cmcCount += count;
      const bucket = cmcMap.get(card.cmc) ?? [];
      bucket.push({
        card,
        count,
        reasons: [`CMC ${card.cmc}`],
      });
      cmcMap.set(card.cmc, bucket);
    }

    if (isCreature(card)) {
      creatures.push({ card, count, reasons: ["creature"] });
    }

    const rampReasons = getCardRampReasons(card, tagMap);
    if (rampReasons.length > 0) {
      ramp.push({ card, count, reasons: rampReasons });
    }

    const interactionReasons = getCardInteractionReasons(card, tagMap);
    if (interactionReasons.length > 0) {
      interaction.push({ card, count, reasons: interactionReasons });
    }
  }

  const sortByName = (a: ClassifiedDeckEntry, b: ClassifiedDeckEntry) =>
    a.card.name.localeCompare(b.card.name);

  total.sort(sortByName);
  lands.sort(sortByName);
  creatures.sort(sortByName);
  ramp.sort(sortByName);
  interaction.sort(sortByName);

  const cmcBuckets: CmcBucket[] = [...cmcMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([cmc, entries]) => {
      entries.sort(sortByName);
      return {
        cmc,
        entries,
        totalCount: entryCount(entries),
      };
    });

  return {
    total,
    lands,
    creatures,
    ramp,
    interaction,
    cmcBuckets,
    counts: {
      total: entryCount(total),
      lands: entryCount(lands),
      creatures: entryCount(creatures),
      ramp: entryCount(ramp),
      interaction: entryCount(interaction),
      avgCmcNonLands: cmcCount > 0 ? cmcSum / cmcCount : 0,
    },
  };
}
