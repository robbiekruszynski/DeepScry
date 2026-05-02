import type { Deck } from "@/lib/deck";
import type { ScryfallCard } from "@/lib/scryfall";

function includesType(typeLine: string, needle: string) {
  return typeLine.toLowerCase().includes(needle.toLowerCase());
}

export function isLand(card: ScryfallCard) {
  return includesType(card.type_line, "Land");
}

export function isCreature(card: ScryfallCard) {
  return includesType(card.type_line, "Creature");
}

export function isInstant(card: ScryfallCard) {
  return includesType(card.type_line, "Instant");
}

export function isSorcery(card: ScryfallCard) {
  return includesType(card.type_line, "Sorcery");
}

export function isArtifact(card: ScryfallCard) {
  return includesType(card.type_line, "Artifact");
}

export function isEnchantment(card: ScryfallCard) {
  return includesType(card.type_line, "Enchantment");
}

export function isPlaneswalker(card: ScryfallCard) {
  return includesType(card.type_line, "Planeswalker");
}

export function isRamp(card: ScryfallCard) {
  if (isLand(card)) return false;
  const text = (card.oracle_text ?? "").toLowerCase();

  if (/\badd\b/.test(text) && text.includes("{")) return true;

  if (
    text.includes("search your library") &&
    text.includes("land card") &&
    (text.includes("put it onto the battlefield") ||
      text.includes("put that card onto the battlefield"))
  ) {
    return true;
  }

  if (text.includes("treasure token")) return true;

  return false;
}

export function isInteraction(card: ScryfallCard) {
  if (isLand(card)) return false;
  const name = card.name.toLowerCase();
  const text = (card.oracle_text ?? "").toLowerCase();

  const knownInteraction = [
    "collector ouphe",
    "deflecting swat",
    "drannith magistrate",
    "grand abolisher",
    "opposition agent",
    "pyroblast",
    "red elemental blast",
    "silence",
    "thoughtseize",
    "veil of summer",
  ];

  if (knownInteraction.includes(name)) return true;

  const patterns: RegExp[] = [
    /\bcounter target\b/,
    /\bchange the target\b/,
    /\bdestroy target\b/,
    /\bexile target\b/,
    /\bdeals? \d+ damage to target\b/,
    /\btarget opponent reveals their hand\b/,
    /\breturn target\b.*\bto (its owner's hand|their hand)\b/,
    /\bopponents can't\b/,
    /\byour opponents can't\b/,
    /\bcan't cast spells\b/,
    /\bprevent all damage\b/,
  ];
  return patterns.some((p) => p.test(text));
}

export function isCardDraw(card: ScryfallCard) {
  if (isLand(card)) return false;
  const text = (card.oracle_text ?? "").toLowerCase();
  return /\bdraw (a|two|three|x|\d+) card/.test(text) || text.includes("draw a card");
}

export function isWinconHeuristic(card: ScryfallCard) {
  if (isLand(card)) return false;
  const name = card.name.toLowerCase();
  const text = (card.oracle_text ?? "").toLowerCase();

  const knownWincons = [
    "approach of the second sun",
    "aetherflux reservoir",
    "bitter ordeal",
    "exquisite blood",
    "jace, wielder of mysteries",
    "laboratory maniac",
    "revel in riches",
    "thassa's oracle",
    "walking ballista",
  ];

  if (knownWincons.includes(name)) return true;

  return (
    text.includes("you win the game") ||
    text.includes("loses the game") ||
    text.includes("lose the game") ||
    text.includes("damage to each opponent") ||
    /\b(?:each |target )?opponent loses (?:x|\d+|that much) life\b/.test(text) ||
    text.includes("commander damage")
  );
}

export type DeckStats = {
  totalCards: number;
  uniqueCards: number;
  landCount: number;
  landPercent: number;
  avgCmcNonLands: number;
  creatureCount: number;
  rampCount: number;
  interactionCount: number;
};

export function computeDeckStats(deck: Deck): DeckStats {
  let totalCards = 0;
  let landCount = 0;
  let creatureCount = 0;
  let rampCount = 0;
  let interactionCount = 0;
  let cmcSum = 0;
  let cmcCount = 0;

  for (const e of deck.entries) {
    totalCards += e.count;

    if (isLand(e.card)) landCount += e.count;
    if (isCreature(e.card)) creatureCount += e.count;
    if (isRamp(e.card)) rampCount += e.count;
    if (isInteraction(e.card)) interactionCount += e.count;

    if (!isLand(e.card)) {
      cmcSum += e.card.cmc * e.count;
      cmcCount += e.count;
    }
  }

  const landPercent = totalCards > 0 ? (landCount / totalCards) * 100 : 0;
  const avgCmcNonLands = cmcCount > 0 ? cmcSum / cmcCount : 0;

  return {
    totalCards,
    uniqueCards: deck.entries.length,
    landCount,
    landPercent,
    avgCmcNonLands,
    creatureCount,
    rampCount,
    interactionCount,
  };
}

