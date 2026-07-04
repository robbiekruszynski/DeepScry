import type { Deck } from "@/lib/deck";
import type { ScryfallCard } from "@/lib/scryfall";
import { isTutor } from "@/lib/commander-tools";
import { computeDeckStats, isInteraction } from "@/lib/stats";
import {
  BRACKET_FAST_MANA_STAPLES,
  BRACKET_LABELS,
  EXTRA_TURN_STAPLES,
  GAME_CHANGERS,
  INFINITE_COMBO_PAIRS,
  MASS_LAND_DENIAL_STAPLES,
} from "@/lib/bracket-data";

export type BracketSignalEvidence = {
  id: string;
  label: string;
  cards: string[];
  count: number;
};

export type BracketEstimate = {
  primary: number;
  leaning: number | null;
  label: string;
  bracketName: string;
  score: number;
  evidence: BracketSignalEvidence[];
  disclaimer: string;
};

const GAME_CHANGER_SET = new Set(
  GAME_CHANGERS.map((n) => normalizeName(n))
);
const FAST_MANA_SET = new Set(
  BRACKET_FAST_MANA_STAPLES.map((n) => normalizeName(n))
);
const EXTRA_TURN_SET = new Set(
  EXTRA_TURN_STAPLES.map((n) => normalizeName(n))
);
const MLD_SET = new Set(
  MASS_LAND_DENIAL_STAPLES.map((n) => normalizeName(n))
);

const BRACKET_DISCLAIMER =
  "Heuristic estimate — brackets are ultimately a table conversation, not a formula.";

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function isGameChanger(card: ScryfallCard) {
  return GAME_CHANGER_SET.has(normalizeName(card.name));
}

function isBracketFastMana(card: ScryfallCard) {
  if (normalizeName(card.name) === "sol ring") return false;
  if (FAST_MANA_SET.has(normalizeName(card.name))) return true;
  const text = (card.oracle_text ?? "").toLowerCase();
  return (
    /\badd \{[bwurgc]\}\{[bwurgc]\}/.test(text) ||
    (text.includes("add") && text.includes("mana of any") && card.cmc <= 2)
  );
}

function isExtraTurn(card: ScryfallCard) {
  if (EXTRA_TURN_SET.has(normalizeName(card.name))) return true;
  const text = (card.oracle_text ?? "").toLowerCase();
  return text.includes("extra turn") || text.includes("take an extra turn");
}

function isMassLandDenial(card: ScryfallCard) {
  if (MLD_SET.has(normalizeName(card.name))) return true;
  const text = (card.oracle_text ?? "").toLowerCase();
  return (
    /\bdestroy all lands\b/.test(text) ||
    /\bsacrifice all lands\b/.test(text) ||
    (text.includes("all lands") && text.includes("destroy"))
  );
}

function detectComboPairs(deckNames: Set<string>): string[] {
  const found: string[] = [];
  for (const [a, b] of INFINITE_COMBO_PAIRS) {
    if (deckNames.has(normalizeName(a)) && deckNames.has(normalizeName(b))) {
      found.push(`${a} + ${b}`);
    }
  }
  return found;
}

