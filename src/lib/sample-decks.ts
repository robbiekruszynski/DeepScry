import type { DeckArchetype } from "@/lib/deck";
import type { EdhrecCard } from "@/app/api/edhrec/route";

export type ManaColor = "W" | "U" | "B" | "R" | "G";
export type BudgetTier = "budget" | "upgraded" | "optimized" | "cedh";
export type PowerLevel = "casual" | "focused" | "optimized" | "cedh";

// Price ceiling per card for each budget tier
export const BUDGET_PRICE_CAPS: Record<BudgetTier, number | null> = {
  budget: 5,
  upgraded: 20,
  optimized: 60,
  cedh: null, // no limit
};

export const WISE_MOTHMAN_SAMPLE = {
  name: "The Wise Mothman Sultai sample",
  commanderName: "The Wise Mothman",
  archetype: "midrange" as DeckArchetype,
  decklist: `1 The Wise Mothman
1 Command Tower
1 Exotic Orchard
1 Opulent Palace
1 Zagoth Triome
1 Breeding Pool
1 Watery Grave
1 Overgrown Tomb
1 Hinterland Harbor
1 Drowned Catacomb
1 Woodland Cemetery
1 Yavimaya Coast
1 Underground River
1 Llanowar Wastes
1 Temple of Mystery
1 Temple of Deceit
1 Temple of Malady
1 Bojuka Bog
1 Reliquary Tower
1 Evolving Wilds
1 Terramorphic Expanse
1 Myriad Landscape
6 Forest
6 Island
5 Swamp
1 Sol Ring
1 Arcane Signet
1 Fellwar Stone
1 Dimir Signet
1 Simic Signet
1 Golgari Signet
1 Talisman of Dominance
1 Cultivate
1 Kodama's Reach
1 Farseek
1 Sakura-Tribe Elder
1 Birds of Paradise
1 Llanowar Elves
1 Elvish Mystic
1 Fyndhorn Elves
1 Coiling Oracle
1 Baleful Strix
1 Eternal Witness
1 Solemn Simulacrum
1 Muldrotha, the Gravetide
1 Syr Konrad, the Grim
1 Consuming Aberration
1 Wonder
1 Brawn
1 Acidic Slime
1 Evolution Sage
1 Winding Constrictor
1 Forgotten Ancient
1 Corpsejack Menace
1 Laboratory Maniac
1 Thassa's Oracle
1 Scute Swarm
1 Seedborn Muse
1 Beast Whisperer
1 Tatyova, Benthic Druid
1 Mesmeric Orb
1 Altar of Dementia
1 Fraying Sanity
1 Sphinx's Tutelage
1 Mindcrank
1 Revel in Riches
1 Exquisite Blood
1 Doubling Season
1 Hardened Scales
1 Branching Evolution
1 Lightning Greaves
1 Assassin's Trophy
1 Beast Within
1 Putrefy
1 Counterspell
1 Swan Song
1 Arcane Denial
1 Reality Shift
1 Toxic Deluge
1 Casualties of War
1 Cyclonic Rift
1 Rhystic Study
1 Mystic Remora
1 Fact or Fiction
1 Regrowth
1 Living Death`,
};

const POPULAR_COMMANDERS: Record<string, string> = {
  B: "K'rrik, Son of Yawgmoth",
  BG: "Meren of Clan Nel Toth",
  BGR: "Korvold, Fae-Cursed King",
  BGU: "The Wise Mothman",
  BR: "Prosper, Tome-Bound",
  BRW: "Edgar Markov",
  G: "Goreclaw, Terror of Qal Sisma",
  GR: "Xenagos, God of Revels",
  GRU: "Kalamax, the Stormsire",
  GRW: "Pantlaza, Sun-Favored",
  GU: "Aesi, Tyrant of Gyre Strait",
  GW: "Sythis, Harvest's Hand",
  GWU: "Chulane, Teller of Tales",
  R: "Krenko, Mob Boss",
  RW: "Winota, Joiner of Forces",
  U: "Talrand, Sky Summoner",
  UB: "Yuriko, the Tiger's Shadow",
  UBR: "Marchesa, the Black Rose",
  UR: "Niv-Mizzet, Parun",
  URW: "Narset, Enlightened Exile",
  W: "Giada, Font of Hope",
  WB: "Liesa, Shroud of Dusk",
  WBG: "Tayam, Luminous Enigma",
  WU: "Brago, King Eternal",
  WUB: "Alela, Artful Provocateur",
  WUBRG: "Kenrith, the Returned King",
};

const BASICS: Record<ManaColor, string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
};

// Universal staples guaranteed in any generated deck (all budget-tiers include Sol Ring)
const UNIVERSAL_STAPLES = ["Sol Ring", "Command Tower", "Arcane Signet"];

function colorKey(colors: ManaColor[]) {
  return [...colors].sort().join("") || "BGU";
}

function archetype(powerLevel: PowerLevel): DeckArchetype {
  return powerLevel === "cedh" || powerLevel === "optimized" ? "combo" : "midrange";
}

