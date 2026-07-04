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
  return getRampReasons(card).length > 0;
}

/** Human-readable ramp signals (mirrors {@link isRamp}). */
export function getRampReasons(card: ScryfallCard): string[] {
  if (isLand(card)) return [];
  const text = (card.oracle_text ?? "").toLowerCase();
  const reasons: string[] = [];

  if (/\badd\b/.test(text) && text.includes("{")) {
    reasons.push("adds mana");
  }
  if (
    text.includes("search your library") &&
    text.includes("land card") &&
    (text.includes("put it onto the battlefield") ||
      text.includes("put that card onto the battlefield"))
  ) {
    reasons.push("tutor land to battlefield");
  }
  if (text.includes("treasure token")) {
    reasons.push("treasure token");
  }

  return reasons;
}

/** Human-readable interaction signals (mirrors {@link isInteraction}). */
export function getInteractionReasons(card: ScryfallCard): string[] {
  if (isLand(card)) return [];
  const name = card.name.toLowerCase();
  const text = (card.oracle_text ?? "").toLowerCase();
  const reasons: string[] = [];

  const knownInteraction: Record<string, string> = {
    "collector ouphe": "stax / artifact hate",
    "deflecting swat": "redirect",
    "drannith magistrate": "spell lock",
    "grand abolisher": "spell lock",
    "opposition agent": "hand disruption",
    pyroblast: "counter red",
    "red elemental blast": "counter red",
    silence: "spell lock",
    thoughtseize: "hand disruption",
    "veil of summer": "protection",
  };

  if (name in knownInteraction) {
    reasons.push(knownInteraction[name]!);
  }

  const patterns: { re: RegExp; reason: string }[] = [
    { re: /\bcounter target\b/, reason: "counterspell" },
    { re: /\bchange the target\b/, reason: "redirect" },
    { re: /\bdestroy target\b/, reason: "destroy target" },
    { re: /\bexile target\b/, reason: "exile target" },
    { re: /\bdeals? \d+ damage to target\b/, reason: "damage to target" },
    { re: /\btarget opponent reveals their hand\b/, reason: "hand disruption" },
    {
      re: /\breturn target\b.*\bto (its owner's hand|their hand)\b/,
      reason: "bounce",
    },
    { re: /\bopponents can't\b/, reason: "opponent restriction" },
    { re: /\byour opponents can't\b/, reason: "opponent restriction" },
    { re: /\bcan't cast spells\b/, reason: "spell lock" },
    { re: /\bprevent all damage\b/, reason: "damage prevention" },
  ];

  for (const { re, reason } of patterns) {
    if (re.test(text) && !reasons.includes(reason)) reasons.push(reason);
  }

  return reasons;
}

export function isInteraction(card: ScryfallCard) {
  return getInteractionReasons(card).length > 0;
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

