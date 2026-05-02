import type { CardTag, CardTagMap, Deck, DeckArchetype } from "@/lib/deck";
import { expandDeck } from "@/lib/deck";
import { hypergeometricAtLeast } from "@/lib/analysis";
import type { ScryfallCard } from "@/lib/scryfall";
import {
  isArtifact,
  computeDeckStats,
  isInteraction,
  isLand,
  isRamp,
  isWinconHeuristic,
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

/** concern = worth reviewing or updating; positive = strength; neutral = context */
export type HealthWarning = {
  tone: "concern" | "positive" | "neutral";
  text: string;
};

type BenchmarkProfile = {
  id: "precon" | "upgraded_precon" | "local_tournament" | "cedh";
  label: string;
  targets: {
    lands: number;
    ramp: number;
    interaction: number;
    avgCmc: number;
    fastMana: number;
    tutors: number;
    efficientInteraction: number;
    freeInteraction: number;
    wincons: number;
  };
};

const BENCHMARKS: BenchmarkProfile[] = [
  {
    id: "precon",
    label: "Precon decks",
    targets: {
      lands: 38,
      ramp: 8,
      interaction: 7,
      avgCmc: 3.7,
      fastMana: 1,
      tutors: 1,
      efficientInteraction: 2,
      freeInteraction: 0,
      wincons: 2,
    },
  },
  {
    id: "upgraded_precon",
    label: "Upgraded precons",
    targets: {
      lands: 37,
      ramp: 10,
      interaction: 10,
      avgCmc: 3.4,
      fastMana: 3,
      tutors: 3,
      efficientInteraction: 5,
      freeInteraction: 1,
      wincons: 3,
    },
  },
  {
    id: "local_tournament",
    label: "Local tournaments",
    targets: {
      lands: 36,
      ramp: 11,
      interaction: 12,
      avgCmc: 3.1,
      fastMana: 6,
      tutors: 6,
      efficientInteraction: 9,
      freeInteraction: 3,
      wincons: 4,
    },
  },
  {
    id: "cedh",
    label: "cEDH-style",
    targets: {
      lands: 31,
      ramp: 14,
      interaction: 18,
      avgCmc: 2.2,
      fastMana: 11,
      tutors: 10,
      efficientInteraction: 14,
      freeInteraction: 6,
      wincons: 4,
    },
  },
];

function closeness(actual: number, target: number, tolerance: number) {
  const diff = Math.abs(actual - target);
  const raw = 1 - diff / tolerance;
  return Math.max(0, Math.min(1, raw));
}

export function deckBenchmarkScores(deck: Deck) {
  const s = computeDeckStats(deck);
  const p = computePowerSignals(deck);
  return BENCHMARKS.map((b) => {
    const landScore = closeness(s.landCount, b.targets.lands, 10);
    const rampScore = closeness(s.rampCount, b.targets.ramp, 8);
    const interactionScore = closeness(s.interactionCount, b.targets.interaction, 10);
    const cmcScore = closeness(s.avgCmcNonLands, b.targets.avgCmc, 1.8);
    const fastManaScore = closeness(p.fastManaCount, b.targets.fastMana, 8);
    const tutorScore = closeness(p.tutorCount, b.targets.tutors, 8);
    const efficientInteractionScore = closeness(
      p.efficientInteractionCount,
      b.targets.efficientInteraction,
      10
    );
    const freeInteractionScore = closeness(
      p.freeInteractionCount,
      b.targets.freeInteraction,
      6
    );
    const winconScore = closeness(p.winconCount, b.targets.wincons, 4);

    const totalScore =
      landScore * 0.14 +
      rampScore * 0.14 +
      interactionScore * 0.12 +
      cmcScore * 0.14 +
      fastManaScore * 0.14 +
      tutorScore * 0.12 +
      efficientInteractionScore * 0.12 +
      freeInteractionScore * 0.05 +
      winconScore * 0.03;

    return {
      id: b.id,
      label: b.label,
      score: totalScore,
      targets: b.targets,
      deltas: {
        lands: s.landCount - b.targets.lands,
        ramp: s.rampCount - b.targets.ramp,
        interaction: s.interactionCount - b.targets.interaction,
        avgCmc: s.avgCmcNonLands - b.targets.avgCmc,
        fastMana: p.fastManaCount - b.targets.fastMana,
        tutors: p.tutorCount - b.targets.tutors,
        efficientInteraction:
          p.efficientInteractionCount - b.targets.efficientInteraction,
      },
    };
  });
}

function countTaggedDeckCards(
  deck: Deck,
  tagMap: CardTagMap,
  tag: CardTag,
  heuristic: (card: ScryfallCard) => boolean
) {
  return deck.entries.reduce((sum, entry) => {
    const tagged = (tagMap[entry.card.id] ?? []).includes(tag);
    return sum + (tagged || heuristic(entry.card) ? entry.count : 0);
  }, 0);
}

const KNOWN_WIN_COMBOS = [
  ["Bloodchief Ascension", "Mindcrank"],
  ["Thassa's Oracle", "Demonic Consultation"],
  ["Thassa's Oracle", "Tainted Pact"],
  ["Laboratory Maniac", "Demonic Consultation"],
  ["Exquisite Blood", "Sanguine Bond"],
] as const;

function detectedWinCombos(deck: Deck) {
  const names = new Set(deck.entries.map((entry) => entry.card.name.toLowerCase()));
  return KNOWN_WIN_COMBOS.filter(([a, b]) =>
    names.has(a.toLowerCase()) && names.has(b.toLowerCase())
  );
}

type ArchetypeProfile = {
  landMin: number;
  landIdeal: number;
  rampMin: number;
  rampIdeal: number;
  interactionMin: number;
  interactionIdeal: number;
  cmcWarning: number; // avg CMC above this triggers a note
  rampLabel: string;
  interactionLabel: string;
};

const ARCHETYPE_PROFILES: Record<DeckArchetype, ArchetypeProfile> = {
  midrange: {
    landMin: 33, landIdeal: 36,
    rampMin: 8, rampIdeal: 12,
    interactionMin: 7, interactionIdeal: 12,
    cmcWarning: 3.8,
    rampLabel: "ramp pieces",
    interactionLabel: "interaction spells",
  },
  ramp: {
    landMin: 34, landIdeal: 37,
    rampMin: 12, rampIdeal: 16,
    interactionMin: 6, interactionIdeal: 10,
    cmcWarning: 4.5,
    rampLabel: "ramp pieces (ramp decks want 12+)",
    interactionLabel: "interaction spells",
  },
  aggro: {
    landMin: 30, landIdeal: 34,
    rampMin: 5, rampIdeal: 10,
    interactionMin: 8, interactionIdeal: 12,
    cmcWarning: 3.0,
    rampLabel: "mana accelerants",
    interactionLabel: "removal spells (aggro needs clean answers)",
  },
  control: {
    landMin: 35, landIdeal: 38,
    rampMin: 7, rampIdeal: 11,
    interactionMin: 14, interactionIdeal: 20,
    cmcWarning: 4.0,
    rampLabel: "mana rocks / ramp",
    interactionLabel: "counterspells + removal (control wants 14+)",
  },
  combo: {
    landMin: 28, landIdeal: 33,
    rampMin: 10, rampIdeal: 15,
    interactionMin: 6, interactionIdeal: 10,
    cmcWarning: 2.8,
    rampLabel: "fast mana / ramp pieces",
    interactionLabel: "interaction / protection spells",
  },
};

export function deckHealthWarnings(
  deck: Deck,
  tagMap: CardTagMap = {}
): HealthWarning[] {
  const s = computeDeckStats(deck);
  const archetype = (deck.archetype ?? "midrange") as DeckArchetype;
  const profile = ARCHETYPE_PROFILES[archetype] ?? ARCHETYPE_PROFILES.midrange;
  const warnings: HealthWarning[] = [];

  // Land count — thresholds differ by archetype
  if (s.landCount >= profile.landIdeal) {
    warnings.push({ tone: "positive", text: `✅ Strong land base (${s.landCount} lands)` });
  } else if (s.landCount >= profile.landMin) {
    warnings.push({
      tone: "concern",
      text: `⚠️ Land count is on the low side for ${archetype} (${s.landCount} lands, aim for ${profile.landIdeal}+)`,
    });
  } else {
    warnings.push({
      tone: "concern",
      text: `❌ Low land count (${s.landCount}) — high risk of mana screw for a ${archetype} deck`,
    });
  }

  // Average CMC note
  if (s.avgCmcNonLands > profile.cmcWarning) {
    warnings.push({
      tone: "concern",
      text: `⚠️ High average CMC (${s.avgCmcNonLands.toFixed(2)}) for ${archetype} — expect slow starts unless ramp is solid`,
    });
  } else if (s.avgCmcNonLands > 0) {
    warnings.push({
      tone: "positive",
      text: `✅ Average CMC looks appropriate for ${archetype} (${s.avgCmcNonLands.toFixed(2)})`,
    });
  }

  // Ramp — thresholds differ by archetype
  const rampCount = countTaggedDeckCards(deck, tagMap, "ramp", isRamp);
  if (rampCount >= profile.rampIdeal) {
    warnings.push({ tone: "positive", text: `✅ Strong ramp package (${rampCount} ${profile.rampLabel})` });
  } else if (rampCount >= profile.rampMin) {
    warnings.push({
      tone: "concern",
      text: `⚠️ Ramp is light for ${archetype} (${rampCount} ${profile.rampLabel}, aim for ${profile.rampIdeal}+)`,
    });
  } else {
    warnings.push({
      tone: "concern",
      text: `❌ Low ramp count (${rampCount} ${profile.rampLabel}) — add more acceleration`,
    });
  }

  // Interaction — thresholds differ by archetype
  const interactionCount = countTaggedDeckCards(deck, tagMap, "interaction", isInteraction);
  if (interactionCount >= profile.interactionIdeal) {
    warnings.push({ tone: "positive", text: `✅ Strong interaction suite (${interactionCount} ${profile.interactionLabel})` });
  } else if (interactionCount >= profile.interactionMin) {
    warnings.push({
      tone: "concern",
      text: `⚠️ Interaction is light for ${archetype} (${interactionCount} ${profile.interactionLabel}, aim for ${profile.interactionIdeal}+)`,
    });
  } else {
    warnings.push({
      tone: "concern",
      text: `❌ Low interaction (${interactionCount}) — vulnerable to opponent threats`,
    });
  }

  // Win condition check
  const winconCount = countTaggedDeckCards(deck, tagMap, "wincon", isWinconHeuristic);
  const winconOdds =
    s.totalCards > 0 ? hypergeometricAtLeast(s.totalCards, winconCount, 7, 1) * 100 : 0;
  if (winconOdds < 20) {
    warnings.push({
      tone: "concern",
      text: "⚠️ Win condition odds are low — tag your finishers in the Probabilities tab for an accurate reading",
    });
  }

  // Detected combos
  for (const [a, b] of detectedWinCombos(deck)) {
    warnings.push({
      tone: "neutral",
      text: `🟣 Combo detected: ${a} + ${b} — high ceiling, single point of failure`,
    });
  }

  return warnings;
}

const FAST_MANA_STAPLES = new Set([
  "ancient tomb",
  "cabal ritual",
  "mana crypt",
  "sol ring",
  "mana vault",
  "chrome mox",
  "mox diamond",
  "mox amber",
  "mox opal",
  "grim monolith",
  "jeweled lotus",
  "lotus petal",
  "dark ritual",
  "rite of flame",
  "simian spirit guide",
  "elvish spirit guide",
]);

const FREE_INTERACTION_STAPLES = new Set([
  "deadly rollick",
  "deflecting swat",
  "fierce guardianship",
  "force of negation",
  "force of vigor",
  "force of will",
  "mindbreak trap",
  "pact of negation",
  "submerge",
]);

const TUTOR_STAPLES = new Set([
  "demonic tutor",
  "diabolic intent",
  "enlightened tutor",
  "finale of devastation",
  "gamble",
  "green sun's zenith",
  "imperial seal",
  "mystical tutor",
  "vampiric tutor",
  "worldly tutor",
]);

function isTutor(card: ScryfallCard) {
  if (TUTOR_STAPLES.has(card.name.toLowerCase())) return true;
  const t = (card.oracle_text ?? "").toLowerCase();
  return (
    t.includes("search your library") &&
    (t.includes("put it into your hand") ||
      t.includes("put that card into your hand") ||
      t.includes("reveal it") ||
      t.includes("onto the battlefield"))
  );
}

function isFastMana(card: ScryfallCard) {
  if (FAST_MANA_STAPLES.has(card.name.toLowerCase())) return true;
  if (!isRamp(card)) return false;
  if (isLand(card)) return false;
  return card.cmc <= 2 && (isArtifact(card) || /\badd\b/.test((card.oracle_text ?? "").toLowerCase()));
}

function isEfficientInteraction(card: ScryfallCard) {
  return isInteraction(card) && card.cmc <= 2;
}

function isFreeInteraction(card: ScryfallCard) {
  if (FREE_INTERACTION_STAPLES.has(card.name.toLowerCase())) return true;
  if (!isInteraction(card)) return false;
  const cost = card.mana_cost ?? "";
  if (cost.includes("{0}")) return true;
  const t = (card.oracle_text ?? "").toLowerCase();
  return (
    t.includes("without paying its mana cost") ||
    t.includes("rather than pay this spell's mana cost") ||
    t.includes("rather than pay its mana cost")
  );
}

export function computePowerSignals(deck: Deck) {
  let fastManaCount = 0;
  let tutorCount = 0;
  let efficientInteractionCount = 0;
  let freeInteractionCount = 0;
  let winconCount = 0;

  for (const e of deck.entries) {
    if (isFastMana(e.card)) fastManaCount += e.count;
    if (isTutor(e.card)) tutorCount += e.count;
    if (isEfficientInteraction(e.card)) efficientInteractionCount += e.count;
    if (isFreeInteraction(e.card)) freeInteractionCount += e.count;
    if (isWinconHeuristic(e.card)) winconCount += e.count;
  }

  return {
    fastManaCount,
    tutorCount,
    efficientInteractionCount,
    freeInteractionCount,
    winconCount,
  };
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