// Filter EDHREC cards to those affordable under the budget tier's per-card cap
function applyBudgetFilter(cards: EdhrecCard[], tier: BudgetTier): EdhrecCard[] {
  const cap = BUDGET_PRICE_CAPS[tier];
  if (cap === null) return cards; // cEDH: no limit
  return cards.filter((c) => c.price === null || c.price <= cap);
}

// Sort by: synergy score descending, then inclusion rate descending
function rankCards(cards: EdhrecCard[]): EdhrecCard[] {
  return [...cards].sort((a, b) => {
    const synergyDiff = b.synergy - a.synergy;
    if (Math.abs(synergyDiff) > 0.01) return synergyDiff;
    return b.inclusion - a.inclusion;
  });
}

function buildLandLines(colors: ManaColor[], landTarget: number): string[] {
  const basics = colors.map((c) => BASICS[c]);
  const perColor = Math.floor(landTarget / colors.length);
  const remainder = landTarget % colors.length;
  return basics.map((basic, i) => `${perColor + (i < remainder ? 1 : 0)} ${basic}`);
}

export type GeneratedSample = {
  name: string;
  commanderName: string;
  archetype: DeckArchetype;
  powerLevel: PowerLevel;
  budget: BudgetTier;
  colors: ManaColor[];
  decklist: string;
  source: "edhrec" | "fallback";
  totalEdhrecCards: number;
};

export async function generateCommanderSample({
  colors,
  commanderName,
  budget,
  powerLevel,
}: {
  colors: ManaColor[];
  commanderName?: string;
  budget: BudgetTier;
  powerLevel: PowerLevel;
}): Promise<GeneratedSample> {
  const pickedColors = colors.length ? colors : (["B", "G", "U"] as ManaColor[]);
  const key = colorKey(pickedColors);
  const commander = commanderName?.trim() || POPULAR_COMMANDERS[key] || POPULAR_COMMANDERS.BGU!;

  const landTarget =
    powerLevel === "cedh" ? 31 : powerLevel === "optimized" ? 34 : powerLevel === "focused" ? 36 : 38;
  const spellTarget = 99 - landTarget; // 99 non-commander slots, minus lands

  // Fetch EDHREC recommendations
  let edhrecCards: EdhrecCard[] = [];
  let source: "edhrec" | "fallback" = "fallback";

  try {
    const res = await fetch(
      `/api/edhrec?commander=${encodeURIComponent(commander)}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json() as { cards?: EdhrecCard[]; error?: string };
      if (Array.isArray(data.cards) && data.cards.length > 0) {
        edhrecCards = data.cards;
        source = "edhrec";
      }
    }
  } catch {
    // network error — fall through to fallback
  }

  let spellLines: string[];

  if (source === "edhrec" && edhrecCards.length > 0) {
    const budgetFiltered = applyBudgetFilter(edhrecCards, budget);
    const ranked = rankCards(budgetFiltered);

    // Exclude lands (EDHREC sometimes includes lands in cardlist) and the commander itself
    const commanderLower = commander.toLowerCase();
    const nonLandSpells = ranked.filter(
      (c) =>
        !c.name.toLowerCase().includes("plains") &&
        !c.name.toLowerCase().includes("island") &&
        !c.name.toLowerCase().includes("swamp") &&
        !c.name.toLowerCase().includes("mountain") &&
        !c.name.toLowerCase().includes("forest") &&
        c.name.toLowerCase() !== commanderLower
    );

    // Always include universal staples that pass budget filter, then top EDHREC picks
    const cap = BUDGET_PRICE_CAPS[budget];
    const universalAllowed = UNIVERSAL_STAPLES.filter(
      (s) => s.toLowerCase() !== commanderLower
    ).filter((s) => {
      // Check if EDHREC has price data for this staple
      const match = edhrecCards.find((c) => c.name.toLowerCase() === s.toLowerCase());
      if (!match) return true; // no price data, include it
      return cap === null || (match.price ?? 0) <= cap;
    });

    const picked = new Set(universalAllowed.map((s) => s.toLowerCase()));
    const spellNames: string[] = [...universalAllowed];

    for (const card of nonLandSpells) {
      if (spellNames.length >= spellTarget) break;
      if (picked.has(card.name.toLowerCase())) continue;
      picked.add(card.name.toLowerCase());
      spellNames.push(card.name);
    }

    spellLines = spellNames.map((n) => `1 ${n}`);
  } else {
    // Fallback: simple generic staples (the old approach) so something always loads
    spellLines = UNIVERSAL_STAPLES
      .filter((s) => s.toLowerCase() !== commander.toLowerCase())
      .map((n) => `1 ${n}`);
  }

  const landLines = buildLandLines(pickedColors, landTarget);

  const decklist = [
    `1 ${commander}`,
    ...spellLines,
    ...landLines,
  ].join("\n");

  return {
    name: `${commander} – ${budget} / ${powerLevel}`,
    commanderName: commander,
    archetype: archetype(powerLevel),
    powerLevel,
    budget,
    colors: pickedColors,
    decklist,
    source,
    totalEdhrecCards: edhrecCards.length,
  };
}