function collectSignalCards(
  deck: Deck,
  predicate: (card: ScryfallCard) => boolean
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const e of deck.entries) {
    if (!predicate(e.card)) continue;
    const key = normalizeName(e.card.name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(e.card.name);
  }
  return names.sort((a, b) => a.localeCompare(b));
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function formatBracketLabel(primary: number, leaning: number | null): string {
  if (!leaning || leaning === primary) {
    return `Bracket ${primary}`;
  }
  return `Bracket ${primary} (leaning ${leaning})`;
}

function computeLean(score: number, primary: number): number | null {
  const delta = score - primary;
  if (Math.abs(delta) < 0.22) return null;
  return delta > 0 ? clamp(primary + 1, 1, 5) : clamp(primary - 1, 1, 5);
}

function computeBracketScore(
  gameChangerCount: number,
  tutorCount: number,
  fastManaCount: number,
  extraTurnCount: number,
  comboPairCount: number,
  mldCount: number,
  interactionCount: number,
  avgCmc: number
): number {
  let score = 1.85;

  score += gameChangerCount * 0.55;
  score += Math.min(tutorCount, 10) * 0.11;
  score += fastManaCount * 0.21;
  score += extraTurnCount * 0.38;
  score += comboPairCount * 0.62;
  score += mldCount * 0.75;

  if (interactionCount >= 14) score += 0.35;
  else if (interactionCount >= 10) score += 0.12;
  else if (interactionCount <= 5) score -= 0.28;

  if (avgCmc > 4.1) score -= 0.35;
  else if (avgCmc < 2.75) score += 0.22;

  if (extraTurnCount >= 2) score += 0.35;

  if (gameChangerCount === 0) score = Math.min(score, 2.55);
  if (gameChangerCount >= 1 && gameChangerCount <= 3) {
    score = Math.max(score, 2.35);
    score = Math.min(score, 3.65);
  }
  if (gameChangerCount >= 4) score = Math.max(score, 3.85);
  if (gameChangerCount >= 5 && fastManaCount >= 4) score = Math.max(score, 4.35);
  if (gameChangerCount >= 6 && tutorCount >= 6) score = Math.max(score, 4.75);

  return clamp(score, 1, 5);
}

export function estimateCommanderBracket(deck: Deck): BracketEstimate {
  const stats = computeDeckStats(deck);
  const deckNameSet = new Set(
    deck.entries.map((e) => normalizeName(e.card.name))
  );

  const gameChangers = collectSignalCards(deck, isGameChanger);
  const tutors = collectSignalCards(deck, isTutor);
  const fastMana = collectSignalCards(deck, isBracketFastMana);
  const extraTurns = collectSignalCards(deck, isExtraTurn);
  const massLandDenial = collectSignalCards(deck, isMassLandDenial);
  const interactionCards = collectSignalCards(deck, (c) => isInteraction(c));
  const comboPairs = detectComboPairs(deckNameSet);

  const score = computeBracketScore(
    gameChangers.length,
    tutors.length,
    fastMana.length,
    extraTurns.length,
    comboPairs.length,
    massLandDenial.length,
    stats.interactionCount,
    stats.avgCmcNonLands
  );

  const primary = clamp(Math.round(score), 1, 5);
  const leaning = computeLean(score, primary);

  const evidence: BracketSignalEvidence[] = [];

  if (gameChangers.length) {
    evidence.push({
      id: "game-changers",
      label: `Game Changers found (${gameChangers.length})`,
      cards: gameChangers,
      count: gameChangers.length,
    });
  }

  if (tutors.length) {
    evidence.push({
      id: "tutors",
      label: `Tutors (${tutors.length})`,
      cards: tutors,
      count: tutors.length,
    });
  }

  if (fastMana.length) {
    evidence.push({
      id: "fast-mana",
      label: `Fast mana (${fastMana.length}, Sol Ring excluded)`,
      cards: fastMana,
      count: fastMana.length,
    });
  }

  if (extraTurns.length) {
    evidence.push({
      id: "extra-turns",
      label: `Extra turn effects (${extraTurns.length})`,
      cards: extraTurns,
      count: extraTurns.length,
    });
  }

  if (comboPairs.length) {
    evidence.push({
      id: "combo-pairs",
      label: `Two-card combo staples (${comboPairs.length})`,
      cards: comboPairs,
      count: comboPairs.length,
    });
  }

  if (massLandDenial.length) {
    evidence.push({
      id: "mld",
      label: `Mass land denial (${massLandDenial.length})`,
      cards: massLandDenial,
      count: massLandDenial.length,
    });
  }

  evidence.push({
    id: "interaction",
    label: `Interaction density (${stats.interactionCount} pieces)`,
    cards: interactionCards,
    count: stats.interactionCount,
  });

  evidence.push({
    id: "avg-cmc",
    label: `Average CMC (non-lands): ${stats.avgCmcNonLands.toFixed(2)}`,
    cards: [],
    count: 0,
  });

  if (evidence.length === 2 && gameChangers.length === 0 && tutors.length <= 2) {
    evidence.unshift({
      id: "precon-signals",
      label: "No Game Changers; light tutors — typical precon / casual signals",
      cards: [],
      count: 0,
    });
  }

  return {
    primary,
    leaning,
    label: formatBracketLabel(primary, leaning),
    bracketName: BRACKET_LABELS[primary] ?? "Unknown",
    score,
    evidence,
    disclaimer: BRACKET_DISCLAIMER,
  };
}
